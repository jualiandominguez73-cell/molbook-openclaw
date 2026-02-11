#!/usr/bin/env python3
"""
setup.py — Instala Pod Maestro completo
Uso: python3 setup.py
Crea todos los archivos en /workspace/orquestador/
"""
import os

BASE = "/workspace/orquestador"

FILES = {}

# ══════════════════════════════════════════════════════
# config.yaml
# ══════════════════════════════════════════════════════
FILES["config.yaml"] = '''server:
  host: "0.0.0.0"
  port: 8000
  auth_token: "pod-maestro-2026"
opus:
  model: "claude-opus-4-6"
  max_tokens: 4096
agents:
  codigo:
    enabled: true
    models:
      primary: "qwen2.5:32b"
      fast: "qwen2.5-coder:7b"
    ollama_url: "http://127.0.0.1:11434"
    max_context: 65536
    max_tokens: 8192
  voz:
    enabled: true
    tts_engine: "edge-tts"
    voices_dir: "/workspace/voces"
    output_dir: "/workspace/outputs/audio"
    default_language: "es"
  imagen:
    enabled: true
    comfyui_url: "http://127.0.0.1:8188"
    output_dir: "/workspace/outputs/images"
    default_size: "1024x1024"
  video:
    enabled: true
    comfyui_url: "http://127.0.0.1:8188"
    output_dir: "/workspace/outputs/video"
    default_fps: 24
  consulta:
    enabled: true
    model: "qwen2.5:32b"
    embeddings_model: "nomic-embed-text"
    chromadb_path: "/workspace/memoria_secretaria"
    ollama_url: "http://127.0.0.1:11434"
    collection_name: "conocimiento_noe"
queue:
  max_concurrent: 3
  job_timeout: 600
  cleanup_after: 3600
'''

# ══════════════════════════════════════════════════════
# requirements.txt
# ══════════════════════════════════════════════════════
FILES["requirements.txt"] = '''fastapi==0.115.0
uvicorn[standard]==0.30.0
pyyaml==6.0.1
python-multipart==0.0.9
httpx==0.27.0
aiofiles==24.1.0
pydantic==2.9.0
loguru==0.7.2
anthropic==0.40.0
chromadb==0.5.0
websocket-client==1.8.0
Pillow==10.4.0
python-dotenv==1.0.1
psutil==6.0.0
numpy==1.26.4
'''

# ══════════════════════════════════════════════════════
# agents/__init__.py
# ══════════════════════════════════════════════════════
FILES["agents/__init__.py"] = '''from abc import ABC, abstractmethod
from loguru import logger

class BaseAgent(ABC):
    def __init__(self, name, config):
        self.name = name
        self.config = config
        self.enabled = config.get("enabled", True)
        logger.info(f"  Agente {name} -> {'ON' if self.enabled else 'OFF'}")

    @abstractmethod
    async def execute(self, subtarea):
        pass

    async def health_check(self):
        return {"agent": self.name, "status": "ok" if self.enabled else "disabled"}
'''

# ══════════════════════════════════════════════════════
# agents/code_agent.py
# ══════════════════════════════════════════════════════
FILES["agents/code_agent.py"] = '''import httpx
from loguru import logger
from agents import BaseAgent

class CodeAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("codigo", config)
        self.ollama_url = config.get("ollama_url", "http://127.0.0.1:11434")
        self.primary_model = config.get("models", {}).get("primary", "qwen2.5:32b")
        self.fast_model = config.get("models", {}).get("fast", "qwen2.5-coder:7b")
        self.max_context = config.get("max_context", 65536)
        self.max_tokens = config.get("max_tokens", 8192)

    def _select_model(self, subtarea):
        tarea = subtarea.get("tarea", "").lower()
        modelo = subtarea.get("modelo", "auto")
        if modelo != "auto":
            return modelo
        simple = ["fix", "typo", "rename", "format", "lint", "simple", "rapido"]
        return self.fast_model if any(k in tarea for k in simple) else self.primary_model

    async def execute(self, subtarea):
        model = self._select_model(subtarea)
        prompt = subtarea.get("prompt", subtarea.get("tarea", ""))
        system = """Eres un programador experto. Dueno: Dominguez (Noe), desarrollador mexicano.
Responde en espanol para explicaciones, ingles para codigo. Codigo completo y funcional.
Stack preferido: Python/Flask, React/Vite, Supabase, Hostinger."""
        logger.info(f"[CODIGO] {model} | {prompt[:80]}")
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                r = await client.post(f"{self.ollama_url}/api/chat", json={
                    "model": model, "stream": False,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                    "options": {"num_ctx": self.max_context, "num_predict": self.max_tokens, "temperature": 0.3}
                })
                r.raise_for_status()
                data = r.json()
                return {"tipo": "codigo", "modelo": model,
                        "contenido": data.get("message", {}).get("content", ""),
                        "tokens": data.get("eval_count", 0)}
        except Exception as e:
            logger.error(f"[CODIGO] {e}")
            raise

    async def health_check(self):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{self.ollama_url}/api/tags")
                models = [m["name"] for m in r.json().get("models", [])]
                return {"agent": self.name, "status": "ok", "ollama": "connected", "models": models}
        except Exception as e:
            return {"agent": self.name, "status": "error", "error": str(e)}
'''

