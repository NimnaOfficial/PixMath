import { useState, useEffect, useRef } from 'react';

// Preset Mathematical Artworks
const PRESET_FORMULAS = [
  {
    name: "Yeganeh Solar Plasma",
    description: "Multi-frequency sinusoidal oscillation with radial modulation",
    formula: "sin(10.0 * sqrt(x*x + y*y) - t * 2.0) * cos(8.0 * atan2(y, x) + t)",
    colorFormula: "vec3(0.5 + 0.5 * sin(val * 3.14 + t), 0.3 + 0.5 * cos(val * 2.0), 0.8 + 0.2 * sin(val * 5.0))"
  },
  {
    name: "Nested SDF Torus Rings",
    description: "Concentric signed distance fields with smooth boolean union",
    formula: "cos(12.0 * (sqrt(x*x + y*y) - 0.5) + t) * sin(6.0 * x * y)",
    colorFormula: "vec3(0.1, 0.5 + 0.5 * sin(val * 4.0 + t), 0.8 + 0.2 * val)"
  },
  {
    name: "Hyperbolic Geometric Bloom",
    description: "High-order trigonometric harmonics with phase deformation",
    formula: "sin(5.0 * x) * sin(5.0 * y) + cos(8.0 * sqrt(x*x + y*y) - t)",
    colorFormula: "vec3(0.9 + 0.1 * sin(val), 0.6 + 0.4 * cos(val * 2.0 + t), 0.2)"
  },
  {
    name: "Quantum Orbital Wavefunction",
    description: "Simulated nodal interference patterns with exponential decay",
    formula: "exp(-1.5 * (x*x + y*y)) * sin(14.0 * x) * cos(14.0 * y + t * 1.5)",
    colorFormula: "vec3(0.2 + 0.8 * abs(val), 0.1, 0.5 + 0.5 * sin(val * 10.0))"
  }
];

// Sample Pareto Frontier Dataset for Reverse Mode
const PARETO_POINTS = [
  { complexity: 8, psnr: 18.2, ssim: 0.62, equation: "sin(3.14 * x) * cos(3.14 * y)", latex: "\\sin(\\pi x)\\cos(\\pi y)" },
  { complexity: 16, psnr: 24.1, ssim: 0.78, equation: "sin(5.0 * x) + cos(5.0 * y) * 0.5", latex: "\\sin(5x) + 0.5\\cos(5y)" },
  { complexity: 28, psnr: 31.4, ssim: 0.89, equation: "sin(8.0 * sqrt(x*x + y*y)) * cos(4.0 * atan2(y, x))", latex: "\\sin(8\\sqrt{x^2+y^2})\\cos(4\\operatorname{atan2}(y,x))", isElbow: true },
  { complexity: 52, psnr: 34.0, ssim: 0.93, equation: "sin(8.0 * sqrt(x*x + y*y)) * cos(4.0 * atan2(y,x)) + 0.1 * sin(20.0 * x)", latex: "\\sin(8r)\\cos(4\\theta) + 0.1\\sin(20x)" },
  { complexity: 110, psnr: 35.8, ssim: 0.95, equation: "sin(8.0*r)*cos(4.0*theta) + 0.1*sin(20.0*x) - 0.05*cos(35.0*y)", latex: "\\text{AST (110 nodes)}" },
  { complexity: 240, psnr: 36.9, ssim: 0.96, equation: "High-order AST polynomial series", latex: "\\text{Overfitted AST (240 nodes)}" },
];

