import { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  TrendingDown, 
  CheckCircle, 
  FileText, 
  Cpu, 
  Binary, 
  Activity,
  Terminal
} from 'lucide-react';
import { LeafNode } from './DendriteGraph';

interface InspectorCardProps {
  selectedLeaf: LeafNode;
  equation: string;
  onExploreDetails?: () => void;
}

export function InspectorCard({
  selectedLeaf,
  equation,
  onExploreDetails,
}: InspectorCardProps) {
  // Equalizer spectrum bars simulation
  const [eqBars, setEqBars] = useState<number[]>([
    25, 30, 48, 65, 82, 95, 88, 72, 55, 68, 88, 100, 78, 62, 45, 32, 28, 38, 52, 68, 82, 92, 72, 52
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setEqBars((prev) =>
        prev.map((val) => {
          const delta = (Math.random() - 0.5) * 18;
          return Math.max(12, Math.min(100, val + delta));
        })
      );
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-[380px] tech-panel p-5 flex flex-col space-y-4 text-slate-100 shadow-2xl z-20 select-none overflow-y-auto max-h-[calc(100vh-4.5rem)]">
      {/* ── Category Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#1C2530] pb-2 text-[10px] font-mono text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span className="uppercase tracking-wider">DOSSIER // MATH-SPEC-42</span>
        </div>
        <span className="text-[#10B981] bg-[#10B981]/10 px-1 py-0.2 border border-[#10B981]/30">
          [VERIFIED]
        </span>
      </div>

      {/* ── Model Title & Promulgation ─────────────────────────── */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-slate-500 uppercase">
          FORMULATION SPECIFICATION
        </div>
        <h2 className="text-sm font-mono font-bold leading-snug tracking-tight text-white uppercase">
          MANIFOLD MODEL // {selectedLeaf.name}
        </h2>

        {/* Status Line */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-400">
            <span className="text-slate-300 font-bold bg-[#141A22] px-1 py-0.2 border border-[#232C37]">
              REV: 2026.10
            </span>
            <span>SYNTHESIZED</span>
          </div>

          <button
            onClick={onExploreDetails}
            className="flex items-center space-x-1 text-[10px] font-mono text-[#00F0FF] hover:text-white transition uppercase group bg-[#00F0FF]/10 px-2 py-0.5 border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20"
          >
            <span>INSPECT [F3]</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── Sentiment Rate / Visual Fidelity Hero Widget ────────── */}
      <div className="tech-card p-3 space-y-2 border border-[#232C37]">
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-slate-400 uppercase tracking-wider">VISUAL FIDELITY METER</span>
          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-[#1C2530] border border-[#2A3644] text-amber-400 font-bold">
            [OPTIMAL]
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-mono font-extrabold tracking-tight text-white">
              45.0%
            </span>
            <div className="flex items-center space-x-0.5 text-[10px] text-rose-400 font-mono">
              <TrendingDown className="w-2.5 h-2.5" />
              <span>-4.2%</span>
              <span className="text-[9px] text-slate-500 ml-1">EPOCH</span>
            </div>
          </div>

          <span className="text-[10px] font-mono text-[#00F0FF] bg-[#00F0FF]/10 px-1.5 py-0.5 border border-[#00F0FF]/30">
            PSNR: 36.20 dB
          </span>
        </div>

        {/* Sharp Precision Frequency Equalizer Bars (Flat Tops, Zero Rounding) */}
        <div className="h-8 w-full flex items-end justify-between space-x-[2px] pt-1 border-b border-[#1C2530] pb-1">
          {eqBars.map((height, idx) => (
            <div
              key={idx}
              style={{ height: `${height}%` }}
              className="flex-1 bg-gradient-to-t from-amber-600/40 via-amber-500 to-rose-500 transition-all duration-75"
            />
          ))}
        </div>
      </div>

      {/* ── 2x2 Bento Matrix (Crisp Hairline Grid) ─────────────── */}
      <div className="grid grid-cols-2 gap-px bg-[#1F2730] border border-[#1F2730]">
        {/* Cell 1 */}
        <div className="bg-[#0A0D12] p-2.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <CheckCircle className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="text-[9px] font-mono text-[#00F0FF]">LVL</span>
          </div>
          <div className="text-base font-bold font-mono text-white">12</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase">
            AST Depth Levels
          </div>
        </div>

        {/* Cell 2 */}
        <div className="bg-[#0A0D12] p-2.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <FileText className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[9px] font-mono text-[#10B981]">CH</span>
          </div>
          <div className="text-base font-bold font-mono text-white">04</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase">
            RGBA Channels
          </div>
        </div>

        {/* Cell 3 */}
        <div className="bg-[#0A0D12] p-2.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[9px] font-mono text-amber-400">OPS</span>
          </div>
          <div className="text-base font-bold font-mono text-white">18</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase">
            Math Operators
          </div>
        </div>

        {/* Cell 4 */}
        <div className="bg-[#0A0D12] p-2.5 flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[9px] font-mono text-purple-400">GPU</span>
          </div>
          <div className="text-base font-bold font-mono text-white">60</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase">
            FPS Headless EGL
          </div>
        </div>
      </div>

      {/* ── Neuro-Symbolic / AST Optimization Section ──────────── */}
      <div className="tech-card p-3 space-y-2 border border-[#232C37]">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
          <div className="flex items-center space-x-1.5">
            <Binary className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="uppercase font-bold">NEURO-SYMBOLIC REDUCTION</span>
          </div>
          <span className="text-[#10B981]">[ELBOW]</span>
        </div>

        <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
          AST Curvature optimization isolated 3 redundant trigonometric coefficients. Pruned with zero perceptual variance (D-SSIM &lt; 0.002).
        </p>

        {/* Monospaced Code Formula Snippet */}
        <div className="p-2 bg-[#050709] border border-[#1E252D] font-mono text-[9px] text-[#00F0FF] overflow-x-auto truncate">
          &gt; {equation}
        </div>
      </div>
    </div>
  );
}