# ══════════════════════════════════════════════════════
# agents/voice_agent.py
# ══════════════════════════════════════════════════════
FILES["agents/voice_agent.py"] = '''import os, uuid, subprocess, shutil
from pathlib import Path
from loguru import logger
from agents import BaseAgent

class VoiceAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("voz", config)
        self.voices_dir = Path(config.get("voices_dir", "/workspace/voces"))
        self.output_dir = Path(config.get("output_dir", "/workspace/outputs/audio"))
        self.default_lang = config.get("default_language", "es")
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def execute(self, subtarea):
        tarea = subtarea.get("tarea", "").lower()
        if any(w in tarea for w in ["transcri", "stt", "audio a texto"]):
            return await self._transcribe(subtarea)
        elif any(w in tarea for w in ["clon", "clone", "copiar voz"]):
            return await self._clone(subtarea)
        else:
            return await self._tts(subtarea)

    async def _tts(self, subtarea):
        texto = subtarea.get("prompt", subtarea.get("tarea", ""))
        lang = subtarea.get("language", self.default_lang)
        out = self.output_dir / f"tts_{uuid.uuid4().hex[:8]}.wav"
        logger.info(f"[VOZ] TTS: {texto[:60]}")
        voice = "es-MX-DaliaNeural" if lang == "es" else "en-US-GuyNeural"
        script = f'import edge_tts, asyncio; asyncio.run(edge_tts.Communicate("{texto}", "{voice}").save("{out}"))'
        try:
            r = subprocess.run(["python3", "-c", script], capture_output=True, text=True, timeout=120)
            if r.returncode == 0:
                return {"tipo": "audio", "archivo": str(out), "engine": "edge-tts"}
            raise RuntimeError(r.stderr)
        except Exception as e:
            logger.error(f"[VOZ] {e}")
            raise

    async def _transcribe(self, subtarea):
        audio = subtarea.get("audio_file", "")
        lang = subtarea.get("language", self.default_lang)
        logger.info(f"[VOZ] STT: {audio}")
        script = f'import whisper; m=whisper.load_model("large-v3"); print(m.transcribe("{audio}",language="{lang}")["text"])'
        r = subprocess.run(["python3", "-c", script], capture_output=True, text=True, timeout=300)
        if r.returncode == 0:
            return {"tipo": "transcripcion", "texto": r.stdout.strip()}
        raise RuntimeError(r.stderr)

    async def _clone(self, subtarea):
        sample = subtarea.get("sample_file", "")
        name = subtarea.get("speaker_name", f"voice_{uuid.uuid4().hex[:6]}")
        d = self.voices_dir / name
        d.mkdir(parents=True, exist_ok=True)
        shutil.copy2(sample, d / "reference.wav")
        return {"tipo": "voz_clonada", "speaker": name, "dir": str(d)}

    async def health_check(self):
        voices = [d.name for d in self.voices_dir.iterdir() if d.is_dir()] if self.voices_dir.exists() else []
        return {"agent": self.name, "status": "ok", "voices": voices}
'''

