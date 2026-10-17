import { useState } from 'react';
import { Zap, Cpu, Activity, Copy, Check, Terminal } from 'lucide-react';

interface MathTelemetryDeckProps {
  equation: string;
  onCopyGLSL?: () => void;
}

export function MathTelemetryDeck({ equation, onCopyGLSL }: MathTelemetryDeckProps) {
  const [copied, setCopied] = useState(false);

  // SVG Circular Gauge Calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const psnrPercent = 88; // 38.4 dB out of ~43 dB ideal
  const psnrOffset = circumference - (psnrPercent / 100) * circumference;

  const compPercent = 38; // 24 nodes out of 64
  const compOffset = circumference - (compPercent / 100) * circumference;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`// PixMath Generated GLSL Fragment Shader
#version 330 core
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
  float x = uv.x * 2.0;
  float y = uv.y * 2.0;
  float t = u_time;
  float val = ${equation};
  fragColor = vec4(vec3(val * 0.5 + 0.5), 1.0);
}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopyGLSL) onCopyGLSL();
  };

  return (
    <aside className="w-80 flex flex-col space-y-4 select-none shrink-0">
      {/* ── Dual Radial Gauges (Des2 Style) ────────────────────── */}
      <div className="bg-[#0f1318] border border-[#1d242e] rounded-2xl p-4 flex flex-col space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Synthesis Telemetry</span>
          </div>
          <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded-full border border-[#10b981]/30">Live</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Gauge 1: Visual Fidelity PSNR */}
          <div className="flex flex-col items-center p-3 bg-[#13181f] border border-[#212a36] rounded-xl relative">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="text-[#1e2632]"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={psnrOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-[#10b981]" />
              </div>
            </div>
            <div className="mt-1 text-center">
              <div className="text-[10px] text-slate-400 font-medium">Fidelity PSNR</div>
              <div className="text-sm font-bold text-white font-mono">38.4 dB</div>
            </div>
          </div>

          {/* Gauge 2: AST Complexity */}
          <div className="flex flex-col items-center p-3 bg-[#13181f] border border-[#212a36] rounded-xl relative">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  className="text-[#1e2632]"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="#f43f5e"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={compOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-[#f43f5e]" />
              </div>
            </div>
            <div className="mt-1 text-center">
              <div className="text-[10px] text-slate-400 font-medium">AST Nodes</div>
              <div className="text-sm font-bold text-white font-mono">24 / 64</div>
            </div>
          </div>
        </div>

        {/* Spatial Gradient Waveform */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Spatial Gradient ||∇f||</span>
            <span className="text-[#10b981]">Mean: 1.42</span>
          </div>
          <div className="h-14 w-full bg-[#11161d] border border-[#1e2632] rounded-lg p-1.5 relative flex items-center">
            <svg className="w-full h-10 overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 40">
              <defs>
                <linearGradient id="telemetry-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 32 L 20 28 L 35 15 L 50 30 L 65 8 L 80 25 L 95 12 L 110 28 L 125 5 L 145 22 L 165 14 L 185 29 L 200 30"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M 0 32 L 20 28 L 35 15 L 50 30 L 65 8 L 80 25 L 95 12 L 110 28 L 125 5 L 145 22 L 165 14 L 185 29 L 200 30 L 200 40 L 0 40 Z"
                fill="url(#telemetry-grad)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── 2x2 Bento Stat Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Bento 1: Evaluated Pixels */}
        <div className="bg-[#0f1318] border border-[#1d242e] rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 font-medium">Evaluated Pixels</div>
          <div className="text-base font-bold font-mono text-white mt-1">1,048,576</div>
          <div className="text-[9px] font-mono text-slate-500">ModernGL Buffer</div>
        </div>

        {/* Bento 2: AST Tree Depth */}
        <div className="bg-[#0f1318] border border-[#1d242e] rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 font-medium">AST Tree Depth</div>
          <div className="text-base font-bold font-mono text-[#10b981] mt-1">4 / 8</div>
          <div className="text-[9px] font-mono text-slate-500">Bounded Safe Depth</div>
        </div>

        {/* Bento 3: Latency */}
        <div className="bg-[#0f1318] border border-[#1d242e] rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 font-medium">Render Latency</div>
          <div className="text-base font-bold font-mono text-white mt-1">1.2 ms</div>
          <div className="text-[9px] font-mono text-slate-500">60 FPS WebGL2</div>
        </div>

        {/* Bento 4: AST Guard */}
        <div className="bg-[#0f1318] border border-[#1d242e] rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[10px] text-slate-500 font-medium">Sandbox Guard</div>
          <div className="text-base font-bold font-mono text-[#10b981] mt-1">Whitelisted</div>
          <div className="text-[9px] font-mono text-slate-500">No Forbidden Ops</div>
        </div>
      </div>

      {/* ── 1-Click Code Transpile / Copy Action ────────────────── */}
      <div className="bg-[#0f1318] border border-[#1d242e] rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-[#10b981]" />
          <div>
            <div className="text-xs font-semibold text-slate-200">GLSL Shader #330</div>
            <div className="text-[10px] text-slate-500 font-mono">ModernGL Compatible</div>
          </div>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#17212d] hover:bg-[#202c3c] border border-[#273445] text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </aside>
  );
}
