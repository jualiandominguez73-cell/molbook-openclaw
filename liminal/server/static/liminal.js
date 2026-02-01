// Liminal Creative Showcase
// WebGL Background + Web Audio + Decision Spinner

// ===== WebGL Background Shader =====
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    float noise(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = noise(i);
        float b = noise(i + vec2(1.0, 0.0));
        float c = noise(i + vec2(0.0, 1.0));
        float d = noise(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for(int i = 0; i < 5; i++) {
            value += amplitude * smoothNoise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        
        // Animated noise
        float n = fbm(uv * 3.0 + time * 0.1);
        float n2 = fbm(uv * 5.0 - time * 0.15);
        
        // Purple/cyberpunk color palette
        vec3 purple = vec3(0.6, 0.35, 0.7);
        vec3 dark = vec3(0.04, 0.04, 0.04);
        vec3 accent = vec3(0.9, 0.3, 0.2);
        
        // Mix colors based on noise
        vec3 color = mix(dark, purple, n * 0.3);
        color = mix(color, accent, n2 * 0.1);
        
        // Vignette
        float vignette = 1.0 - length(uv - 0.5) * 0.8;
        color *= vignette;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

let gl, program, timeUniform, resolutionUniform;
let audioContext, isAudioEnabled = false;
let currentMode = 'random';

// Initialize WebGL
function initWebGL() {
    const canvas = document.getElementById('gl-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.log('WebGL not supported');
        return;
    }
    
    // Create shaders
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link failed:', gl.getProgramInfoLog(program));
        return;
    }
    
    // Set up geometry (full-screen quad)
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Get uniform locations
    timeUniform = gl.getUniformLocation(program, 'time');
    resolutionUniform = gl.getUniformLocation(program, 'resolution');
    
    // Start render loop
    requestAnimationFrame(renderWebGL);
}

function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function renderWebGL(time) {
    if (!gl) return;
    
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    
    gl.uniform1f(timeUniform, time * 0.001);
    gl.uniform2f(resolutionUniform, gl.canvas.width, gl.canvas.height);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    requestAnimationFrame(renderWebGL);
}

// ===== Web Audio =====
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    const btn = document.getElementById('audio-btn');
    btn.textContent = isAudioEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !isAudioEnabled);
    
    if (isAudioEnabled) {
        initAudio();
        startAmbientDrone();
    }
}

function startAmbientDrone() {
    if (!isAudioEnabled || !audioContext) return;
    
    // Create a simple drone using oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 55; // A1
    gainNode.gain.value = 0.05;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    // Modulate for movement
    setInterval(() => {
        if (isAudioEnabled) {
            oscillator.frequency.value = 55 + Math.random() * 10;
        }
    }, 5000);
}

function playClickSound() {
    if (!isAudioEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playSpinSound() {
    if (!isAudioEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}

function playWinSound() {
    if (!isAudioEnabled || !audioContext) return;
    
    const notes = [440, 554, 659]; // A major chord
    notes.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        
        const now = audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1 + i * 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(now + i * 0.1);
        oscillator.stop(now + 1.5);
    });
}

// ===== Decision Spinner =====
function addTerminalLine(text, delay = 0) {
    const terminal = document.getElementById('terminal');
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.textContent = text;
    line.style.animationDelay = `${delay}s`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '<div class="terminal-line">Ready.</div>';
}

function spin() {
    playSpinSound();
    
    const input = document.getElementById('options-input').value;
    const options = input.split(',').map(s => s.trim()).filter(s => s);
    
    if (options.length < 2) {
        addTerminalLine('Error: Need at least 2 options.');
        return;
    }
    
    addTerminalLine(`Mode: ${currentMode.toUpperCase()}`);
    addTerminalLine(`Options: ${options.join(', ')}`);
    addTerminalLine('Spinning...', 0.2);
    
    // Simulate spinning animation
    let spins = 0;
    const maxSpins = 10 + Math.floor(Math.random() * 5);
    
    const spinInterval = setInterval(() => {
        const randomOption = options[Math.floor(Math.random() * options.length)];
        addTerminalLine(`→ ${randomOption}`, 0);
        playClickSound();
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            // Final result
            setTimeout(() => {
                const result = options[Math.floor(Math.random() * options.length)];
                playWinSound();
                addTerminalLine('');
                addTerminalLine('✨ RESULT ✨', 0.1);
                addTerminalLine(`→ ${result} ←`, 0.2);
                addTerminalLine('', 0.3);
                addTerminalLine('(Remember: No wrong choices, only paths forward.)', 0.4);
            }, 300);
        }
    }, 100 + (spins * 20)); // Get slower
}

function showSource() {
    addTerminalLine('');
    addTerminalLine('📄 Source: /home/liam/liminal/projects/decision-spinner/spinner.py');
    addTerminalLine('📖 README: /home/liam/liminal/projects/decision-spinner/README.md');
    addTerminalLine('');
    addTerminalLine('Run locally: python spinner.py "A" "B" "C"');
}

// Mode selector
function initModeSelector() {
    const buttons = document.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            playClickSound();
        });
    });
}

// Load principles
async function loadPrinciples() {
    try {
        const response = await fetch('/api/principles');
        const data = await response.json();
        if (data.success) {
            const text = data.data.content;
            // Extract just the core principles for display
            const lines = text.split('\n');
            let displayText = '';
            let inCore = false;
            for (const line of lines) {
                if (line.includes('Core Rule')) inCore = true;
                if (inCore && line.startsWith('##')) displayText += line + '\n';
                if (inCore && line.startsWith('**')) displayText += line + '\n';
            }
            document.getElementById('principles-text').textContent = displayText || text.slice(0, 500) + '...';
        }
    } catch (e) {
        document.getElementById('principles-text').textContent = 'Never finished. Always evolving.';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initWebGL();
    initModeSelector();
    loadPrinciples();
    
    // Handle resize
    window.addEventListener('resize', () => {
        if (gl) {
            gl.canvas.width = window.innerWidth;
            gl.canvas.height = window.innerHeight;
        }
    });
});