# ══════════════════════════════════════════════════════
# agents/image_agent.py
# ══════════════════════════════════════════════════════
FILES["agents/image_agent.py"] = '''import uuid, json, subprocess, random
import httpx
from pathlib import Path
from loguru import logger
from agents import BaseAgent

class ImageAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("imagen", config)
        self.comfyui_url = config.get("comfyui_url", "http://127.0.0.1:8188")
        self.output_dir = Path(config.get("output_dir", "/workspace/outputs/images"))
        self.default_size = config.get("default_size", "1024x1024")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def execute(self, subtarea):
        prompt = subtarea.get("prompt", subtarea.get("tarea", ""))
        logger.info(f"[IMAGEN] {prompt[:80]}")
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                await c.get(f"{self.comfyui_url}/system_stats")
            return await self._comfyui_generate(subtarea)
        except Exception:
            logger.warning("[IMAGEN] ComfyUI offline, usando fallback")
            return await self._fallback(subtarea)

    async def _comfyui_generate(self, subtarea):
        prompt = subtarea.get("prompt", "")
        size = subtarea.get("size", self.default_size)
        steps = subtarea.get("steps", 20)
        negative = subtarea.get("negative_prompt", "blurry, low quality, deformed")
        w, h = [int(x) for x in size.split("x")]
        seed = random.randint(0, 2**32-1)
        workflow = {
            "3": {"inputs": {"seed": seed, "steps": steps, "cfg": 7.0, "sampler_name": "euler",
                  "scheduler": "normal", "denoise": 1.0, "model": ["4",0], "positive": ["6",0],
                  "negative": ["7",0], "latent_image": ["5",0]}, "class_type": "KSampler"},
            "4": {"inputs": {"ckpt_name": "sd3.5_medium.safetensors"}, "class_type": "CheckpointLoaderSimple"},
            "5": {"inputs": {"width": w, "height": h, "batch_size": 1}, "class_type": "EmptyLatentImage"},
            "6": {"inputs": {"text": prompt, "clip": ["4",1]}, "class_type": "CLIPTextEncode"},
            "7": {"inputs": {"text": negative, "clip": ["4",1]}, "class_type": "CLIPTextEncode"},
            "8": {"inputs": {"samples": ["3",0], "vae": ["4",2]}, "class_type": "VAEDecode"},
            "9": {"inputs": {"filename_prefix": f"pm_{uuid.uuid4().hex[:6]}", "images": ["8",0]}, "class_type": "SaveImage"}
        }
        cid = str(uuid.uuid4())
        async with httpx.AsyncClient(timeout=300) as c:
            r = await c.post(f"{self.comfyui_url}/prompt", json={"prompt": workflow, "client_id": cid})
            r.raise_for_status()
            pid = r.json().get("prompt_id")
        import asyncio
        for _ in range(150):
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(f"{self.comfyui_url}/history/{pid}")
                if r.status_code == 200 and pid in r.json():
                    imgs = []
                    for n in r.json()[pid].get("outputs", {}).values():
                        if "images" in n:
                            imgs.extend(n["images"])
                    if imgs:
                        files = []
                        for img in imgs:
                            async with httpx.AsyncClient(timeout=30) as c2:
                                ir = await c2.get(f"{self.comfyui_url}/view", params={"filename": img["filename"], "type": "output"})
                                if ir.status_code == 200:
                                    p = self.output_dir / img["filename"]
                                    p.write_bytes(ir.content)
                                    files.append(str(p))
                        return {"tipo": "imagen", "archivos": files, "cantidad": len(files)}
            await asyncio.sleep(2)
        raise TimeoutError("ComfyUI timeout")

    async def _fallback(self, subtarea):
        prompt = subtarea.get("prompt", "")
        out = self.output_dir / f"fb_{uuid.uuid4().hex[:8]}.png"
        script = f"""
from diffusers import StableDiffusionPipeline
import torch
pipe = StableDiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-3.5-medium", torch_dtype=torch.float16).to("cuda")
pipe("{prompt}", num_inference_steps=20).images[0].save("{out}")
print("OK")
"""
        r = subprocess.run(["python3", "-c", script], capture_output=True, text=True, timeout=300)
        if "OK" in r.stdout:
            return {"tipo": "imagen", "archivos": [str(out)], "fallback": True}
        raise RuntimeError(f"Fallback fallo: {r.stderr[:200]}")

    async def health_check(self):
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{self.comfyui_url}/system_stats")
                return {"agent": self.name, "status": "ok", "comfyui": "connected"}
        except:
            return {"agent": self.name, "status": "degraded", "nota": "ComfyUI offline"}
'''

