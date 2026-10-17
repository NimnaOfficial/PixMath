import { useState } from 'react';
import { Target, Play } from 'lucide-react';

interface TargetMatchingViewProps {
  equation: string;
}

export function TargetMatchingView({ equation }: TargetMatchingViewProps) {
  const [isEvolving, setIsEvolving] = useState(false);
  const [generation, setGeneration] = useState(48);

  return (
    <div className="w-full flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1c222b] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-[#10b981]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Target Image Reconstruction & Symbolic Fit
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Optimize mathematical equation to reconstruct pixel targets via genetic evolutionary regression.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEvolving(!isEvolving)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              isEvolving
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-[#10b981] hover:bg-[#059669] text-black shadow-lg shadow-[#10b981]/20'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isEvolving ? 'Pause Evolution' : 'Start Evolution'}</span>
          </button>
        </div>
      </div>

      {/* ── 3-Way Visual Comparison Strip ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Target Image */}
        <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>1. Ground Truth Target</span>
            <span className="text-[10px] font-mono text-slate-500">1024×1024 RGBA</span>
          </div>
          <div className="h-64 w-full bg-[#11161d] rounded-xl border border-[#1d2531] flex items-center justify-center relative overflow-hidden group">
            {/* Target Pattern Simulation */}
            <div className="w-40 h-40 rounded-full border-4 border-[#10b981]/40 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-2 border-amber-400/50 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#10b981]/20" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded">
              Solar Toroid Ground Truth
            </div>
          </div>
        </div>

        {/* Card 2: Current Mathematical Equation Fit */}
        <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>2. Mathematical Synthesis f(x, y)</span>
            <span className="text-[10px] font-mono text-[#10b981]">Gen {generation}</span>
          </div>
          <div className="h-64 w-full bg-[#11161d] rounded-xl border border-[#1d2531] flex items-center justify-center relative overflow-hidden">
            {/* Mathematical Equation rendering simulation */}
            <div className="w-40 h-40 rounded-full border-4 border-[#10b981] shadow-lg shadow-[#10b981]/30 flex items-center justify-center animate-pulse-subtle">
              <div className="w-24 h-24 rounded-full border-2 border-amber-400 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#10b981]" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-[#10b981] bg-black/60 px-2 py-0.5 rounded">
              PSNR: 38.4 dB (96.2%)
            </div>
          </div>
        </div>

        {/* Card 3: Difference Error Heatmap */}
        <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>3. Error Residual Heatmap</span>
            <span className="text-[10px] font-mono text-rose-400">MSE: 0.0014</span>
          </div>
          <div className="h-64 w-full bg-[#11161d] rounded-xl border border-[#1d2531] flex items-center justify-center relative overflow-hidden">
            {/* Difference heatmap */}
            <div className="w-40 h-40 rounded-full border border-dashed border-rose-500/40 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-rose-500/30" />
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded">
              L1 Coordinate Residuals
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Formula Card ────────────────────────────────── */}
      <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 w-full md:w-auto">
          <div className="text-[10px] text-slate-500 font-mono">CURRENT BEST CANDIDATE FORMULA</div>
          <div className="font-mono text-xs text-cyan-300 break-all">{equation}</div>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <span className="text-xs font-mono text-slate-400">Generations: {generation}/100</span>
          <button
            onClick={() => setGeneration((g) => g + 10)}
            className="px-3 py-1.5 bg-[#141a22] hover:bg-[#1c2430] border border-[#232d3b] text-xs font-semibold text-slate-200 rounded-lg transition"
          >
            +10 Generations
          </button>
        </div>
      </div>
    </div>
  );
}
