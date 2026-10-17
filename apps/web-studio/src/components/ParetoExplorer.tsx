import { useState } from 'react';
import { Cpu, ArrowUpRight, Sparkles } from 'lucide-react';

interface ParetoPoint {
  id: string;
  generation: number;
  nodes: number;
  psnr: number;
  ssim: number;
  equation: string;
  isElbow?: boolean;
}

interface ParetoExplorerProps {
  onLoadFormula: (formula: string) => void;
}

export function ParetoExplorer({ onLoadFormula }: ParetoExplorerProps) {
  const [selectedPoint, setSelectedPoint] = useState<ParetoPoint | null>({
    id: 'p3',
    generation: 48,
    nodes: 24,
    psnr: 38.4,
    ssim: 0.942,
    equation: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)',
    isElbow: true,
  });

  const paretoPoints: ParetoPoint[] = [
    { id: 'p1', generation: 5, nodes: 6, psnr: 18.2, ssim: 0.621, equation: 'sin(3.0 * x) * cos(3.0 * y)' },
    { id: 'p2', generation: 18, nodes: 12, psnr: 27.5, ssim: 0.785, equation: 'sin(6.0 * sqrt(x*x + y*y)) * cos(4.0 * x)' },
    { id: 'p3', generation: 48, nodes: 24, psnr: 38.4, ssim: 0.942, equation: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)', isElbow: true },
    { id: 'p4', generation: 82, nodes: 42, psnr: 39.8, ssim: 0.958, equation: 'sin(10.0 * sqrt(x*x + y*y)) * cos(8.0 * atan2(y, x)) + 0.1 * exp(-x*x)' },
    { id: 'p5', generation: 120, nodes: 68, psnr: 40.5, ssim: 0.965, equation: 'sin(10.0 * sqrt(x*x + y*y)) * cos(8.0 * atan2(y, x)) + 0.05 * sin(25.0 * (x+y))' },
  ];

  return (
    <div className="w-full flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1c222b] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-[#10b981]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Evolutionary Pareto Frontier
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-objective genetic algorithm tradeoff: Visual Reconstruction Fidelity (PSNR dB) vs. Formula Complexity (AST Nodes).
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="bg-[#12161c] border border-[#1e252f] px-3 py-1.5 rounded-lg text-slate-300">
            Generation: <span className="text-[#10b981] font-bold">120 / 120</span>
          </span>
          <span className="bg-[#12161c] border border-[#1e252f] px-3 py-1.5 rounded-lg text-slate-300">
            Population: <span className="text-[#10b981] font-bold">500</span>
          </span>
        </div>
      </div>

      {/* ── Main Interactive Curve & Inspector ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pareto Frontier Curve Plot */}
        <div className="lg:col-span-2 bg-[#0d1014] border border-[#1b222b] rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden min-h-[420px]">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-4">
            <span className="text-[#10b981] font-bold">PSNR Fidelity (dB) ↑</span>
            <span>AST Node Complexity →</span>
          </div>

          {/* Interactive Scatter Plot Grid */}
          <div className="relative flex-1 w-full flex items-end justify-between px-8 pb-8 pt-4 border-b border-l border-[#212934]">
            {/* Grid Lines */}
            <div className="absolute inset-0 grid grid-rows-4 grid-cols-4 pointer-events-none opacity-20">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="border-t border-l border-slate-600" />
              ))}
            </div>

            {paretoPoints.map((pt) => {
              const isSelected = selectedPoint?.id === pt.id;
              // Map PSNR (15 - 45 dB) to vertical height
              const heightPercent = ((pt.psnr - 15) / 30) * 100;
              return (
                <div
                  key={pt.id}
                  onClick={() => setSelectedPoint(pt)}
                  className="flex flex-col items-center cursor-pointer group relative z-10"
                >
                  {/* Point Marker */}
                  <div
                    style={{ bottom: `${heightPercent}%` }}
                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#10b981] shadow-lg shadow-[#10b981]/50 scale-125'
                        : pt.isElbow
                        ? 'bg-amber-400 shadow-md shadow-amber-400/40 hover:scale-110'
                        : 'bg-[#1e2632] border border-[#3b4756] hover:bg-[#10b981] hover:scale-110'
                    }`}
                  >
                    {pt.isElbow ? (
                      <Sparkles className="w-3 h-3 text-black" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Node label */}
                  <div className="mt-2 text-center text-xs font-mono">
                    <div className="text-slate-300 font-semibold">{pt.nodes} nodes</div>
                    <div className="text-[10px] text-slate-500">{pt.psnr} dB</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanation Footer */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-3">
            <span className="flex items-center space-x-1.5 text-amber-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Optimal Pareto Knee: 24 Nodes (Best Information/Complexity Ratio)</span>
            </span>
            <span className="text-slate-500">SSIM Range: 0.62 - 0.96</span>
          </div>
        </div>

        {/* Selected Candidate Formula Card */}
        <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Discovered Candidate</span>
              <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/15 px-2 py-0.5 rounded-full border border-[#10b981]/30">
                Gen {selectedPoint?.generation}
              </span>
            </div>

            <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-3 space-y-1">
              <div className="text-[10px] text-slate-500 font-mono">MATHEMATICAL FORMULATION</div>
              <p className="font-mono text-xs text-cyan-300 break-all leading-relaxed">
                {selectedPoint?.equation}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-2.5">
                <div className="text-[10px] text-slate-500 font-medium">PSNR Fidelity</div>
                <div className="text-base font-bold font-mono text-[#10b981] mt-0.5">
                  {selectedPoint?.psnr} dB
                </div>
              </div>
              <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-2.5">
                <div className="text-[10px] text-slate-500 font-medium">SSIM Accuracy</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {selectedPoint?.ssim}
                </div>
              </div>
              <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-2.5">
                <div className="text-[10px] text-slate-500 font-medium">AST Nodes</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {selectedPoint?.nodes}
                </div>
              </div>
              <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-2.5">
                <div className="text-[10px] text-slate-500 font-medium">Pareto Status</div>
                <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                  {selectedPoint?.isElbow ? 'Optimal Knee' : 'Frontier'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedPoint) onLoadFormula(selectedPoint.equation);
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs rounded-xl shadow-lg transition-all"
          >
            <span>Load Formula into Studio Viewport</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