# ══════════════════════════════════════════════════════
# agents/video_agent.py
# ══════════════════════════════════════════════════════
FILES["agents/video_agent.py"] = '''import uuid, subprocess
from pathlib import Path
from loguru import logger
from agents import BaseAgent

class VideoAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("video", config)
        self.output_dir = Path(config.get("output_dir", "/workspace/outputs/video"))
        self.default_fps = config.get("default_fps", 24)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def execute(self, subtarea):
        tarea = subtarea.get("tarea", "").lower()
        if any(w in tarea for w in ["combina", "merge", "juntar", "ffmpeg"]):
            return await self._merge(subtarea)
        return await self._text_to_video(subtarea)

    async def _text_to_video(self, subtarea):
        prompt = subtarea.get("prompt", "")
        fps = subtarea.get("fps", self.default_fps)
        dur = subtarea.get("duration_seconds", 4)
        out = self.output_dir / f"vid_{uuid.uuid4().hex[:8]}.mp4"
        logger.info(f"[VIDEO] T2V: {prompt[:60]}")
        script = f"""
import torch
try:
    from diffusers import HunyuanVideoPipeline
    from diffusers.utils import export_to_video
    p = HunyuanVideoPipeline.from_pretrained("tencent/HunyuanVideo", torch_dtype=torch.float16).to("cuda")
    p.enable_model_cpu_offload()
    o = p(prompt="{prompt}", height=512, width=768, num_frames={fps*dur}, num_inference_steps=30)
    export_to_video(o.frames[0], "{out}", fps={fps})
    print("OK")
except Exception as e:
    print(f"ERROR: {{e}}")
"""
        r = subprocess.run(["python3", "-c", script], capture_output=True, text=True, timeout=600)
        if "OK" in r.stdout:
            return {"tipo": "video", "archivo": str(out), "fps": fps, "duracion": dur}
        raise RuntimeError(r.stderr[:200])

    async def _merge(self, subtarea):
        vp = subtarea.get("video_path", "")
        ap = subtarea.get("audio_path", "")
        out = self.output_dir / f"merge_{uuid.uuid4().hex[:8]}.mp4"
        if not vp or not ap:
            raise ValueError("Falta video_path o audio_path")
        r = subprocess.run(["ffmpeg", "-y", "-i", vp, "-i", ap, "-c:v", "copy", "-c:a", "aac", "-shortest", str(out)],
                           capture_output=True, text=True, timeout=120)
        if r.returncode == 0:
            return {"tipo": "video_merge", "archivo": str(out)}
        raise RuntimeError(r.stderr[:200])

    async def health_check(self):
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5, check=True)
            return {"agent": self.name, "status": "ok", "ffmpeg": "available"}
        except:
            return {"agent": self.name, "status": "degraded", "ffmpeg": "missing"}
'''

# ══════════════════════════════════════════════════════
# agents/rag_agent.py
# ══════════════════════════════════════════════════════
FILES["agents/rag_agent.py"] = '''import httpx
from loguru import logger
from agents import BaseAgent

class RAGAgent(BaseAgent):
    def __init__(self, config):
        super().__init__("consulta", config)
        self.model = config.get("model", "qwen2.5:32b")
        self.embeddings_model = config.get("embeddings_model", "nomic-embed-text")
        self.chromadb_path = config.get("chromadb_path", "/workspace/memoria_secretaria")
        self.ollama_url = config.get("ollama_url", "http://127.0.0.1:11434")
        self.collection_name = config.get("collection_name", "conocimiento_noe")
        self._collection = None

    def _init_db(self):
        if self._collection is not None:
            return
        try:
            import chromadb
            from chromadb.config import Settings
            client = chromadb.PersistentClient(path=self.chromadb_path, settings=Settings(anonymized_telemetry=False))
            self._collection = client.get_or_create_collection(name=self.collection_name, metadata={"hnsw:space": "cosine"})
            logger.info(f"[RAG] ChromaDB: {self._collection.count()} docs")
        except Exception as e:
            logger.warning(f"[RAG] ChromaDB no disponible: {e}")

    async def _get_embeddings(self, text):
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(f"{self.ollama_url}/api/embeddings", json={"model": self.embeddings_model, "prompt": text})
                return r.json().get("embedding", [])
        except:
            return []

    async def _search(self, query, n=5):
        self._init_db()
        if not self._collection or self._collection.count() == 0:
            return ""
        emb = await self._get_embeddings(query)
        if not emb:
            return ""
        try:
            results = self._collection.query(query_embeddings=[emb], n_results=n)
            if results and results.get("documents"):
                return "\\n---\\n".join(results["documents"][0])
        except:
            pass
        return ""

    async def add_knowledge(self, text, metadata=None):
        self._init_db()
        if not self._collection:
            return {"error": "ChromaDB no disponible"}
        import uuid
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        emb = await self._get_embeddings(text)
        if not emb:
            return {"error": "No se generaron embeddings"}
        self._collection.add(ids=[doc_id], documents=[text], embeddings=[emb], metadatas=[metadata or {}])
        return {"tipo": "conocimiento_agregado", "doc_id": doc_id, "total": self._collection.count()}

    async def execute(self, subtarea):
        pregunta = subtarea.get("prompt", subtarea.get("tarea", ""))
        use_rag = subtarea.get("use_rag", True)
        logger.info(f"[CONSULTA] {pregunta[:80]}")
        context = await self._search(pregunta) if use_rag else ""
        system = """Eres asistente experto para Dominguez (Noe), Contador Publico de Ciudad Juarez.
Especialidades: IMSS, SAT, ISR, IVA, facturacion CFDI 4.0, nomina.
Responde SIEMPRE en espanol. Se preciso y practico."""
        if context:
            system += f"\\n\\nCONTEXTO:\\n{context}"
        try:
            async with httpx.AsyncClient(timeout=300) as c:
                r = await c.post(f"{self.ollama_url}/api/chat", json={
                    "model": self.model, "stream": False,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": pregunta}],
                    "options": {"num_ctx": 65536, "num_predict": 4096, "temperature": 0.4}
                })
                r.raise_for_status()
                data = r.json()
                return {"tipo": "respuesta", "modelo": self.model,
                        "respuesta": data.get("message", {}).get("content", ""),
                        "rag": bool(context), "tokens": data.get("eval_count", 0)}
        except Exception as e:
            logger.error(f"[CONSULTA] {e}")
            raise

    async def health_check(self):
        self._init_db()
        return {"agent": self.name, "status": "ok", "model": self.model,
                "chromadb": "ok" if self._collection else "offline",
                "docs": self._collection.count() if self._collection else 0}
'''

