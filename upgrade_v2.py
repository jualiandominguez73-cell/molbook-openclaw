#!/usr/bin/env python3
"""
upgrade_v2.py — Pod Maestro v2.0 Upgrade
Crea: db_manager.py, dashboard_v2.html, parchea main.py, fix queue
Uso: python3 upgrade_v2.py
"""
import os

BASE = "/workspace/orquestador"
FILES = {}

# ══════════════════════════════════════════════════════
# db_manager.py — SQLite Database
# ══════════════════════════════════════════════════════
FILES["db_manager.py"] = r'''import sqlite3, json, time, uuid, os
from contextlib import contextmanager
from loguru import logger

DB_PATH = os.environ.get("POD_MAESTRO_DB", "/workspace/pod_maestro.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

@contextmanager
def db():
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            agent TEXT DEFAULT 'chat',
            project TEXT DEFAULT '',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            agent TEXT DEFAULT '',
            model TEXT DEFAULT '',
            tokens INTEGER DEFAULT 0,
            duration REAL DEFAULT 0,
            created_at REAL NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS jobs_history (
            id TEXT PRIMARY KEY,
            plan_id TEXT DEFAULT '',
            agent TEXT NOT NULL,
            task TEXT NOT NULL,
            prompt TEXT DEFAULT '',
            status TEXT NOT NULL,
            result TEXT DEFAULT '',
            error TEXT DEFAULT '',
            tokens INTEGER DEFAULT 0,
            duration REAL DEFAULT 0,
            model TEXT DEFAULT '',
            project TEXT DEFAULT '',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS knowledge_catalog (
            id TEXT PRIMARY KEY,
            chromadb_id TEXT DEFAULT '',
            source TEXT DEFAULT '',
            doc_type TEXT DEFAULT '',
            preview TEXT DEFAULT '',
            char_count INTEGER DEFAULT 0,
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS generated_files (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filetype TEXT NOT NULL,
            agent TEXT DEFAULT '',
            prompt TEXT DEFAULT '',
            size_bytes INTEGER DEFAULT 0,
            project TEXT DEFAULT '',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS github_pushes (
            id TEXT PRIMARY KEY,
            branch TEXT NOT NULL,
            filepath TEXT NOT NULL,
            commit_msg TEXT DEFAULT '',
            sha TEXT DEFAULT '',
            project TEXT DEFAULT '',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS previews (
            id TEXT PRIMARY KEY,
            port INTEGER NOT NULL,
            filepath TEXT NOT NULL,
            name TEXT DEFAULT '',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            color TEXT DEFAULT '#00e5a0',
            created_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_agent ON jobs_history(agent);
        CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs_history(created_at);
        CREATE INDEX IF NOT EXISTS idx_files_type ON generated_files(filetype);
        """)
    logger.info(f"[DB] SQLite inicializada: {DB_PATH}")

# ─── CHATS ───
def create_chat(name="Nueva conversación", agent="chat", project=""):
    cid = f"chat_{uuid.uuid4().hex[:8]}"
    now = time.time()
    with db() as conn:
        conn.execute("INSERT INTO chats VALUES (?,?,?,?,?,?)", (cid, name, agent, project, now, now))
    return cid

def get_chats(limit=50):
    with db() as conn:
        rows = conn.execute("SELECT * FROM chats ORDER BY updated_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]

def get_chat(cid):
    with db() as conn:
        r = conn.execute("SELECT * FROM chats WHERE id=?", (cid,)).fetchone()
    return dict(r) if r else None

def update_chat(cid, name=None):
    with db() as conn:
        if name:
            conn.execute("UPDATE chats SET name=?, updated_at=? WHERE id=?", (name, time.time(), cid))
        else:
            conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (time.time(), cid))

def delete_chat(cid):
    with db() as conn:
        conn.execute("DELETE FROM chats WHERE id=?", (cid,))

# ─── MESSAGES ───
def add_message(chat_id, role, content, agent="", model="", tokens=0, duration=0):
    mid = f"msg_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?)",
                     (mid, chat_id, role, content, agent, model, tokens, duration, time.time()))
        conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (time.time(), chat_id))
    return mid

def get_messages(chat_id, limit=200):
    with db() as conn:
        rows = conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC LIMIT ?",
                           (chat_id, limit)).fetchall()
    return [dict(r) for r in rows]

# ─── JOBS HISTORY ───
def log_job(agent, task, prompt="", status="completed", result="", error="", tokens=0, duration=0, model="", plan_id="", project=""):
    jid = f"jh_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO jobs_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (jid, plan_id, agent, task, prompt, status, result[:5000], error, tokens, duration, model, project, time.time()))
    return jid

# ─── KNOWLEDGE CATALOG ───
def log_knowledge(chromadb_id, source="", doc_type="", preview="", char_count=0):
    kid = f"kn_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO knowledge_catalog VALUES (?,?,?,?,?,?,?)",
                     (kid, chromadb_id, source, doc_type, preview[:200], char_count, time.time()))
    return kid

def get_knowledge_catalog(limit=100):
    with db() as conn:
        rows = conn.execute("SELECT * FROM knowledge_catalog ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]

# ─── FILES ───
def log_file(filename, filepath, filetype, agent="", prompt="", size_bytes=0, project=""):
    fid = f"fl_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO generated_files VALUES (?,?,?,?,?,?,?,?,?)",
                     (fid, filename, filepath, filetype, agent, prompt[:500], size_bytes, project, time.time()))
    return fid

def get_files(filetype=None, limit=50):
    with db() as conn:
        if filetype:
            rows = conn.execute("SELECT * FROM generated_files WHERE filetype=? ORDER BY created_at DESC LIMIT ?",
                               (filetype, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM generated_files ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]

# ─── GITHUB ───
def log_github_push(branch, filepath, commit_msg="", sha="", project=""):
    gid = f"gh_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO github_pushes VALUES (?,?,?,?,?,?,?)",
                     (gid, branch, filepath, commit_msg, sha, project, time.time()))
    return gid

def get_github_pushes(limit=30):
    with db() as conn:
        rows = conn.execute("SELECT * FROM github_pushes ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]

# ─── SETTINGS ───
def get_setting(key, default=""):
    with db() as conn:
        r = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return r["value"] if r else default

def set_setting(key, value):
    with db() as conn:
        conn.execute("INSERT OR REPLACE INTO settings VALUES (?,?,?)", (key, str(value), time.time()))

# ─── PROJECTS ───
def create_project(name, description="", color="#00e5a0"):
    pid = f"proj_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO projects VALUES (?,?,?,?,?)", (pid, name, description, color, time.time()))
    return pid

def get_projects():
    with db() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

# ─── STATS ───
def get_stats(days=7):
    import time as t
    cutoff = t.time() - (days * 86400)
    with db() as conn:
        total_jobs = conn.execute("SELECT COUNT(*) c FROM jobs_history WHERE created_at>?", (cutoff,)).fetchone()["c"]
        total_tokens = conn.execute("SELECT COALESCE(SUM(tokens),0) t FROM jobs_history WHERE created_at>?", (cutoff,)).fetchone()["t"]
        by_agent = conn.execute("SELECT agent, COUNT(*) c, COALESCE(SUM(tokens),0) t FROM jobs_history WHERE created_at>? GROUP BY agent", (cutoff,)).fetchall()
        total_msgs = conn.execute("SELECT COUNT(*) c FROM messages WHERE created_at>?", (cutoff,)).fetchone()["c"]
        total_files = conn.execute("SELECT COUNT(*) c FROM generated_files WHERE created_at>?", (cutoff,)).fetchone()["c"]
        total_knowledge = conn.execute("SELECT COUNT(*) c FROM knowledge_catalog").fetchone()["c"]
        total_pushes = conn.execute("SELECT COUNT(*) c FROM github_pushes WHERE created_at>?", (cutoff,)).fetchone()["c"]
    return {
        "days": days, "total_jobs": total_jobs, "total_tokens": total_tokens,
        "total_messages": total_msgs, "total_files": total_files,
        "total_knowledge": total_knowledge, "total_pushes": total_pushes,
        "by_agent": [{"agent": r["agent"], "jobs": r["c"], "tokens": r["t"]} for r in by_agent]
    }

# ─── PREVIEWS ───
def add_preview(port, filepath, name=""):
    pid = f"pv_{uuid.uuid4().hex[:8]}"
    with db() as conn:
        conn.execute("INSERT INTO previews VALUES (?,?,?,?,?)", (pid, port, filepath, name, time.time()))
    return pid

def get_previews():
    with db() as conn:
        rows = conn.execute("SELECT * FROM previews ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]

def delete_preview(pid):
    with db() as conn:
        conn.execute("DELETE FROM previews WHERE id=?", (pid,))
'''

