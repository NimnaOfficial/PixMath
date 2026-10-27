import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface ShaderViewportProps {
  equation: string;
  isCompact?: boolean;
}

export function ShaderViewport({ equation, isCompact = false }: ShaderViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [zoom, setZoom] = useState(1.0);
  const [fps, setFps] = useState(60);
  const [compileError, setCompileError] = useState<string | null>(null);

  // Compile WebGL2 Fragment Shader
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      setCompileError('WebGL2 context not supported');
      return;
    }
    glRef.current = gl;

    const vsSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Transpile equation to GLSL
    let glslExpr = equation
      .replace(/atan2\(/g, "atan(")
      .replace(/pi/g, "3.14159265")
      .replace(/e/g, "2.71828182");

    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_zoom;

      float safe_div(float a, float b) {
        return a / (abs(b) < 1e-6 ? 1e-6 : b);
      }
      float safe_sqrt(float v) {
        return sqrt(max(v, 0.0));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;
        uv *= u_zoom;
        
        float x = uv.x;
        float y = uv.y;
        float t = u_time;

        float val = 0.0;
        val = ${glslExpr};

        // Precision Industrial color mapping (High contrast Cyan / Amber / Graphite)
        vec3 col = vec3(
          0.5 + 0.5 * sin(val * 3.1415 + t * 0.5),
          0.3 + 0.5 * cos(val * 2.0 - t * 0.3),
          0.7 + 0.3 * sin(val * 4.0 + t)
        );

        // Soft linear edge attenuation
        float d = length(uv);
        col *= (1.0 - smoothstep(1.3, 2.8, d));

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
        throw new Error(info || 'Shader compilation failed');
      }
      return shader;
    };

    try {
      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
      }

      programRef.current = program;
      setCompileError(null);

      // Buffer Geometry Quad
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
      setCompileError(err.message || 'GLSL Error');
    }
  }, [equation]);

  // Render Loop
  useEffect(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    let lastTime = performance.now();
    let frameCount = 0;

    const render = () => {
      if (programRef.current && isPlaying) {
        gl.useProgram(programRef.current);
        const resLoc = gl.getUniformLocation(programRef.current, 'u_resolution');
        const timeLoc = gl.getUniformLocation(programRef.current, 'u_time');
        const zoomLoc = gl.getUniformLocation(programRef.current, 'u_zoom');

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform1f(timeLoc, ((Date.now() - startTimeRef.current) / 1000.0) * speed);
        gl.uniform1f(zoomLoc, zoom);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Calculate FPS
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastTime = now;
        }
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, speed, zoom]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pixmath_artwork.png';
    a.click();
  };

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${
      isCompact ? 'w-full h-full' : 'w-full h-full p-6'
    }`}>
      {/* Sharp CAD Frame */}
      <div className="relative border border-[#1C2530] bg-[#050709] shadow-2xl flex flex-col">
        {/* Top Viewport Telemetry Header Bar */}
        <div className="h-7 bg-[#0A0E13] border-b border-[#1C2530] px-3 flex items-center justify-between text-[9px] font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-[#00F0FF] font-bold">[VIEWPORT // EGL-330]</span>
            <span className="text-slate-600">|</span>
            <span>{isCompact ? '480x480' : '720x720'}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[#10B981] font-bold">{fps} FPS</span>
            <div className="flex items-center space-x-1 border-l border-[#1C2530] pl-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-0.5 hover:text-white transition"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-0.5 hover:text-white transition"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={isCompact ? 480 : 720}
            height={isCompact ? 480 : 720}
            className={`${isCompact ? 'w-[360px] h-[360px]' : 'w-[540px] h-[540px]'} block bg-black`}
          />

          {/* Error Banner */}
          {compileError && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center font-mono">
              <span className="text-rose-400 text-xs font-bold mb-2">
                [!] GLSL TRANSPILATION FAULT
              </span>
              <p className="text-[10px] text-slate-300 bg-rose-950/40 p-3 border border-rose-800/60 max-w-md">
                {compileError}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Parameter Scrubbers Bar (Sharp Industrial Strips) */}
      {!isCompact && (
        <div className="mt-3 flex items-center space-x-4 bg-[#0A0E13] border border-[#1C2530] px-4 py-1.5 font-mono text-[10px]">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">TIME (T):</span>
            <input
              type="range"
              min="0.0"
              max="3.0"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-20 accent-[#00F0FF] bg-[#1C232B] h-1 appearance-none cursor-pointer"
            />
            <span className="text-[#00F0FF] w-8">{speed.toFixed(2)}x</span>
          </div>

          <div className="w-[1px] h-3 bg-[#1C2530]" />

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 uppercase">SCALE:</span>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-20 accent-amber-400 bg-[#1C232B] h-1 appearance-none cursor-pointer"
            />
            <span className="text-amber-400 w-8">{zoom.toFixed(2)}x</span>
          </div>
        </div>
      )}
    </div>
  );
}