# ══════════════════════════════════════════════════════
# opus_bridge.py
# ══════════════════════════════════════════════════════
FILES["opus_bridge.py"] = '''import os, json, anthropic
from loguru import logger

class OpusBridge:
    def __init__(self, config):
        key = os.environ.get("ANTHROPIC_API_KEY", config.get("api_key", ""))
        if not key:
            logger.warning("ANTHROPIC_API_KEY no configurada. Opus offline.")
            self.client = None
            return
        self.client = anthropic.Anthropic(api_key=key)
        self.model = config.get("model", "claude-opus-4-6")
        self.max_tokens = config.get("max_tokens", 4096)
        logger.info(f"Opus Bridge -> {self.model}")

    SYSTEM = """Eres el DIRECTOR de Pod Maestro. Dueno: Dominguez (Noe), Contador y dev de Cd Juarez.
Tu rol: PLANIFICAR y AUDITAR. Nunca ejecutas codigo.
Agentes: codigo (Qwen2.5 Coder), voz (TTS/Whisper), imagen (ComfyUI/FLUX), video (HunyuanVideo), consulta (Qwen2.5+ChromaDB).
Negocios: AsesorialMSS.io, Mirror IA, Antigravity, Copiloto IA.
Responde en espanol. Se practico."""

    async def planificar(self, instruccion):
        if not self.client:
            return self._local(instruccion)
        try:
            r = self.client.messages.create(model=self.model, max_tokens=self.max_tokens,
                system=self.SYSTEM, messages=[{"role": "user", "content": f"""Instruccion: {instruccion}
Genera plan JSON: {{"resumen":"...","subtareas":[{{"id":1,"agente":"codigo|voz|imagen|video|consulta","tarea":"...","prompt":"...","dependencias":[],"prioridad":1}}]}}
Solo JSON, sin texto extra."""}])
            text = r.content[0].text.strip()
            if text.startswith("```"): text = text.split("\\n",1)[1]
            if text.endswith("```"): text = text.rsplit("```",1)[0]
            return json.loads(text.strip())
        except Exception as e:
            logger.error(f"Opus error: {e}")
            return self._local(instruccion)

    async def auditar(self, tarea, resultado):
        if not self.client:
            return {"aprobado": True, "comentarios": "Offline, aprobado por defecto"}
        try:
            r = self.client.messages.create(model=self.model, max_tokens=2048, system=self.SYSTEM,
                messages=[{"role": "user", "content": f"AUDITORIA\\nTarea: {json.dumps(tarea, ensure_ascii=False)}\\nResultado:\\n{resultado[:8000]}\\nJSON: {{aprobado:bool, calidad:1-10, comentarios:str}}"}])
            text = r.content[0].text.strip()
            if text.startswith("```"): text = text.split("\\n",1)[1]
            if text.endswith("```"): text = text.rsplit("```",1)[0]
            return json.loads(text.strip())
        except:
            return {"aprobado": True, "comentarios": "Error auditoria, aprobado"}

    async def decidir(self, pregunta, contexto=""):
        if not self.client:
            return "Opus no disponible"
        r = self.client.messages.create(model=self.model, max_tokens=1024, system=self.SYSTEM,
            messages=[{"role": "user", "content": f"{contexto}\\n{pregunta}"}])
        return r.content[0].text

    def _local(self, instruccion):
        i = instruccion.lower()
        if any(w in i for w in ["codigo","code","script","api","endpoint","bug"]):
            a = "codigo"
        elif any(w in i for w in ["voz","audio","habla","transcri"]):
            a = "voz"
        elif any(w in i for w in ["imagen","foto","thumbnail","logo"]):
            a = "imagen"
        elif any(w in i for w in ["video","anima","clip"]):
            a = "video"
        else:
            a = "consulta"
        return {"resumen": f"Plan local: {instruccion[:100]}",
                "subtareas": [{"id":1,"agente":a,"tarea":instruccion,"prompt":instruccion,"dependencias":[],"prioridad":1}],
                "notas": "Sin Opus, plan local"}
'''