# ══════════════════════════════════════════════════════
# github_manager.py — Git operations
# ══════════════════════════════════════════════════════
FILES["github_manager.py"] = r'''import subprocess, os
from loguru import logger

REPO_PATH = "/workspace/pod-maestro"

def git_push(content, filepath, branch="main", commit_msg="", repo_path=REPO_PATH):
    """Write file, commit, and push to GitHub"""
    full_path = os.path.join(repo_path, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "w") as f:
        f.write(content)

    if not commit_msg:
        commit_msg = f"Pod Maestro: update {filepath}"

    try:
        cwd = repo_path
        subprocess.run(["git", "add", filepath], cwd=cwd, capture_output=True, text=True, check=True)
        r = subprocess.run(["git", "commit", "-m", commit_msg], cwd=cwd, capture_output=True, text=True)
        if r.returncode != 0 and "nothing to commit" in r.stdout:
            return {"status": "no_changes", "message": "Nothing to commit"}

        r = subprocess.run(["git", "push", "origin", branch], cwd=cwd, capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, text=True).stdout.strip()[:8]
            logger.info(f"[GIT] Pushed {filepath} to {branch} ({sha})")
            return {"status": "ok", "sha": sha, "branch": branch, "filepath": filepath}
        else:
            return {"status": "error", "error": r.stderr}
    except Exception as e:
        logger.error(f"[GIT] {e}")
        return {"status": "error", "error": str(e)}

def git_branches(repo_path=REPO_PATH):
    try:
        r = subprocess.run(["git", "branch", "-a"], cwd=repo_path, capture_output=True, text=True)
        branches = [b.strip().replace("* ", "") for b in r.stdout.strip().split("\n") if b.strip()]
        return [b for b in branches if not b.startswith("remotes/")]
    except:
        return ["main"]
'''

