# Liminal Window — Build Plan

**Status:** Approved and Ready  
**Saved:** 2026-01-31 21:34 PST  

---

## Hybrid Architecture (Approved)

### 1. Dashboard Extension (Port 8080)
**Purpose:** Utilitarian view — file browser, status board  
**Stack:** Python (existing dashboard)  
**Route:** `/liminal/`  
**Content:**
- File browser for /home/liam/liminal/
- Project status board
- PRINCIPLES.md viewer

### 2. Liminal Creative Server (Port 8081)
**Purpose:** The fun showcase — creative, interactive, alive  
**Stack:** 
- Backend: Rust (Actix-web)  
- Frontend: Vanilla JS + WebGL + Web Audio

**Features:**
- **Decision Spinner** — Animated terminal, visualized in Canvas/WebGL
- **Principles** — Living manifesto, scrolling/animated
- **WebGL Shaders** — Liminal aesthetic (glitch, noise, threshold effects)
- **Web Audio** — Generative ambient soundscape
- **Real-time** — Always shifting, always alive

**Vibe:** Cyberpunk studio at 3am. Code and creativity bleeding together. Everything slightly unstable — in a good way.

---

## Machine Specs (Verified)
- Rust: 1.93.0 ✅
- CPU: 32 cores (AMD Ryzen AI MAX+ 395) ✅
- RAM: 31GB available ✅
- Dashboard: Running on 8080 ✅

---

## Build Order
1. Dashboard extension (file browser, status board)
2. Rust server scaffold (Actix-web, port 8081)
3. WebGL shader pipeline (liminal aesthetic)
4. Web Audio generative system
5. Decision Spinner visualization
6. Principles manifesto display
7. Integration & polish

---

## Creative Stack Details

### WebGL Shaders
- Glitch effects
- Scanlines
- Noise/grain
- Threshold transitions
- Ambient animation

### Web Audio
- Generative drones
- Satisfying UI sounds (spinner clicks, whooshes)
- Adaptive to interaction

### Decision Spinner Visualization
- Canvas-based terminal emulator
- Animated text rendering
- Mode switching animations
- Result celebration effects

---

*Plan saved. Ready to build after gateway restart.*
