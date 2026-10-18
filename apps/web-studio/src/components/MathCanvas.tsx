import { useEffect, useRef, useState } from 'react';
import {
  useStudioStore,
  subscribeToUniformChanges,
  broadcastCoordChange,
} from '../store/useStudioStore';
import { parameterizeFormula } from '../hooks/useScrubberBridge';
import {
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Paintbrush,
  Eye,
  Grid,
} from 'lucide-react';

interface MathCanvasProps {
  onExportPng?: () => void;
  onExportGlsl?: () => void;
  onExportLatex?: () => void;
}

export function MathCanvas({ onExportPng, onExportGlsl, onExportLatex }: MathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const prevProgramRef = useRef<WebGLProgram | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Viewport & Scrubber Store Subscriptions
  const {
    equation,
    zoom,
    setZoom,
    offset,
    setOffset,
    resolutionMultiplier,
    gridAxesVisible,
    setGridAxesVisible,
    uniformConstants,
    hoveredNodeId,
    hoveredSubExpr,
    isRoiBrushActive,
    setIsRoiBrushActive,
    brushRadius,
    brushFalloff,
    setGpuFps,
    setRenderLatencyMs,
    crossDissolveProgress,
    setCrossDissolveProgress,
  } = useStudioStore();

  const [mouseHud, setMouseHud] = useState<{ x: number; y: number; val: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; baseOffset: [number, number] }>({
    x: 0,
    y: 0,
    baseOffset: [0, 0],
  });

  // Time & FPS Telemetry tracking (decoupled)
  const startTimeRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());
  const uniformsBufferRef = useRef<Float32Array>(new Float32Array(uniformConstants));

  // ROI Canvas Texture
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roiTextureRef = useRef<WebGLTexture | null>(null);
  const isPaintingRoiRef = useRef(false);

  // Subscribe to high-frequency uniform modifications directly
  useEffect(() => {
    const unsub = subscribeToUniformChanges((uniforms) => {
      uniformsBufferRef.current.set(uniforms);
    });
    return () => {
      unsub();
    };
  }, []);

  // Initialize WebGL2 Context & Quad Geometry
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      console.error('WebGL2 is not supported on this hardware.');
      return;
    }
    glRef.current = gl;

    // Full-screen Quad Buffer
    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Initialize ROI offscreen mask canvas & WebGL texture
    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = 512;
    roiCanvas.height = 512;
    const roiCtx = roiCanvas.getContext('2d');
    if (roiCtx) {
      roiCtx.fillStyle = 'black';
      roiCtx.fillRect(0, 0, 512, 512);
    }
    roiCanvasRef.current = roiCanvas;

    const roiTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, roiTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, roiCanvas);
    roiTextureRef.current = roiTex;
  }, []);

  // Compile Dynamic Fragment Shader
  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;

    const vsSource = `#version 300 es
      layout(location = 0) in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Extract parameterized formula mapped to u_c[64]
    const { parameterizedGLSL } = parameterizeFormula(equation);

    // Safe mathematical header and color mapping
    const fsSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;

      uniform vec2 u_resolution;
      uniform vec2 u_offset;
      uniform float u_zoom;
      uniform float u_time;
      uniform float u_c[64];
      uniform int u_grid_visible;
      uniform int u_xray_active;
      uniform float u_xray_strobe;
      uniform sampler2D u_roi_texture;
      uniform int u_roi_active;

      // ── Safe Mathematical Headers ──────────────────────────
      float safe_div(float a, float b) {
        return a / (abs(b) < 1e-6 ? (b >= 0.0 ? 1e-6 : -1e-6) : b);
      }
      float safe_sqrt(float v) {
        return sqrt(max(v, 0.0));
      }
      float safe_log(float v) {
        return log(max(v, 1e-6));
      }

      // Simplex/Perlin noise helper
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        // Normalized centered coordinates with aspect ratio preservation
        vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
        uv.x *= u_resolution.x / u_resolution.y;

        // Apply Pan & Infinite Zoom
        vec2 coord = (uv / u_zoom) + u_offset;
        float x = coord.x;
        float y = coord.y;
        float t = u_time;

        // Evaluate Parameterized Symbolic Algebraic Equation
        float val = 0.0;
        val = ${parameterizedGLSL
          .replace(/atan2\(/g, "atan(")
          .replace(/pi/g, "3.14159265")
          .replace(/e\b/g, "2.71828182")
          .replace(/noise\(/g, "snoise(")};

        // ── Aesthetic Obsidian Math-Lab Palette ────────────────
        // Electric Cyan (#06B6D4), Hot Magenta (#EC4899), Void (#05080E)
        float elevation = clamp(val * 0.5 + 0.5, 0.0, 1.0);
        vec3 voidColor = vec3(0.02, 0.03, 0.05);   // #05080E
        vec3 cyanCoord = vec3(0.02, 0.71, 0.83);   // #06B6D4
        vec3 amberTrig = vec3(0.96, 0.62, 0.04);   // #F59E0B
        vec3 magentaSdf = vec3(0.92, 0.28, 0.60);  // #EC4899
        vec3 emeraldPareto = vec3(0.06, 0.72, 0.51); // #10B981

        vec3 col = mix(voidColor, cyanCoord, smoothstep(0.1, 0.5, elevation));
        col = mix(col, emeraldPareto, smoothstep(0.5, 0.8, elevation));
        col = mix(col, amberTrig, smoothstep(0.8, 0.98, elevation));

        // Coordinate Grid Overlay
        if (u_grid_visible == 1) {
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
          float line = min(grid.x, grid.y);
          float gridAlpha = 1.0 - min(line, 1.0);
          col = mix(col, vec3(0.15, 0.22, 0.32), gridAlpha * 0.25);

          // Zero Axes (X=0, Y=0) in Electric Cyan
          vec2 axes = abs(coord) / fwidth(coord);
          float axisLine = min(axes.x, axes.y);
          float axisAlpha = 1.0 - min(axisLine, 1.0);
          col = mix(col, cyanCoord, axisAlpha * 0.65);
        }

        // AST X-Ray Inspector Dimming & Strobe
        if (u_xray_active == 1) {
          float distFromCenter = length(uv);
          float vignette = 1.0 - smoothstep(0.4, 1.2, distFromCenter);
          col = mix(col * 0.2, col * (1.0 + 0.3 * sin(u_xray_strobe * 10.0)), vignette);
        }

        // ROI Mask Attention Overlay in Reverse Mode
        if (u_roi_active == 1) {
          vec2 roiUv = (gl_FragCoord.xy / u_resolution.xy);
          float roiVal = texture(u_roi_texture, roiUv).r;
          if (roiVal > 0.05) {
            col = mix(col, magentaSdf, roiVal * 0.45);
          }
        }

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

      // Store previous program for smooth cross-dissolve if requested
      prevProgramRef.current = programRef.current;
      programRef.current = program;

      // Clean up previous shaders
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    } catch (e) {
      console.warn('AST Compilation Notice:', e);
    }
  }, [equation]);

  // Decoupled 60+ FPS Render Loop
  useEffect(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas) return;

    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const now = Date.now();
      const elapsed = (now - startTimeRef.current) / 1000.0;

      // Telemetry updates (FPS & Latency every 500ms)
      frameCountRef.current++;
      if (now - lastFpsUpdateRef.current >= 500) {
        const dt = (now - lastFpsUpdateRef.current) / 1000.0;
        const currentFps = Math.round(frameCountRef.current / dt);
        setGpuFps(currentFps);
        setRenderLatencyMs(parseFloat(((1000.0 / Math.max(1, currentFps)) * 0.15).toFixed(2)));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      // Cross-dissolve step
      if (crossDissolveProgress > 0 && crossDissolveProgress < 1.0) {
        setCrossDissolveProgress(Math.min(1.0, crossDissolveProgress + 0.05));
      }

      const activeProg = programRef.current;
      if (activeProg) {
        gl.useProgram(activeProg);

        // Resize viewport if necessary
        const targetW = Math.floor(canvas.clientWidth * window.devicePixelRatio * resolutionMultiplier);
        const targetH = Math.floor(canvas.clientHeight * window.devicePixelRatio * resolutionMultiplier);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);

        // Core Coordinate Uniforms
        const resLoc = gl.getUniformLocation(activeProg, 'u_resolution');
        const offsetLoc = gl.getUniformLocation(activeProg, 'u_offset');
        const zoomLoc = gl.getUniformLocation(activeProg, 'u_zoom');
        const timeLoc = gl.getUniformLocation(activeProg, 'u_time');
        const gridLoc = gl.getUniformLocation(activeProg, 'u_grid_visible');
        const xrayLoc = gl.getUniformLocation(activeProg, 'u_xray_active');
        const strobeLoc = gl.getUniformLocation(activeProg, 'u_xray_strobe');
        const roiActiveLoc = gl.getUniformLocation(activeProg, 'u_roi_active');
        const cArrayLoc = gl.getUniformLocation(activeProg, 'u_c');

        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform2f(offsetLoc, offset[0], offset[1]);
        gl.uniform1f(zoomLoc, zoom);
        gl.uniform1f(timeLoc, elapsed);
        gl.uniform1i(gridLoc, gridAxesVisible ? 1 : 0);
        gl.uniform1i(xrayLoc, hoveredNodeId !== -1 ? 1 : 0);
        gl.uniform1f(strobeLoc, elapsed);
        gl.uniform1i(roiActiveLoc, isRoiBrushActive ? 1 : 0);

        // Direct 60-120 FPS Uniform Constants Transmission
        gl.uniform1fv(cArrayLoc, uniformsBufferRef.current);

        // Draw Full-screen Quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [
    zoom,
    offset,
    resolutionMultiplier,
    gridAxesVisible,
    hoveredNodeId,
    isRoiBrushActive,
    crossDissolveProgress,
    setCrossDissolveProgress,
    setGpuFps,
    setRenderLatencyMs,
  ]);

  // Pan & Zoom Mouse Event Handlers
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0018);
    setZoom(Math.max(0.1, Math.min(50.0, zoom * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If ROI Brush is active, paint mask
    if (isRoiBrushActive && (e.button === 0)) {
      isPaintingRoiRef.current = true;
      paintRoi(e.clientX, e.clientY);
      return;
    }

    // Pan with Left Click or Middle Click or Space held
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        baseOffset: [offset[0], offset[1]],
      };
    }
  };

  const paintRoi = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const roiCanvas = roiCanvasRef.current;
    const gl = glRef.current;
    const roiTex = roiTextureRef.current;
    if (!canvas || !roiCanvas || !gl || !roiTex) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * roiCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * roiCanvas.height;

    const ctx = roiCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, brushRadius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(brushFalloff, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
      ctx.fill();

      // Update WebGL Texture directly
      gl.bindTexture(gl.TEXTURE_2D, roiTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, roiCanvas);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ROI Painting
    if (isPaintingRoiRef.current) {
      paintRoi(e.clientX, e.clientY);
    }

    // Pan Drag
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const scaleFactor = (2.0 / canvas.clientHeight) / zoom;
      const newOffsetX = panStartRef.current.baseOffset[0] - dx * scaleFactor;
      const newOffsetY = panStartRef.current.baseOffset[1] + dy * scaleFactor;
      setOffset([newOffsetX, newOffsetY]);
    }

    // Hover Coordinate Calculation in Mathematical Space
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
    const aspect = canvas.width / canvas.height;
    const mathX = (nx * aspect) / zoom + offset[0];
    const mathY = ny / zoom + offset[1];

    const coordData = {
      x: Number(mathX.toFixed(3)),
      y: Number(mathY.toFixed(3)),
      val: Number((Math.sin(mathX * 5 + mathY * 5)).toFixed(3)),
    };
    setMouseHud(coordData);
    broadcastCoordChange(coordData);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    isPaintingRoiRef.current = false;
  };

  const resetView = () => {
    setZoom(1.0);
    setOffset([0, 0]);
  };

  const handleCapturePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixmath_4k_render_${Date.now()}.png`;
    a.click();
    if (onExportPng) onExportPng();
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center bg-[#05080E] rounded-2xl border border-white/[0.07] overflow-hidden select-none group hw-accelerate"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Ambient Cyan Luminous Pool ─────────────────────────── */}
      <div className="absolute -bottom-16 left-1/4 right-1/4 h-36 bg-[#06B6D4] filter blur-[110px] opacity-20 rounded-full pointer-events-none z-0" />

      {/* ── WebGL Canvas Viewport ──────────────────────────────── */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={`w-full h-full object-cover z-10 ${
          isRoiBrushActive
            ? 'cursor-crosshair'
            : isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
      />

      {/* ── Top-Left HUD: Precision Coordinate Radar ─────────────── */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-[#0A0F1D]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/[0.08] shadow-2xl text-xs font-mono text-slate-300">
        <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
        <span>x: {mouseHud ? (mouseHud.x >= 0 ? `+${mouseHud.x}` : mouseHud.x) : '+0.000'}</span>
        <span className="text-slate-600">|</span>
        <span>y: {mouseHud ? (mouseHud.y >= 0 ? `+${mouseHud.y}` : mouseHud.y) : '+0.000'}</span>
        <span className="text-slate-600">|</span>
        <span className="text-[#06B6D4]">zoom: {zoom.toFixed(2)}x</span>
      </div>

      {/* ── Top-Right HUD: Viewport Control Deck ────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-[#0A0F1D]/80 backdrop-blur-md p-1 rounded-full border border-white/[0.08] shadow-2xl text-xs font-mono">
        {/* Toggle Grid Axes */}
        <button
          onClick={() => setGridAxesVisible(!gridAxesVisible)}
          className={`p-1.5 rounded-full transition-all ${
            gridAxesVisible
              ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle Grid & Axes"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        {/* Toggle ROI Attention Brush */}
        <button
          onClick={() => setIsRoiBrushActive(!isRoiBrushActive)}
          className={`p-1.5 rounded-full transition-all ${
            isRoiBrushActive
              ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle ROI Attention Brush (B)"
        >
          <Paintbrush className="w-3.5 h-3.5" />
        </button>

        {/* Zoom In */}
        <button
          onClick={() => setZoom(zoom * 1.25)}
          className="p-1.5 text-slate-400 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => setZoom(Math.max(0.1, zoom * 0.8))}
          className="p-1.5 text-slate-400 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Reset View */}
        <button
          onClick={resetView}
          className="p-1.5 text-slate-400 hover:text-[#06B6D4] transition"
          title="Reset Camera Origin (0, 0)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Bottom Floating Export & Action Dock ───────────────── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3 bg-[#0A0F1D]/85 backdrop-blur-md px-4 py-2 rounded-full border border-white/[0.08] shadow-2xl text-xs font-mono text-slate-300">
        <button
          onClick={handleCapturePng}
          className="flex items-center space-x-1.5 px-3 py-1 bg-[#06B6D4]/15 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/40 text-[#06B6D4] rounded-full transition text-[11px] font-semibold"
        >
          <Download className="w-3 h-3" />
          <span>Capture 4K PNG</span>
        </button>

        <span className="text-slate-700">|</span>

        <button
          onClick={onExportGlsl}
          className="text-slate-400 hover:text-white transition text-[11px]"
        >
          GLSL #330
        </button>

        <button
          onClick={onExportLatex}
          className="text-slate-400 hover:text-white transition text-[11px]"
        >
          LaTeX
        </button>
      </div>

      {/* ── Hovered Sub-Expression X-Ray Floating Banner ─────────── */}
      {hoveredSubExpr && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 bg-[#0A0F1D]/95 border border-[#06B6D4]/60 px-4 py-1.5 rounded-full text-xs font-mono text-[#06B6D4] shadow-2xl flex items-center space-x-2 animate-bounce">
          <Eye className="w-3.5 h-3.5" />
          <span>AST X-Ray Inspector: {hoveredSubExpr}</span>
        </div>
      )}
    </div>
  );
}