# ══════════════════════════════════════════════════════
# preview_server.py — Temporary preview server
# ══════════════════════════════════════════════════════
FILES["preview_server.py"] = r'''import os, uuid, subprocess, signal
from pathlib import Path
from loguru import logger

PREVIEW_DIR = "/workspace/previews"
PREVIEW_PORT_START = 8889
active_servers = {}

def create_preview(html_content, name="preview"):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    pid = uuid.uuid4().hex[:8]
    filename = f"{name}_{pid}.html"
    filepath = os.path.join(PREVIEW_DIR, filename)

    with open(filepath, "w") as f:
        f.write(html_content)

    port = PREVIEW_PORT_START + len(active_servers)
    try:
        proc = subprocess.Popen(
            ["python3", "-m", "http.server", str(port), "--directory", PREVIEW_DIR],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        active_servers[pid] = {"port": port, "proc": proc, "filepath": filepath, "filename": filename, "name": name}
        logger.info(f"[PREVIEW] {name} -> port {port}")
        return {"id": pid, "port": port, "filename": filename, "filepath": filepath,
                "local_url": f"http://localhost:{port}/{filename}"}
    except Exception as e:
        return {"error": str(e)}

def list_previews():
    result = []
    for pid, info in active_servers.items():
        alive = info["proc"].poll() is None
        result.append({"id": pid, "port": info["port"], "name": info["name"],
                       "filename": info["filename"], "alive": alive})
    return result

def kill_preview(pid):
    if pid in active_servers:
        try:
            active_servers[pid]["proc"].terminate()
        except:
            pass
        del active_servers[pid]
        return True
    return False
'''

print("=" * 50)
print("  UPGRADE POD MAESTRO v2.0")
print("=" * 50)

# Write new module files
for path, content in FILES.items():
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content)
    print(f"  OK  {path}")

# ══════════════════════════════════════════════════════
# PATCH main.py — Add new endpoints
# ══════════════════════════════════════════════════════
main_path = os.path.join(BASE, "main.py")
with open(main_path, "r") as f:
    main_content = f.read()