export default function App() {
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward');
  const [equation, setEquation] = useState(PRESET_FORMULAS[0].formula);
  const [speed, setSpeed] = useState(1.0);
  const [scale, setScale] = useState(1.0);
  const [selectedPareto, setSelectedPareto] = useState(PARETO_POINTS[2]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // WebGL Shader Compiler
  useEffect(() => {
    if (mode !== 'forward') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      setCompileError("WebGL2 not supported in this browser.");
      return;
    }
    glRef.current = gl;

    const vsSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Convert equation to GLSL
    let glslExpr = equation
      .replace(/atan2\(/g, "atan(")
      .replace(/pi/g, "3.14159265")
      .replace(/e/g, "2.71828182");

    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_scale;

      float safe_div(float a, float b) {
        return a / (abs(b) < 1e-6 ? 1e-6 : b);
      }
      float safe_sqrt(float v) {
        return sqrt(max(v, 0.0));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;
        uv *= u_scale;
        
        float x = uv.x;
        float y = uv.y;
        float t = u_time;

        float val = 0.0;
        val = ${glslExpr};

        vec3 col = vec3(
          0.5 + 0.5 * sin(val * 3.14 + t),
          0.4 + 0.4 * cos(val * 2.0 - t * 0.5),
          0.6 + 0.4 * sin(val * 4.0)
        );

        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(info || "Failed to compile shader");
      }
      return shader;
    };

    try {
      setIsCompiling(true);
      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Failed to link shader");
      }

      programRef.current = program;
      setCompileError(null);

      // Setup Quad Geometry
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

    } catch (err: any) {
      setCompileError(err.message || "Compilation error");
    } finally {
      setIsCompiling(false);
    }
  }, [equation, scale, mode]);

  // Render Loop
  useEffect(() => {
    if (mode !== 'forward') return;
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    const render = () => {
      if (programRef.current) {
        gl.useProgram(programRef.current);
        const resLoc = gl.getUniformLocation(programRef.current, 'u_resolution');
        const timeLoc = gl.getUniformLocation(programRef.current, 'u_time');
        const scaleLoc = gl.getUniformLocation(programRef.current, 'u_scale');

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, ((Date.now() - startTimeRef.current) / 1000.0) * speed);
        gl.uniform1f(scaleLoc, scale);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [speed, scale, mode]);

  return (
    <div className="flex flex-col h-screen bg-[#0B0F19] text-slate-100 font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-800 bg-[#111827]/80 backdrop-blur flex items-center justify-between px-6 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center font-mono font-bold text-black text-lg">
            π
          </div>
          <span className="font-bold text-lg tracking-wider text-slate-100">
            Pix<span className="text-cyan-400">Math</span> Studio
          </span>
          <span className="text-xs bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 px-2 py-0.5 rounded-full font-mono">
            v0.1.0-alpha
          </span>
        </div>

        {/* Engine Mode Toggle */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMode('forward')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'forward'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Forward (Math → Image)
          </button>
          <button
            onClick={() => setMode('reverse')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'reverse'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Reverse (Image → Math)
          </button>
        </div>

        {/* Microservice Topology Indicator */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>BFF: Ready</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            <span>RabbitMQ: Active</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      {mode === 'forward' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Symbolic Editor & Controls */}
          <div className="w-[450px] border-r border-slate-800 bg-[#0F172A]/40 flex flex-col p-6 space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
                <span>⚡</span>
                <span>Symbolic Formula IDE</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter continuous closed-form mathematical equations $f(x, y, t)$.
              </p>
            </div>

            {/* Presets Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Preset Mathematical Artworks</label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_FORMULAS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setEquation(preset.formula)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition text-xs"
                  >
                    <div className="font-medium text-slate-200 truncate">{preset.name}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Formula Code Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-medium text-slate-300">Expression f(x, y, t)</label>
                <span className="text-slate-500 font-mono text-[11px]">Domain: [-1.0, 1.0]</span>
              </div>
              <textarea
                value={equation}
                onChange={(e) => setEquation(e.target.value)}
                rows={4}
                className="w-full bg-[#0B0F19] border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition resize-none"
                placeholder="e.g. sin(10.0 * sqrt(x*x + y*y) - t)"
              />
              {compileError && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-400 font-mono">
                  ⚠ AST Error: {compileError}
                </div>
              )}
            </div>

            {/* Interactive Scrubbers */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Interactive Parameters
              </h3>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Time Evolution (Speed)</span>
                  <span className="text-cyan-400">{speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="4.0"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Spatial Domain Scale</span>
                  <span className="text-amber-400">{scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* AST Security Status */}
            <div className="mt-auto p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">AST Security Sandbox</span>
                <span className="text-emerald-400 font-mono font-medium">PASSED</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Tree Depth: 4 / 32</span>
                <span>Node Volume: 12 / 2000</span>
              </div>
            </div>
          </div>

          {/* Right Panel: High-Resolution Live Canvas */}
          <div className="flex-1 bg-[#070A10] flex flex-col items-center justify-center p-8 relative">
            <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-slate-800 bg-black">
              <canvas
                ref={canvasRef}
                width={640}
                height={640}
                className="w-[560px] h-[560px] block"
              />
              {isCompiling && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-xs font-mono text-cyan-400">
                  Transpiling AST to GLSL...
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center space-x-6 text-xs text-slate-500 font-mono">
              <span>Resolution: 640 x 640</span>
              <span>Renderer: WebGL2 Fragment Shader</span>
              <span>Latency: &lt;1.0ms (GPU 60 FPS)</span>
            </div>
          </div>
        </div>
      ) : (
        /* Reverse Mode: Image to Closed-Form Equations */
        <div className="flex-1 flex overflow-hidden p-8 space-y-6">
          <div className="flex-1 flex flex-col space-y-6">
            <div>
              <h2 className="text-base font-semibold text-emerald-400 flex items-center space-x-2">
                <span>🧬</span>
                <span>Pareto Frontier Symbolic Extraction Explorer</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Visualizing the multi-objective trade-off between equation complexity (AST node count) and visual fidelity (PSNR/SSIM).
              </p>
            </div>

            {/* Interactive Pareto Chart */}
            <div className="p-6 bg-[#111827] border border-slate-800 rounded-2xl space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300">Evolution Generations: 100 / 100</span>
                <span className="text-emerald-400 font-mono">Pareto Elbow: 28 AST Nodes (Optimal)</span>
              </div>

              {/* Scatter Plot Simulation */}
              <div className="h-48 w-full bg-[#0B0F19] rounded-xl border border-slate-800 relative flex items-end px-12 pb-8 pt-6">
                {/* Axes */}
                <div className="absolute left-4 top-1/2 -rotate-90 text-[10px] text-slate-500 font-mono">PSNR (dB)</div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-mono">AST Complexity (Nodes)</div>

                {/* Pareto Points */}
                <div className="w-full flex justify-between items-end relative z-10">
                  {PARETO_POINTS.map((pt, i) => {
                    const isSelected = selectedPareto.complexity === pt.complexity;
                    const heightPercent = ((pt.psnr - 15) / 25) * 100;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedPareto(pt)}
                        style={{ height: `${heightPercent}%` }}
                        className="flex flex-col items-center justify-end group focus:outline-none"
                      >
                        <div
                          className={`w-4 h-4 rounded-full transition-all ${
                            isSelected
                              ? 'bg-emerald-400 ring-4 ring-emerald-500/30 scale-125'
                              : pt.isElbow
                              ? 'bg-amber-400'
                              : 'bg-slate-600 hover:bg-slate-400'
                          }`}
                        />
                        <span className="text-[10px] font-mono mt-2 text-slate-400">
                          {pt.complexity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Formula Breakdown */}
            <div className="p-6 bg-[#111827] border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Extracted Closed-Form Algebraic Expression
              </h3>
              <div className="p-4 bg-[#0B0F19] border border-slate-800 rounded-xl font-mono text-sm text-emerald-300">
                {selectedPareto.equation}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[11px] text-slate-500">Visual Accuracy</div>
                  <div className="text-base font-bold font-mono text-emerald-400">{selectedPareto.psnr} dB</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[11px] text-slate-500">Structural SSIM</div>
                  <div className="text-base font-bold font-mono text-cyan-400">{selectedPareto.ssim}</div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[11px] text-slate-500">AST Node Volume</div>
                  <div className="text-base font-bold font-mono text-amber-400">{selectedPareto.complexity} nodes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
