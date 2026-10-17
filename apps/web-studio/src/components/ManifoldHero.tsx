import { useEffect, useRef, useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  Crosshair, 
  SlidersHorizontal,
  Layers
} from 'lucide-react';

interface ManifoldHeroProps {
  equation: string;
}

export function ManifoldHero({ equation }: ManifoldHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const [activeWorker, setActiveWorker] = useState('Worker-01 (ModernGL EGL)');
  const [speed, setSpeed] = useState(1.0);

  // WebGL Shader for the continuous topological manifold field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
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

    // Shader matching the emerald / mint topographic contour point-cloud in des2.jpg
    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;

      float safe_div(float a, float b) {
        return a / (abs(b) < 1e-6 ? 1e-6 : b);
      }
      float safe_sqrt(float v) {
        return sqrt(max(v, 0.0));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        float x = uv.x * 1.8;
        float y = uv.y * 1.8;
        float t = u_time * 0.5;

        float val = 0.0;
        val = ${glslExpr};

        // Point-cloud grid emulation
        vec2 grid = fract(gl_FragCoord.xy / 6.0);
        float dotMask = smoothstep(0.4, 0.2, length(grid - vec2(0.5)));

        // Emerald / Mint / Earthy Amber palette from des2.jpg
        vec3 emerald = vec3(0.06, 0.72, 0.51); // #10b981
        vec3 mint = vec3(0.2, 0.88, 0.75);    // #2dd4bf
        vec3 amber = vec3(0.85, 0.55, 0.15);   // #d97706
        vec3 deepDark = vec3(0.06, 0.08, 0.09);

        float elevation = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(deepDark, emerald, smoothstep(0.1, 0.6, elevation));
        col = mix(col, mint, smoothstep(0.6, 0.85, elevation));
        col = mix(col, amber, smoothstep(0.85, 1.0, elevation));

        col *= dotMask * 1.4;

        // Soft vignette
        float vignette = 1.0 - smoothstep(0.8, 1.5, length(uv));
        col *= vignette;

        fragColor = vec4(col, 1.0);
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
      // Fallback
    }
  }, [equation]);

  useEffect(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    const render = () => {
      if (programRef.current) {
        gl.useProgram(programRef.current);
        const resLoc = gl.getUniformLocation(programRef.current, 'u_resolution');
        const timeLoc = gl.getUniformLocation(programRef.current, 'u_time');

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, ((Date.now() - startTimeRef.current) / 1000.0) * speed);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [speed]);

  return (
    <div className="relative flex-1 h-full flex flex-col items-center justify-center p-4 select-none">
      {/* ── Main Canvas Card with Ambient Glow ─────────────────── */}
      <div className="relative w-full h-[410px] bg-[#111417] border border-[#20252b] rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
        {/* The Radiant Emerald Ambient Glow from des2.jpg */}
        <div className="absolute -bottom-8 left-1/4 right-1/4 h-28 bg-[#10b981] filter blur-[80px] opacity-35 rounded-full pointer-events-none z-0" />

        {/* WebGL Particle Manifold Field Canvas */}
        <canvas
          ref={canvasRef}
          width={860}
          height={480}
          className="w-full h-full block object-cover z-10"
        />

        {/* ── Floating Status Pins (Exact positions from des2.jpg) ─ */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Pin 1: Green Shield (West / Left) */}
          <div className="absolute top-[38%] left-[22%] pointer-events-auto group cursor-pointer">
            <div className="w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center shadow-lg shadow-[#10b981]/30">
              <ShieldCheck className="w-3 h-3 text-[#10b981]" />
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-[#161a1f] px-2 py-0.5 rounded text-[10px] text-white font-mono whitespace-nowrap border border-[#282f37]">
              Node: Verified [sin-azimuth]
            </div>
          </div>

          {/* Pin 2: Amber Circle Alert (Center-Left) */}
          <div className="absolute top-[28%] left-[36%] pointer-events-auto group cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
            </div>
          </div>

          {/* Pin 3: Green Shield (Center Elevation) */}
          <div className="absolute top-[52%] left-[44%] pointer-events-auto group cursor-pointer">
            <div className="w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center shadow-lg shadow-[#10b981]/30">
              <ShieldCheck className="w-3 h-3 text-[#10b981]" />
            </div>
          </div>

          {/* Pin 4: Red Danger Triangle (South-West) */}
          <div className="absolute top-[68%] left-[25%] pointer-events-auto group cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
            </div>
          </div>

          {/* Pin 5: Amber Alert (North-East) */}
          <div className="absolute top-[30%] right-[32%] pointer-events-auto group cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
            </div>
          </div>

          {/* Pin 6: Green Shield (East Coast) */}
          <div className="absolute top-[62%] right-[24%] pointer-events-auto group cursor-pointer">
            <div className="w-5 h-5 rounded-full bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center shadow-lg shadow-[#10b981]/30">
              <ShieldCheck className="w-3 h-3 text-[#10b981]" />
            </div>
          </div>
        </div>

        {/* ── Floating Alert Pill Overlay ───────────────────────── */}
        <div className="absolute top-28 right-16 z-20 flex items-center space-x-2 bg-[#181c21]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-rose-500/40 text-xs shadow-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="text-slate-200 text-[11px] font-medium">Singularity Guard: safe_div(x, y+1.2)</span>
          <span className="text-slate-500 font-mono text-[10px]">^</span>
        </div>

        {/* ── Floating Headless Worker Cards (Right side of canvas) ─ */}
        <div className="absolute top-36 right-16 z-20 flex flex-col space-y-1.5 w-44">
          {['Worker-01 (ModernGL EGL)', 'Worker-02 (SIREN PyTorch)', 'Worker-03 (PySR Genetic)'].map((worker) => (
            <div
              key={worker}
              onClick={() => setActiveWorker(worker)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center justify-between cursor-pointer transition-all ${
                activeWorker === worker
                  ? 'bg-[#1e2329]/95 text-white border border-[#10b981]/50 shadow-md'
                  : 'bg-[#15191d]/80 text-slate-400 hover:text-white border border-[#23282f]'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className={`w-1.5 h-1.5 rounded-full ${activeWorker === worker ? 'bg-[#10b981]' : 'bg-slate-600'}`} />
                <span className="truncate">{worker}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
            </div>
          ))}
        </div>

        {/* ── Floating Pill Toolbar (Bottom of the map in des2.jpg) ─ */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 bg-[#161a1f]/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#282f37] shadow-xl text-slate-400 text-xs font-mono">
          <button className="hover:text-white transition">
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSpeed((s) => (s === 1.0 ? 2.0 : s === 2.0 ? 0.5 : 1.0))}
            className="w-5 h-5 rounded-full bg-white text-black font-bold flex items-center justify-center text-[10px] hover:bg-[#10b981] transition cursor-pointer"
            title={`Temporal Speed: ${speed}x`}
          >
            {speed === 0.5 ? '½' : speed}
          </button>
          <button className="hover:text-white transition">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-white transition">
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-white transition">
            <AlertCircle className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-slate-300 font-semibold pl-1">
            360°
          </span>
        </div>
      </div>
    </div>
  );
}
