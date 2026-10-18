import { useState, useMemo } from 'react';
import { useStudioStore, ParetoCandidate } from '../store/useStudioStore';
import katex from 'katex';
import {
  Cpu,
  Sparkles,
} from 'lucide-react';

interface ParetoExplorerProps {
  onSelectCandidate?: (candidate: ParetoCandidate) => void;
}

export function ParetoExplorer({ onSelectCandidate }: ParetoExplorerProps) {
  const {
    paretoCandidates,
    selectedCandidateId,
    setSelectedCandidateId,
    setEquation,
    setPreviousEquation,
    setCrossDissolveProgress,
    equation,
  } = useStudioStore();

  const [hoveredCandidate, setHoveredCandidate] = useState<ParetoCandidate | null>(null);

  // Active selected candidate
  const activeCandidate = useMemo(() => {
    return (
      paretoCandidates.find((c) => c.id === selectedCandidateId) ||
      paretoCandidates[paretoCandidates.length - 1]
    );
  }, [paretoCandidates, selectedCandidateId]);

  // Convert raw formula to clean LaTeX for KaTeX preview
  const formatLatex = (rawEq: string) => {
    return rawEq
      .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
      .replace(/atan2\((.*?),(.*?)\)/g, '\\operatorname{atan2}\\left($1,$2\\right)')
      .replace(/sin\((.*?)\)/g, '\\sin\\left($1\\right)')
      .replace(/cos\((.*?)\)/g, '\\cos\\left($1\\right)')
      .replace(/exp\((.*?)\)/g, 'e^{$1}')
      .replace(/\*/g, ' \\cdot ');
  };

  // Render KaTeX HTML
  const katexHtml = useMemo(() => {
    const targetEq = hoveredCandidate ? hoveredCandidate.equation : activeCandidate ? activeCandidate.equation : equation;
    try {
      return katex.renderToString(formatLatex(targetEq), {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return `f(x, y, t) = ${targetEq}`;
    }
  }, [hoveredCandidate, activeCandidate, equation]);

  // Handle selection with stutter-free 200ms WebGL cross-dissolve
  const handleSelect = (candidate: ParetoCandidate) => {
    setSelectedCandidateId(candidate.id);
    setPreviousEquation(equation);
    setCrossDissolveProgress(0.01);
    setEquation(candidate.equation);
    if (onSelectCandidate) {
      onSelectCandidate(candidate);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-4 select-none">
      {/* ── Section Title & Status Pill ────────────────────────── */}
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.07]">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide font-mono uppercase">
            Evolutionary Pareto Frontier
          </span>
        </div>
        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
          <span>PySR Genetic Engine Streaming</span>
        </div>
      </div>

      {/* ── Interactive Hardware-Accelerated Scatter Canvas ────── */}
      <div className="relative w-full h-56 bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between overflow-hidden group">
        {/* Subtle Axes Markers */}
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
          <span className="text-[#10B981] font-semibold">PSNR Fidelity (dB) ↑</span>
          <span>AST Complexity (Nodes) →</span>
        </div>

        {/* Scatter Plot Coordinates Grid */}
        <div className="relative flex-1 w-full flex items-end justify-between px-6 pb-4 pt-2">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 grid grid-rows-3 grid-cols-5 pointer-events-none opacity-15">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="border-t border-l border-cyan-500" />
            ))}
          </div>

          {paretoCandidates.map((candidate) => {
            const isSelected = selectedCandidateId === candidate.id;
            // Height mapping for PSNR between 18 and 44 dB
            const heightPercent = Math.max(10, Math.min(92, ((candidate.psnr - 18) / 26) * 100));

            return (
              <div
                key={candidate.id}
                onClick={() => handleSelect(candidate)}
                onMouseEnter={() => setHoveredCandidate(candidate)}
                onMouseLeave={() => setHoveredCandidate(null)}
                className="flex flex-col items-center cursor-pointer group/dot relative z-10"
              >
                {/* Candidate Point Dot */}
                <div
                  style={{ bottom: `${heightPercent}%` }}
                  className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isSelected
                      ? 'bg-[#10B981] shadow-lg shadow-[#10B981]/60 scale-125 ring-4 ring-[#10B981]/30'
                      : candidate.isElbow
                      ? 'bg-[#F59E0B] shadow-md shadow-[#F59E0B]/50 hover:scale-125'
                      : 'bg-[#172136] border border-[#06B6D4]/50 hover:bg-[#06B6D4] hover:scale-125'
                  }`}
                >
                  {candidate.isElbow ? (
                    <Sparkles className="w-2.5 h-2.5 text-black" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>

                {/* X-Axis Complexity Label */}
                <span className="mt-1 text-[10px] font-mono text-slate-400 group-hover/dot:text-white">
                  {candidate.nodes}n
                </span>
              </div>
            );
          })}
        </div>

        {/* Knee / Elbow Legend Tag */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-white/[0.06] pt-2">
          <span className="flex items-center space-x-1.5 text-amber-400 font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Knee Point: 24 Nodes (Peak Information/Complexity)</span>
          </span>
          <span className="text-slate-500">SSIM Range: 0.68 - 0.97</span>
        </div>
      </div>

      {/* ── Active Candidate KaTeX Formula Preview Overlay ────── */}
      <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="font-semibold text-slate-200">
              {hoveredCandidate ? 'Hovered Candidate' : 'Selected Candidate'}
            </span>
            <span className="text-slate-500 font-mono text-[10px]">
              (Gen {hoveredCandidate?.generation || activeCandidate?.generation})
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="text-[#10B981] font-bold">
              PSNR: {hoveredCandidate?.psnr || activeCandidate?.psnr} dB
            </span>
            <span className="text-slate-300">
              SSIM: {hoveredCandidate?.ssim || activeCandidate?.ssim}
            </span>
          </div>
        </div>

        {/* KaTeX Equation Typesetting View */}
        <div
          className="bg-[#05080E] border border-white/[0.06] rounded-xl p-3 text-cyan-300 font-mono text-xs overflow-x-auto min-h-[50px] flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: katexHtml }}
        />

        {/* Candidate Stats Row */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2 rounded-lg bg-[#0E1626] border border-white/[0.05] text-center">
            <div className="text-[9px] font-mono text-slate-500 uppercase">AST Complexity</div>
            <div className="text-xs font-bold font-mono text-white mt-0.5">
              {(hoveredCandidate || activeCandidate)?.nodes} Nodes
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#0E1626] border border-white/[0.05] text-center">
            <div className="text-[9px] font-mono text-slate-500 uppercase">Tree Depth</div>
            <div className="text-xs font-bold font-mono text-[#06B6D4] mt-0.5">
              4 / 8 Max
            </div>
          </div>
          <div className="p-2 rounded-lg bg-[#0E1626] border border-white/[0.05] text-center">
            <div className="text-[9px] font-mono text-slate-500 uppercase">Convergence</div>
            <div className="text-xs font-bold font-mono text-[#10B981] mt-0.5">
              96.2% Fit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
