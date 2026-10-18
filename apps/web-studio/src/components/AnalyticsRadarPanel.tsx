import { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { ParetoExplorer } from './ParetoExplorer';
import {
  Activity,
  Zap,
  Radio,
  Layers,
} from 'lucide-react';

export function AnalyticsRadarPanel() {
  const {
    gpuFps,
    renderLatencyMs,
    psnr,
    dssim,
  } = useStudioStore();

  const [activeTab, setActiveTab] = useState<'pareto' | 'ast' | 'stream'>('pareto');

  // SVG Circular Gauge Calculations
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  // PSNR gauge (38.4 dB out of 45 dB)
  const psnrPercent = Math.min(100, (psnr / 45.0) * 100);
  const psnrOffset = circumference - (psnrPercent / 100) * circumference;

  // D-SSIM gauge (lower is better, e.g. 0.042)
  const dssimPercent = Math.min(100, (1.0 - dssim) * 100);
  const dssimOffset = circumference - (dssimPercent / 100) * circumference;

  return (
    <div className="w-full h-full flex flex-col space-y-4 select-none overflow-y-auto pr-1">
      {/* ── Sub-Tab Switcher ───────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.07]">
        <div className="flex items-center space-x-1 bg-[#0A0F1D] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setActiveTab('pareto')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
              activeTab === 'pareto'
                ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pareto Radar
          </button>
          <button
            onClick={() => setActiveTab('ast')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
              activeTab === 'ast'
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            FlatBuffers AST
          </button>
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
              activeTab === 'stream'
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            WS Stream
          </button>
        </div>

        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#06B6D4]">
          <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-ping" />
          <span>{gpuFps} FPS · {renderLatencyMs}ms</span>
        </div>
      </div>

      {/* ── Dual Precision Radial Gauges: PSNR & D-SSIM ─────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* PSNR Visual Fidelity Gauge */}
        <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-3 flex flex-col items-center relative shadow-lg">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="text-[#131B2E]"
                strokeWidth="4"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke="#10B981"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={psnrOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#10B981]" />
            </div>
          </div>
          <div className="mt-1 text-center font-mono">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">PSNR Fidelity</div>
            <div className="text-sm font-bold text-white mt-0.5">{psnr.toFixed(1)} dB</div>
            <div className="text-[9px] text-[#10B981]">Peak Convergence</div>
          </div>
        </div>

        {/* D-SSIM Structural Dissimilarity Gauge */}
        <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-3 flex flex-col items-center relative shadow-lg">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="text-[#131B2E]"
                strokeWidth="4"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke="#06B6D4"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={dssimOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#06B6D4]" />
            </div>
          </div>
          <div className="mt-1 text-center font-mono">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">D-SSIM Metric</div>
            <div className="text-sm font-bold text-white mt-0.5">{dssim.toFixed(3)}</div>
            <div className="text-[9px] text-[#06B6D4]">High Structural Fit</div>
          </div>
        </div>
      </div>

      {/* ── Active Sub-View: Pareto Radar vs FlatBuffers vs Stream ── */}
      {activeTab === 'pareto' && <ParetoExplorer />}

      {activeTab === 'ast' && (
        <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#06B6D4]" />
              <span className="font-bold">FlatBuffers Serialization Schema</span>
            </div>
            <span className="text-[10px] text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
              Zero-Copy Valid
            </span>
          </div>

          <div className="p-3 bg-[#05080E] rounded-xl border border-white/[0.05] text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
            <div className="text-slate-500">// Schema: pixmath.ast.BinaryExpression</div>
            <div className="text-[#06B6D4]">table ExpressionNode &#123;</div>
            <div className="pl-4 text-slate-400">node_id: uint32;</div>
            <div className="pl-4 text-slate-400">opcode: AstOpCode (Mul = 0x03);</div>
            <div className="pl-4 text-slate-400">left_child: ExpressionNode;</div>
            <div className="pl-4 text-slate-400">right_child: ExpressionNode;</div>
            <div className="pl-4 text-slate-400">constants: [float32]; // Bound to u_c[64]</div>
            <div className="text-[#06B6D4]">&#125;</div>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Serialized Byte Length:</span>
              <span className="text-white">128 bytes</span>
            </div>
            <div className="flex justify-between">
              <span>AST Tree Depth:</span>
              <span className="text-[#10B981]">4 Levels (Max 8)</span>
            </div>
            <div className="flex justify-between">
              <span>Whitelisted OpCodes:</span>
              <span className="text-white">sin, cos, sqrt, atan2, exp, mul, add</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stream' && (
        <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-[#F59E0B]" />
              <span className="font-bold">WebSocket Generation Stream</span>
            </div>
            <span className="text-[10px] text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded-full border border-[#F59E0B]/30 animate-pulse">
              ws://localhost:8000/stream
            </span>
          </div>

          <div className="flex flex-col space-y-2 text-[10px] text-slate-400">
            <div className="p-2 bg-[#05080E] rounded-lg border border-white/[0.05] flex items-center justify-between">
              <span className="text-slate-300">[GEN 120] Candidate p5 discovered</span>
              <span className="text-[#10B981]">PSNR: 41.2 dB</span>
            </div>
            <div className="p-2 bg-[#05080E] rounded-lg border border-white/[0.05] flex items-center justify-between">
              <span className="text-slate-300">[GEN 76] Candidate p4 evaluated</span>
              <span className="text-[#10B981]">PSNR: 40.1 dB</span>
            </div>
            <div className="p-2 bg-[#05080E] rounded-lg border border-white/[0.05] flex items-center justify-between">
              <span className="text-slate-300">[GEN 42] Candidate p3 (Knee Point)</span>
              <span className="text-amber-400">PSNR: 38.4 dB</span>
            </div>
            <div className="p-2 bg-[#05080E] rounded-lg border border-white/[0.05] flex items-center justify-between">
              <span className="text-slate-300">[GEN 18] Candidate p2 evaluated</span>
              <span className="text-slate-400">PSNR: 28.2 dB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