# Only patch if not already v2
if "db_manager" not in main_content:
    NEW_IMPORTS = """
import subprocess, time as _time
from db_manager import *
from github_manager import git_push, git_branches
from preview_server import create_preview, list_previews, kill_preview
"""

    NEW_ENDPOINTS = '''

# ─── V2 ENDPOINTS ───

# DB Init on startup
init_db()

# --- CHATS ---
class ChatCreate(BaseModel):
    name: Optional[str] = "Nueva conversación"
    agent: Optional[str] = "chat"
    project: Optional[str] = ""

class MessageCreate(BaseModel):
    chat_id: str
    role: str
    content: str
    agent: Optional[str] = ""
    model: Optional[str] = ""
    tokens: Optional[int] = 0
    duration: Optional[float] = 0

@app.get("/api/db/chats")
async def api_get_chats():
    return get_chats()

@app.post("/api/db/chats")
async def api_create_chat(req: ChatCreate):
    cid = create_chat(req.name, req.agent, req.project)
    return {"chat_id": cid}

@app.get("/api/db/chats/{cid}")
async def api_get_chat(cid: str):
    chat = get_chat(cid)
    if not chat: raise HTTPException(404)
    msgs = get_messages(cid)
    return {**chat, "messages": msgs}

@app.put("/api/db/chats/{cid}")
async def api_update_chat(cid: str, req: ChatCreate):
    update_chat(cid, req.name)
    return {"ok": True}

@app.delete("/api/db/chats/{cid}")
async def api_delete_chat(cid: str):
    delete_chat(cid)
    return {"ok": True}

@app.post("/api/db/messages")
async def api_add_message(req: MessageCreate):
    mid = add_message(req.chat_id, req.role, req.content, req.agent, req.model, req.tokens, req.duration)
    return {"message_id": mid}

# --- STATS ---
@app.get("/api/db/stats")
async def api_stats(days: int = 7):
    return get_stats(days)

# --- GPU ---
@app.get("/api/gpu")
async def api_gpu():
    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu",
                           "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5)
        parts = [p.strip() for p in r.stdout.strip().split(",")]
        return {"gpu_name": parts[0], "vram_total_mb": int(parts[1]), "vram_used_mb": int(parts[2]),
                "vram_free_mb": int(parts[3]), "gpu_util_pct": int(parts[4]), "temp_c": int(parts[5]),
                "vram_pct": round(int(parts[2]) / int(parts[1]) * 100, 1)}
    except Exception as e:
        return {"error": str(e)}

# --- LOGS ---
@app.get("/api/logs")
async def api_logs(lines: int = 50):
    try:
        log_path = "/workspace/logs/pod_maestro.log"
        if not os.path.exists(log_path):
            r = subprocess.run(["journalctl", "-u", "pod-maestro", "-n", str(lines), "--no-pager"],
                              capture_output=True, text=True, timeout=5)
            return {"lines": r.stdout.split("\\n") if r.stdout else ["No logs available"]}
        with open(log_path) as f:
            all_lines = f.readlines()
        return {"lines": [l.strip() for l in all_lines[-lines:]]}
    except Exception as e:
        return {"lines": [f"Error: {e}"]}

# --- UPTIME ---
_start_time = _time.time()

@app.get("/api/uptime")
async def api_uptime():
    elapsed = _time.time() - _start_time
    hours = int(elapsed // 3600)
    mins = int((elapsed % 3600) // 60)
    secs = int(elapsed % 60)
    return {"seconds": elapsed, "formatted": f"{hours}h {mins}m {secs}s"}

# --- GITHUB ---
class GitPushReq(BaseModel):
    content: str
    filepath: str
    branch: Optional[str] = "main"
    commit_msg: Optional[str] = ""
    project: Optional[str] = ""

@app.post("/api/github/push")
async def api_git_push(req: GitPushReq):
    result = git_push(req.content, req.filepath, req.branch, req.commit_msg)
    if result.get("status") == "ok":
        log_github_push(req.branch, req.filepath, req.commit_msg, result.get("sha", ""), req.project)
    return result

@app.get("/api/github/branches")
async def api_git_branches():
    return {"branches": git_branches()}

@app.get("/api/github/history")
async def api_git_history():
    return get_github_pushes()

# --- PREVIEW ---
class PreviewReq(BaseModel):
    html: str
    name: Optional[str] = "preview"

@app.post("/api/preview/create")
async def api_create_preview(req: PreviewReq):
    result = create_preview(req.html, req.name)
    if not result.get("error"):
        from db_manager import add_preview as db_add_preview
        db_add_preview(result["port"], result["filepath"], req.name)
    return result

@app.get("/api/preview/list")
async def api_list_previews():
    return list_previews()

@app.delete("/api/preview/{pid}")
async def api_kill_preview(pid: str):
    return {"killed": kill_preview(pid)}

# --- KNOWLEDGE SEARCH ---
class SearchReq(BaseModel):
    query: str
    n: Optional[int] = 5

@app.post("/api/knowledge/search")
async def api_search_knowledge(req: SearchReq):
    try:
        context = await rag_agent._search(req.query, req.n)
        return {"results": context.split("\\n---\\n") if context else [], "query": req.query}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/knowledge/catalog")
async def api_knowledge_catalog():
    return get_knowledge_catalog()

# --- FILES HISTORY ---
@app.get("/api/db/files")
async def api_get_files(filetype: str = None):
    return get_files(filetype)

# --- PROJECTS ---
class ProjectReq(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#00e5a0"

@app.post("/api/db/projects")
async def api_create_project(req: ProjectReq):
    pid = create_project(req.name, req.description, req.color)
    return {"project_id": pid}

@app.get("/api/db/projects")
async def api_get_projects():
    return get_projects()

# --- SETTINGS ---
class SettingReq(BaseModel):
    key: str
    value: str

@app.get("/api/settings/{key}")
async def api_get_setting(key: str):
    return {"key": key, "value": get_setting(key)}

@app.post("/api/settings")
async def api_set_setting(req: SettingReq):
    set_setting(req.key, req.value)
    return {"ok": True}

# --- OLLAMA MODELS ---
@app.get("/api/models")
async def api_models():
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get("http://127.0.0.1:11434/api/tags")
            models = r.json().get("models", [])
            return [{"name": m["name"], "size": m.get("size", 0), "modified": m.get("modified_at", "")} for m in models]
    except:
        return []
'''

    # Insert imports after existing imports
    if "from loguru import logger" in main_content:
        main_content = main_content.replace(
            "from loguru import logger",
            "from loguru import logger" + NEW_IMPORTS
        )
    
    # Insert endpoints before __main__
    if 'if __name__' in main_content:
        main_content = main_content.replace('if __name__', NEW_ENDPOINTS + '\nif __name__')
    
    # Add loguru file logging
    main_content = main_content.replace(
        'def load_config():',
        'from loguru import logger as _lg\n_lg.add("/workspace/logs/pod_maestro.log", rotation="10 MB", retention="7 days")\n\ndef load_config():'
    )

    with open(main_path, "w") as f:
        f.write(main_content)
    print("  OK  main.py parcheado con endpoints v2")