# ══════════════════════════════════════════════════════
# queue_manager.py
# ══════════════════════════════════════════════════════
FILES["queue_manager.py"] = '''import asyncio, uuid, time
from enum import Enum
from dataclasses import dataclass, field
from typing import Any, Optional, Callable
from loguru import logger

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    AUDITING = "auditing"
    REJECTED = "rejected"

@dataclass
class Job:
    id: str
    plan_id: str
    subtarea: dict
    status: JobStatus = JobStatus.QUEUED
    result: Any = None
    error: str = ""
    audit: dict = field(default_factory=dict)
    retries: int = 0
    max_retries: int = 2
    created_at: float = field(default_factory=time.time)
    started_at: float = 0
    completed_at: float = 0

    @property
    def agente(self): return self.subtarea.get("agente", "unknown")
    @property
    def prioridad(self): return self.subtarea.get("prioridad", 5)
    @property
    def dependencias(self): return self.subtarea.get("dependencias", [])

    def to_dict(self):
        return {"id": self.id, "plan_id": self.plan_id, "agente": self.agente,
                "tarea": self.subtarea.get("tarea",""), "status": self.status.value,
                "result_preview": str(self.result)[:200] if self.result else None,
                "error": self.error, "audit": self.audit, "retries": self.retries,
                "duration": round((self.completed_at - self.started_at) if self.completed_at else 0, 2)}

class QueueManager:
    def __init__(self, config):
        self.max_concurrent = config.get("max_concurrent", 3)
        self.job_timeout = config.get("job_timeout", 600)
        self.cleanup_after = config.get("cleanup_after", 3600)
        self.jobs = {}
        self.plans = {}
        self._running = 0
        self._lock = asyncio.Lock()
        self._agents = {}
        self._opus = None
        logger.info(f"Queue Manager: max_concurrent={self.max_concurrent}")

    def register_agent(self, name, fn):
        self._agents[name] = fn

    def set_opus_bridge(self, bridge):
        self._opus = bridge

    async def submit_plan(self, plan):
        pid = f"plan_{uuid.uuid4().hex[:8]}"
        self.plans[pid] = plan
        for st in plan.get("subtareas", []):
            jid = f"job_{uuid.uuid4().hex[:8]}"
            self.jobs[jid] = Job(id=jid, plan_id=pid, subtarea=st)
        asyncio.create_task(self._process(pid))
        return pid

    async def _process(self, pid):
        jobs = sorted([j for j in self.jobs.values() if j.plan_id == pid], key=lambda j: j.prioridad)
        st_map = {j.subtarea.get("id"): j.id for j in jobs if j.subtarea.get("id") is not None}
        while True:
            pending = [j for j in jobs if j.status == JobStatus.QUEUED]
            running = [j for j in jobs if j.status == JobStatus.RUNNING]
            if not pending and not running:
                break
            for j in pending:
                deps_ok = all(
                    self.jobs.get(st_map.get(d), Job(id="",plan_id="",subtarea={})).status == JobStatus.COMPLETED
                    for d in j.dependencias if st_map.get(d)
                )
                if deps_ok and self._running < self.max_concurrent:
                    asyncio.create_task(self._run(j))
            await asyncio.sleep(1)

    async def _run(self, job):
        async with self._lock:
            self._running += 1
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        try:
            fn = self._agents.get(job.agente)
            if not fn:
                raise ValueError(f"Agente '{job.agente}' no registrado")
            job.result = await asyncio.wait_for(fn(job.subtarea), timeout=self.job_timeout)
            job.completed_at = time.time()
            if self._opus and self._opus.client:
                job.status = JobStatus.AUDITING
                audit = await self._opus.auditar(job.subtarea, str(job.result))
                job.audit = audit
                if audit.get("aprobado", True):
                    job.status = JobStatus.COMPLETED
                elif job.retries < job.max_retries and audit.get("prompt_corregido"):
                    job.retries += 1
                    job.subtarea["prompt"] = audit["prompt_corregido"]
                    job.status = JobStatus.QUEUED
                else:
                    job.status = JobStatus.REJECTED
            else:
                job.status = JobStatus.COMPLETED
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.completed_at = time.time()
        finally:
            async with self._lock:
                self._running -= 1

    def get_job(self, jid):
        j = self.jobs.get(jid)
        return j.to_dict() if j else None

    def get_plan_status(self, pid):
        jj = [j for j in self.jobs.values() if j.plan_id == pid]
        return {"plan_id": pid, "total_jobs": len(jj),
                "completed": sum(1 for j in jj if j.status == JobStatus.COMPLETED),
                "running": sum(1 for j in jj if j.status == JobStatus.RUNNING),
                "queued": sum(1 for j in jj if j.status == JobStatus.QUEUED),
                "failed": sum(1 for j in jj if j.status in (JobStatus.FAILED, JobStatus.REJECTED)),
                "jobs": [j.to_dict() for j in jj]}

    def get_stats(self):
        return {"total_jobs": len(self.jobs), "running": self._running,
                "queued": sum(1 for j in self.jobs.values() if j.status == JobStatus.QUEUED),
                "completed": sum(1 for j in self.jobs.values() if j.status == JobStatus.COMPLETED),
                "agents": list(self._agents.keys()), "plans": len(self.plans)}

    async def cleanup_old_jobs(self):
        now = time.time()
        old = [k for k,j in self.jobs.items() if j.status in (JobStatus.COMPLETED,JobStatus.FAILED) and (now-j.completed_at)>self.cleanup_after]
        for k in old:
            del self.jobs[k]
'''

