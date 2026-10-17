import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Download, Compass } from 'lucide-react';

interface StudioViewportProps {
  equation: string;
  domainScale?: number;
  palette?: 'emerald' | 'solar' | 'cosmic' | 'sdf';
}

export function StudioViewport({
  equation,
  domainScale = 1.8,
  palette = 'emerald',
}: StudioViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0.0);
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number; val: number } | null>(null);
  const [currentPalette, setCurrentPalette] = useState<'emerald' | 'solar' | 'cosmic' | 'sdf'>(palette);

  // WebGL2 Shader setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return;
    glRef.current = gl;

    const vsSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    let glslExpr = equation
      .replace(/atan2\(/g, "atan(")
      .replace(/pi/g, "3.14159265")
      .replace(/e/g, "2.71828182");

    // Palette fragment shader
    let paletteCode = '';
    if (currentPalette === 'emerald') {
      paletteCode = `
        vec3 dark = vec3(0.04, 0.06, 0.08);
        vec3 emerald = vec3(0.06, 0.72, 0.51); // #10b981
        vec3 mint = vec3(0.25, 0.92, 0.78);
        vec3 amber = vec3(0.95, 0.65, 0.18);
        float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        col = mix(dark, emerald, smoothstep(0.1, 0.55, elev));
        col = mix(col, mint, smoothstep(0.55, 0.85, elev));
        col = mix(col, amber, smoothstep(0.85, 1.0, elev));
      `;
    } else if (currentPalette === 'solar') {
      paletteCode = `
        vec3 dark = vec3(0.05, 0.02, 0.04);
        vec3 purple = vec3(0.55, 0.12, 0.65);
        vec3 orange = vec3(0.96, 0.45, 0.12);
        vec3 yellow = vec3(0.98, 0.88, 0.25);
        float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        col = mix(dark, purple, smoothstep(0.1, 0.5, elev));
        col = mix(col, orange, smoothstep(0.5, 0.8, elev));
        col = mix(col, yellow, smoothstep(0.8, 1.0, elev));
      `;
    } else if (currentPalette === 'cosmic') {
      paletteCode = `
        vec3 dark = vec3(0.03, 0.04, 0.09);
        vec3 indigo = vec3(0.35, 0.25, 0.85);
        vec3 cyan = vec3(0.12, 0.78, 0.95);
        float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        col = mix(dark, indigo, smoothstep(0.15, 0.6, elev));
        col = mix(col, cyan, smoothstep(0.6, 0.95, elev));
      `;
    } else {
      paletteCode = `
        float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        col = vec3(elev);
      `;
    }

    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_domain;

      float safe_div(float a, float b) {
        return a / (abs(b) < 1e-6 ? 1e-6 : b);
      }
      float safe_sqrt(float v) {
        return sqrt(max(v, 0.0));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        float x = uv.x * u_domain;
        float y = uv.y * u_domain;
        float t = u_time;

        float val = 0.0;
        val = ${glslExpr};

        vec3 col = vec3(0.0);
        ${paletteCode}

        // Elegant continuous point-cloud grid contouring
        vec2 grid = fract(gl_FragCoord.xy / 5.0);
        float dotMask = smoothstep(0.45, 0.2, length(grid - vec2(0.5)));
        col = mix(col * 0.6, col * 1.35, dotMask);

        // Soft vignette
        float vignette = 1.0 - smoothstep(0.9, 1.6, length(uv));
        col *= vignette;

        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };

    try {
      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      programRef.current = program;

      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const posLoc = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    } catch (e) {
      // Shaders will update cleanly on next edit
    }
  }, [equation, currentPalette]);

  // Render loop
  useEffect(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    const render = () => {
      if (isPlaying) {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000.0) * playbackSpeed + pausedTimeRef.current;
        setCurrentTime(elapsed);
      }

      if (programRef.current) {
        gl.useProgram(programRef.current);
        const resLoc = gl.getUniformLocation(programRef.current, 'u_resolution');
        const timeLoc = gl.getUniformLocation(programRef.current, 'u_time');
        const domLoc = gl.getUniformLocation(programRef.current, 'u_domain');

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, currentTime);
        gl.uniform1f(domLoc, domainScale);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, currentTime, domainScale]);

  // Canvas Mouse Move Inspector
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
    const x = nx * domainScale;
    const y = ny * domainScale;
    setMouseCoords({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), val: Number((Math.sin(x * 5 + y * 5)).toFixed(3)) });
  };

  const handleDownloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixmath_synthesis_t${currentTime.toFixed(2)}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-[#0a0d11] rounded-2xl border border-[#1b222b] overflow-hidden group select-none">
      {/* ── Ambient Radial Glow (from des2 design language) ─── */}
      <div className="absolute -bottom-10 left-1/4 right-1/4 h-32 bg-[#10b981] filter blur-[90px] opacity-25 rounded-full pointer-events-none z-0" />

      {/* ── WebGL Canvas ───────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouseCoords(null)}
        className="w-full h-full object-cover z-10 cursor-crosshair"
      />

      {/* ── Real-time Coordinate HUD (Top Left) ────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-[#101419]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#212934] shadow-lg text-xs font-mono text-slate-300">
        <Compass className="w-3.5 h-3.5 text-[#10b981]" />
        <span>x: {mouseCoords ? (mouseCoords.x >= 0 ? `+${mouseCoords.x}` : mouseCoords.x) : '0.000'}</span>
        <span className="text-slate-600">|</span>
        <span>y: {mouseCoords ? (mouseCoords.y >= 0 ? `+${mouseCoords.y}` : mouseCoords.y) : '0.000'}</span>
        <span className="text-slate-600">|</span>
        <span className="text-[#10b981]">Domain: [-{domainScale.toFixed(1)}, +{domainScale.toFixed(1)}]²</span>
      </div>

      {/* ── Color Palette Pills (Top Right) ────────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-[#101419]/90 backdrop-blur-md p-1 rounded-full border border-[#212934] shadow-lg text-xs font-mono">
        {(['emerald', 'solar', 'cosmic', 'sdf'] as const).map((pal) => (
          <button
            key={pal}
            onClick={() => setCurrentPalette(pal)}
            className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold transition-all ${
              currentPalette === pal
                ? 'bg-[#1a232f] text-[#10b981] border border-[#10b981]/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {pal}
          </button>
        ))}
      </div>

      {/* ── Interactive Playback Controller (Floating Bottom Pill) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3 bg-[#11161d]/90 backdrop-blur-md px-5 py-2 rounded-full border border-[#232b36] shadow-2xl text-xs text-slate-300">
        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-7 h-7 rounded-full bg-[#10b981] text-black flex items-center justify-center hover:bg-[#059669] transition shadow-md"
          title={isPlaying ? 'Pause Synthesis' : 'Play Synthesis'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Time Scrubber */}
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[11px] text-slate-400 w-12 text-right">
            t: {currentTime.toFixed(2)}s
          </span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.05"
            value={currentTime % 10}
            onChange={(e) => {
              setCurrentTime(parseFloat(e.target.value));
              pausedTimeRef.current = parseFloat(e.target.value);
              startTimeRef.current = Date.now();
            }}
            className="w-36 h-1.5 bg-[#1f2732] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
          />
        </div>

        {/* Reset */}
        <button
          onClick={() => {
            setCurrentTime(0.0);
            pausedTimeRef.current = 0;
            startTimeRef.current = Date.now();
          }}
          className="p-1.5 text-slate-400 hover:text-white transition"
          title="Reset t=0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Speed Toggle */}
        <button
          onClick={() => setPlaybackSpeed((s) => (s === 1.0 ? 2.0 : s === 2.0 ? 0.5 : 1.0))}
          className="px-2 py-0.5 rounded-md bg-[#19212a] border border-[#263140] text-[10px] font-mono text-[#10b981] hover:text-white transition"
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>

        {/* Snapshot */}
        <button
          onClick={handleDownloadSnapshot}
          className="p-1.5 text-slate-400 hover:text-[#10b981] transition"
          title="Capture High-Res PNG"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
