#!/usr/bin/env python3
"""
Cursor OpenAI Proxy - OpenAI-compatible API proxy for Cursor IDE.

This proxy translates OpenAI API requests to Cursor's internal HTTP/2 + protobuf API,
allowing integration with tools like OpenClaw that expect OpenAI-compatible endpoints.

Usage:
    python3 proxy.py [--port PORT] [--config CONFIG]

Environment variables:
    CURSOR_PROXY_PORT      - Port to listen on (default: 3011)
    CURSOR_MODEL_ALLOWLIST - Comma-separated list of models to expose (default: curated list)
    CURSOR_MODEL_PREFIXES  - Comma-separated prefixes to filter by (e.g., "claude-,gpt-5")

Config file (~/.cursor-proxy.json):
    {
      "models": {
        "allowlist": ["claude-4-sonnet", "gpt-5.2-high"],
        "prefixes": ["claude-", "gpt-5"],
        "blocklist": ["*-fast", "*-low"]
      }
    }
"""

import argparse
import asyncio
import fnmatch
import json
import os
import re
import sys
import time
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

import httpx

# Import the Cursor HTTP/2 client
try:
    from cursor_http2_client import CursorHTTP2Client
except ImportError:
    print("Error: cursor_http2_client.py not found.")
    sys.exit(1)

# Default curated model list (popular/useful models)
DEFAULT_MODELS = [
    "claude-4-sonnet",
    "claude-4.5-sonnet",
    "claude-4.5-opus-high",
    "claude-4.5-opus-high-thinking",
    "claude-4.6-opus-high-thinking",
    "gpt-4o",
    "gpt-5.2-high",
    "gpt-5.1-codex-max",
    "gemini-3-pro",
]

# Global state
client = None
cached_all_models = None
cached_all_models_time = 0
MODELS_CACHE_TTL = 300  # 5 minutes
config = {}


def load_config(config_path: str = None):
    """Load configuration from file or environment."""
    global config
    
    # Try config file
    paths = [
        config_path,
        os.path.expanduser("~/.cursor-proxy.json"),
        ".cursor-proxy.json",
    ]
    
    for path in paths:
        if path and os.path.exists(path):
            try:
                with open(path) as f:
                    config = json.load(f)
                print(f"✓ Loaded config from {path}")
                return
            except Exception as e:
                print(f"Warning: Failed to load {path}: {e}")
    
    # Fall back to environment variables
    config = {"models": {}}
    
    allowlist = os.environ.get("CURSOR_MODEL_ALLOWLIST", "")
    if allowlist:
        config["models"]["allowlist"] = [m.strip() for m in allowlist.split(",") if m.strip()]
    
    prefixes = os.environ.get("CURSOR_MODEL_PREFIXES", "")
    if prefixes:
        config["models"]["prefixes"] = [p.strip() for p in prefixes.split(",") if p.strip()]


def get_client():
    """Lazy initialization of Cursor client."""
    global client
    if client is None:
        client = CursorHTTP2Client()
    return client


def fetch_all_models_from_api():
    """Fetch all available models from Cursor API."""
    global cached_all_models, cached_all_models_time
    
    if cached_all_models and (time.time() - cached_all_models_time) < MODELS_CACHE_TTL:
        return cached_all_models
    
    try:
        cursor_client = get_client()
        token = cursor_client.token
        checksum = cursor_client.generate_cursor_checksum(cursor_client.get_machine_id())
        
        with httpx.Client(http2=True, timeout=10) as http:
            resp = http.post(
                "https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels",
                headers={
                    "authorization": f"Bearer {token}",
                    "connect-protocol-version": "1",
                    "content-type": "application/proto",
                    "x-cursor-checksum": checksum,
                    "x-cursor-client-version": "2.3.41",
                    "x-ghost-mode": "true",
                },
                content=b"",
            )
            
            if resp.status_code != 200:
                return DEFAULT_MODELS
            
            # Parse model names from protobuf response
            content = resp.content
            model_names = []
            i = 0
            while i < len(content):
                if content[i] == 0x0a:
                    i += 1
                    if i < len(content):
                        length = content[i]
                        i += 1
                        if 0 < length < 100 and i + length <= len(content):
                            try:
                                name = content[i:i+length].decode('utf-8')
                                if re.match(r'^[a-z0-9][\w\.\-]*$', name) and len(name) < 50:
                                    if name not in model_names:
                                        model_names.append(name)
                            except:
                                pass
                            i += length
                            continue
                i += 1
            
            if model_names:
                cached_all_models = model_names
                cached_all_models_time = time.time()
                return model_names
            
    except Exception as e:
        print(f"Warning: Failed to fetch models: {e}")
    
    return DEFAULT_MODELS


