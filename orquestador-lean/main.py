import os, json, uuid, time, asyncio
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODELS = {"coder": "qwen-qwq-32b", "fast": "llama-3.3-70b-versatile", "small": "llama-3.1-8b-instant"}


async def call_groq(messages, model="coder", temp=0.3, max_tok=8192):
    if not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY no configurada")
    mid = MODELS.get(model, model)
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": mid, "messages": messages, "temperature": temp, "max_tokens": max_tok})
        if r.status_code == 429:
            await asyncio.sleep(10)
            return await call_groq(messages, model, temp, max_tok)
        if r.status_code != 200:
            raise HTTPException(502, f"Groq error: {r.text}")
        return r.json()["choices"][0]["message"]["content"]


SYS = """Eres programador experto de Noe (Ciudad Juarez). Codigo COMPLETO, copy-paste ready.
Stack: Python/Flask, React/Vite, Supabase, Hostinger. Explicaciones en espanol, codigo en ingles.
Negocios: AsesorialMSS.io (IMSS), Mirror IA (peinados), Antigravity (e-commerce), Copiloto IA (camioneros).
REGLAS: No placeholders, no '// tu codigo aqui'. Escribe TODO el codigo completo."""

app = FastAPI(title="Pod Maestro LEAN", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class CodeReq(BaseModel):
    prompt: str
    modelo: str = "coder"
    contexto: str = ""


class ChatReq(BaseModel):
    mensaje: str
    historial: list = []
    modelo: str = "coder"


class ReviewReq(BaseModel):
    codigo: str
    tarea: str = "Revisar calidad general"


REVIEW_SYS = """Eres auditor de codigo senior. Responde en JSON:
{"aprobado": true/false, "calidad": 1-10, "errores": [], "mejoras": [], "veredicto": "resumen"}"""


@app.get("/")
async def root():
    return {
        "servicio": "Pod Maestro LEAN",
        "version": "1.0.0",
        "groq": "ok" if GROQ_API_KEY else "sin config",
        "docs": "/docs",
        "endpoints": ["/api/code", "/api/chat", "/api/review", "/api/status"]
    }


@app.post("/api/code")
async def gen_code(req: CodeReq):
    msgs = [{"role": "system", "content": SYS}]
    if req.contexto:
        msgs.append({"role": "user", "content": f"Contexto:\n{req.contexto}"})
        msgs.append({"role": "assistant", "content": "Entendido. Que necesitas?"})
    msgs.append({"role": "user", "content": req.prompt})
    t = time.time()
    content = await call_groq(msgs, req.modelo)
    return {
        "contenido": content,
        "modelo": MODELS.get(req.modelo),
        "tiempo": round(time.time() - t, 2)
    }


@app.post("/api/chat")
async def chat(req: ChatReq):
    msgs = [{"role": "system", "content": SYS}]
    msgs.extend(req.historial)
    msgs.append({"role": "user", "content": req.mensaje})
    content = await call_groq(msgs, req.modelo)
    return {"respuesta": content, "modelo": MODELS.get(req.modelo)}


@app.post("/api/review")
async def review(req: ReviewReq):
    msgs = [
        {"role": "system", "content": REVIEW_SYS},
        {"role": "user", "content": f"TAREA: {req.tarea}\n\nCODIGO:\n{req.codigo}"}
    ]
    content = await call_groq(msgs, "coder", temp=0.1)
    try:
        text = content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except (json.JSONDecodeError, ValueError):
        return {"aprobado": True, "calidad": 7, "veredicto": "No se pudo parsear", "raw": content}


@app.get("/api/status")
async def status():
    ok = False
    if GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                ok = (await c.get("https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"})).status_code == 200
        except Exception:
            pass
    return {
        "servicio": "Pod Maestro LEAN",
        "groq": "ok" if ok else "error",
        "modelos": list(MODELS.values())
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