# ══════════════════════════════════════════════════════
# main.py
# ══════════════════════════════════════════════════════
FILES["main.py"] = '''import os, yaml, asyncio, uvicorn
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from loguru import logger
from opus_bridge import OpusBridge
from queue_manager import QueueManager
from agents.code_agent import CodeAgent
from agents.voice_agent import VoiceAgent
from agents.image_agent import ImageAgent
from agents.video_agent import VideoAgent
from agents.rag_agent import RAGAgent

def load_config():
    for p in [Path("/workspace/orquestador/config.yaml"), Path("config.yaml")]:
        if p.exists():
            with open(p) as f:
                return yaml.safe_load(f)
    return {}

CONFIG = load_config()
opus = OpusBridge(CONFIG.get("opus", {}))
queue = QueueManager(CONFIG.get("queue", {}))
ac = CONFIG.get("agents", {})
code_agent = CodeAgent(ac.get("codigo", {}))
voice_agent = VoiceAgent(ac.get("voz", {}))
image_agent = ImageAgent(ac.get("imagen", {}))
video_agent = VideoAgent(ac.get("video", {}))
rag_agent = RAGAgent(ac.get("consulta", {}))
queue.register_agent("codigo", code_agent.execute)
queue.register_agent("voz", voice_agent.execute)
queue.register_agent("imagen", image_agent.execute)
queue.register_agent("video", video_agent.execute)
queue.register_agent("consulta", rag_agent.execute)
queue.set_opus_bridge(opus)

@asynccontextmanager
async def lifespan(app):
    logger.info("Pod Maestro iniciando...")
    async def cleanup():
        while True:
            await asyncio.sleep(300)
            await queue.cleanup_old_jobs()
    t = asyncio.create_task(cleanup())
    yield
    t.cancel()

app = FastAPI(title="Pod Maestro", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class Instruccion(BaseModel):
    instruccion: str
    app: Optional[str] = None
    auditar: bool = True

class Direct(BaseModel):
    prompt: str
    modelo: Optional[str] = "auto"
    speaker: Optional[str] = None
    language: Optional[str] = "es"
    size: Optional[str] = "1024x1024"
    steps: Optional[int] = 20
    fps: Optional[int] = 24
    duration_seconds: Optional[int] = 4
    negative_prompt: Optional[str] = None
    use_rag: Optional[bool] = True
    video_path: Optional[str] = None
    audio_path: Optional[str] = None

class Knowledge(BaseModel):
    text: str
    metadata: Optional[dict] = None

@app.get("/")
async def root():
    return {"service": "Pod Maestro", "version": "1.0.0",
            "opus": "connected" if opus.client else "offline",
            "agents": ["codigo","voz","imagen","video","consulta"]}

@app.post("/api/orchestrate")
async def orchestrate(req: Instruccion):
    plan = await opus.planificar(req.instruccion)
    pid = await queue.submit_plan(plan)
    return {"plan_id": pid, "plan": plan, "status": "ejecutando"}

@app.get("/api/plans/{pid}")
async def plan_status(pid: str):
    s = queue.get_plan_status(pid)
    if not s.get("total_jobs"): raise HTTPException(404, "Plan no encontrado")
    return s

@app.get("/api/jobs/{jid}")
async def job_status(jid: str):
    j = queue.get_job(jid)
    if not j: raise HTTPException(404, "Job no encontrado")
    return j

@app.post("/api/generate/code")
async def gen_code(req: Direct):
    return await code_agent.execute({"tarea": req.prompt, "prompt": req.prompt, "modelo": req.modelo})

@app.post("/api/generate/voice")
async def gen_voice(req: Direct):
    return await voice_agent.execute({"tarea": req.prompt, "prompt": req.prompt,
            "speaker": req.speaker or "default", "language": req.language})

@app.post("/api/generate/image")
async def gen_image(req: Direct):
    return await image_agent.execute({"tarea": req.prompt, "prompt": req.prompt,
            "size": req.size, "steps": req.steps, "negative_prompt": req.negative_prompt})

@app.post("/api/generate/video")
async def gen_video(req: Direct):
    return await video_agent.execute({"tarea": req.prompt, "prompt": req.prompt,
            "fps": req.fps, "duration_seconds": req.duration_seconds,
            "video_path": req.video_path, "audio_path": req.audio_path})

@app.post("/api/chat")
async def chat(req: Direct):
    return await rag_agent.execute({"tarea": req.prompt, "prompt": req.prompt, "use_rag": req.use_rag})

@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = "es"):
    p = f"/tmp/tr_{audio.filename}"
    with open(p, "wb") as f: f.write(await audio.read())
    r = await voice_agent.execute({"tarea": "transcribir", "audio_file": p, "language": language})
    os.remove(p)
    return r

@app.post("/api/knowledge/add")
async def add_knowledge(req: Knowledge):
    return await rag_agent.add_knowledge(req.text, req.metadata)

@app.post("/api/opus/ask")
async def ask_opus(req: Direct):
    if not opus.client: raise HTTPException(503, "Opus no disponible")
    return {"respuesta": await opus.decidir(req.prompt)}

@app.get("/api/status")
async def status():
    return {"orquestador": "online", "opus": "connected" if opus.client else "offline",
            "queue": queue.get_stats(),
            "agents": {"codigo": await code_agent.health_check(), "voz": await voice_agent.health_check(),
                        "imagen": await image_agent.health_check(), "video": await video_agent.health_check(),
                        "consulta": await rag_agent.health_check()}}

@app.get("/api/outputs/{fn}")
async def get_output(fn: str):
    for d in ["audio","images","video"]:
        p = Path(f"/workspace/outputs/{d}/{fn}")
        if p.exists(): return FileResponse(p)
    p = Path(f"/workspace/outputs/{fn}")
    if p.exists(): return FileResponse(p)
    raise HTTPException(404, "No encontrado")

if __name__ == "__main__":
    for d in ["outputs/audio","outputs/images","outputs/video","logs"]:
        os.makedirs(f"/workspace/{d}", exist_ok=True)
    host = CONFIG.get("server",{}).get("host","0.0.0.0")
    port = CONFIG.get("server",{}).get("port",8000)
    logger.info(f"Pod Maestro -> http://{host}:{port}/docs")
    uvicorn.run("main:app", host=host, port=port, reload=False)
'''

# ══════════════════════════════════════════════════════
# ESCRIBIR TODOS LOS ARCHIVOS
# ══════════════════════════════════════════════════════
print("=" * 50)
print("  INSTALANDO POD MAESTRO")
print("=" * 50)

for path, content in FILES.items():
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content)
    print(f"  OK  {path}")

# Crear directorios extra
for d in ["outputs/audio", "outputs/images", "outputs/video", "logs", "voces", "memoria_secretaria"]:
    os.makedirs(f"/workspace/{d}", exist_ok=True)

print()
print("=" * 50)
print("  ARCHIVOS CREADOS:")
print("=" * 50)
for root, dirs, files in os.walk(BASE):
    for f in sorted(files):
        rel = os.path.relpath(os.path.join(root, f), BASE)
        print(f"  {rel}")
print()
print("  SIGUIENTE:")
print("  1. pip install -r /workspace/orquestador/requirements.txt --break-system-packages")
print("  2. cd /workspace/orquestador && python main.py")
print("  3. curl http://localhost:8000/api/status")
print("=" * 50)