def filter_models(all_models: list) -> list:
    """Apply configured filters to model list."""
    models_config = config.get("models", {})
    
    # If explicit allowlist, use only those
    allowlist = models_config.get("allowlist", [])
    if allowlist:
        return [m for m in allowlist if m in all_models]
    
    # Apply prefix filter
    prefixes = models_config.get("prefixes", [])
    if prefixes:
        filtered = []
        for m in all_models:
            for prefix in prefixes:
                if m.startswith(prefix):
                    filtered.append(m)
                    break
        if filtered:
            all_models = filtered
    
    # Apply blocklist (glob patterns)
    blocklist = models_config.get("blocklist", [])
    if blocklist:
        all_models = [
            m for m in all_models
            if not any(fnmatch.fnmatch(m, pattern) for pattern in blocklist)
        ]
    
    return all_models if all_models else DEFAULT_MODELS


def get_exposed_models():
    """Get the filtered list of models to expose."""
    all_models = fetch_all_models_from_api()
    return filter_models(all_models)


class ProxyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for OpenAI-compatible API."""

    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json({"error": {"message": message, "type": "api_error"}}, status)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        if self.path == "/v1/models":
            self.handle_models()
        elif self.path == "/v1/models/all":
            # Hidden endpoint: return ALL models (for discovery)
            self.handle_all_models()
        elif self.path == "/health" or self.path == "/":
            self.send_json({
                "status": "ok",
                "service": "cursor-openai-proxy",
                "models_exposed": len(get_exposed_models()),
            })
        else:
            self.send_error_json(404, "Not Found")

    def do_POST(self):
        if self.path == "/v1/chat/completions":
            self.handle_chat_completions()
        else:
            self.send_error_json(404, "Not Found")

    def handle_models(self):
        """Return filtered models based on config."""
        models = get_exposed_models()
        response = {
            "object": "list",
            "data": [
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "cursor",
                }
                for model in models
            ],
        }
        self.send_json(response)

    def handle_all_models(self):
        """Return ALL available models (for discovery)."""
        models = fetch_all_models_from_api()
        response = {
            "object": "list",
            "data": [
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "cursor",
                }
                for model in models
            ],
        }
        self.send_json(response)

    def handle_chat_completions(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self.send_error_json(400, "Empty request body")
            return

        try:
            body = self.rfile.read(content_length).decode("utf-8")
            req = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            self.send_error_json(400, f"Invalid JSON: {e}")
            return

        model = req.get("model", "claude-4-sonnet")
        messages = req.get("messages", [])
        stream = req.get("stream", False)

        if not messages:
            self.send_error_json(400, "messages is required")
            return

        # Build prompt
        prompt_parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    p.get("text", "") for p in content if p.get("type") == "text"
                )
            prompt_parts.append(f"{role}: {content}")
        prompt = "\n".join(prompt_parts)

        try:
            cursor_client = get_client()
            response_text = asyncio.run(
                cursor_client.test_http2_breakthrough(prompt, model)
            )
        except Exception as e:
            self.log_message(f"Cursor API error: {e}")
            self.send_error_json(502, f"Cursor API error: {e}")
            return

        response_id = f"chatcmpl-{uuid.uuid4()}"
        created = int(time.time())

        if stream:
            self.send_streaming_response(response_id, model, created, response_text)
        else:
            self.send_json({
                "id": response_id,
                "object": "chat.completion",
                "created": created,
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": response_text or ""},
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            })

    def send_streaming_response(self, response_id, model, created, content):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        chunks = [
            {"delta": {"role": "assistant"}, "finish_reason": None},
            {"delta": {"content": content or ""}, "finish_reason": None},
            {"delta": {}, "finish_reason": "stop"},
        ]
        for chunk in chunks:
            data = {
                "id": response_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, **chunk}],
            }
            self.wfile.write(f"data: {json.dumps(data)}\n\n".encode())
            self.wfile.flush()

        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()


def main():
    parser = argparse.ArgumentParser(description="Cursor OpenAI Proxy")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CURSOR_PROXY_PORT", 3011)))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--config", help="Path to config file")
    args = parser.parse_args()

    load_config(args.config)

    try:
        get_client()
        print("✓ Cursor client initialized")
    except Exception as e:
        print(f"✗ Failed to initialize Cursor client: {e}")
        sys.exit(1)

    models = get_exposed_models()
    all_count = len(fetch_all_models_from_api())
    print(f"✓ Exposing {len(models)}/{all_count} models")
    print(f"  Models: {', '.join(models[:5])}{'...' if len(models) > 5 else ''}")

    server = HTTPServer((args.host, args.port), ProxyHandler)
    print(f"\nCursor OpenAI Proxy: http://{args.host}:{args.port}")
    print("  /v1/models      - Filtered model list")
    print("  /v1/models/all  - All available models")
    print("Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