else:
    print("  OK  main.py ya tiene v2")

# ══════════════════════════════════════════════════════
# FIX queue_manager.py — Failed dependencies
# ══════════════════════════════════════════════════════
qm_path = os.path.join(BASE, "queue_manager.py")
with open(qm_path, "r") as f:
    qm = f.read()

if "FAILED_DEPENDENCY" not in qm:
    # Add new status
    qm = qm.replace(
        'REJECTED = "rejected"',
        'REJECTED = "rejected"\n    FAILED_DEPENDENCY = "failed_dependency"'
    )
    # Fix the process loop to handle failed dependencies
    old_deps = """            for j in pending:
                deps_ok = all(
                    self.jobs.get(st_map.get(d), Job(id="",plan_id="",subtarea={})).status == JobStatus.COMPLETED
                    for d in j.dependencias if st_map.get(d)
                )
                if deps_ok and self._running < self.max_concurrent:
                    asyncio.create_task(self._run(j))"""
    
    new_deps = """            for j in pending:
                deps_failed = any(
                    self.jobs.get(st_map.get(d), Job(id="",plan_id="",subtarea={})).status in (JobStatus.FAILED, JobStatus.REJECTED, JobStatus.FAILED_DEPENDENCY)
                    for d in j.dependencias if st_map.get(d)
                )
                if deps_failed:
                    j.status = JobStatus.FAILED_DEPENDENCY
                    j.error = "Dependencia falló"
                    j.completed_at = time.time()
                    continue
                deps_ok = all(
                    self.jobs.get(st_map.get(d), Job(id="",plan_id="",subtarea={})).status == JobStatus.COMPLETED
                    for d in j.dependencias if st_map.get(d)
                )
                if deps_ok and self._running < self.max_concurrent:
                    asyncio.create_task(self._run(j))"""
    
    qm = qm.replace(old_deps, new_deps)
    
    with open(qm_path, "w") as f:
        f.write(qm)
    print("  OK  queue_manager.py — fix dependencias fallidas")
else:
    print("  OK  queue_manager.py ya parcheado")

# Create directories
for d in ["previews", "logs"]:
    os.makedirs(f"/workspace/{d}", exist_ok=True)

print()
print("  BACKEND v2 COMPLETO")
print("  Ahora copia dashboard_v2.html:")
print("  cp /workspace/pod-maestro/dashboard_v2.html /workspace/orquestador/dashboard.html")
print("  Reinicia: pkill -f 'python main.py' && cd /workspace/orquestador && python main.py &")
print("=" * 50)
