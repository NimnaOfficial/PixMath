import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  HelpCircle, 
  ChevronUp, 
  Grid,
  Move
} from 'lucide-react';

export function BottomMatrix() {
  // 4 row categories from des2.jpg
  const categories = ['Harmonics', 'CSG SDFs', 'Noise Warps', 'Pareto Fits'];

  return (
    <div className="h-[210px] w-full px-6 pb-6 pt-2 flex space-x-5 select-none">
      {/* ── Left: 360 View by Blocks / Coordinate Matrix ──────── */}
      <div className="w-[440px] h-full bg-[#111417] border border-[#20252b] rounded-2xl p-4 flex flex-col justify-between">
        {/* Title */}
        <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
          <span>360° View by Blocks</span>
          <span className="text-[10px] font-mono text-slate-500">Cartesian [-1, 1]²</span>
        </div>

        {/* Matrix Grid with Row Labels and Floating Pins */}
        <div className="flex items-center space-x-4">
          {/* Row Labels */}
          <div className="flex flex-col space-y-2 text-[10px] font-mono text-slate-400">
            {categories.map((cat) => (
              <span key={cat} className="h-4 flex items-center">{cat}</span>
            ))}
          </div>

          {/* Dots Grid with Floating Pins */}
          <div className="flex-1 h-24 bg-[#0d0f12] border border-[#1d2227] rounded-xl p-3 relative flex items-center justify-center">
            {/* Dot Grid Background */}
            <div className="grid grid-cols-12 gap-2 opacity-30">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-slate-400" />
              ))}
            </div>

            {/* Floating Navigation / Crosshair Controller (from des2.jpg) */}
            <div className="absolute flex items-center space-x-1.5 bg-[#1a1e23]/95 border border-[#282f37] px-2.5 py-1 rounded-full shadow-lg">
              <Move className="w-3 h-3 text-[#10b981]" />
              <span className="text-[9px] font-mono text-slate-300">Coordinate Focus</span>
            </div>

            {/* Pins on the Matrix */}
            <div className="absolute top-2 left-6 w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
            <div className="absolute bottom-3 left-10 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
            <div className="absolute top-4 right-10 w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
            <div className="absolute bottom-2 right-14 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
          </div>
        </div>
      </div>

      {/* ── Right: Total Attacks by Alerts / 4 Bento Cards ─────── */}
      <div className="flex-1 h-full flex flex-col justify-between">
        {/* Section Header */}
        <div className="flex justify-between items-center text-xs font-semibold text-slate-300 px-1">
          <span>Total Mathematical Synthesis Telemetry</span>
          <div className="flex items-center space-x-2 text-slate-400">
            <button className="p-1 hover:text-white transition">
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 hover:text-white transition">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Bento Cards (Protected, Danger, Alerts, Unknown) */}
        <div className="grid grid-cols-4 gap-3.5 h-[145px]">
          {/* Card 1: Protected */}
          <div className="bg-[#14171a] border border-[#23282e] hover:border-[#10b981]/50 rounded-2xl p-4 flex flex-col justify-between transition-all group">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Verified</span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-500 font-medium">Evaluated Pixels</div>
              <div className="text-xl font-bold font-mono text-white tracking-tight">
                882k <span className="text-xs text-slate-500 font-normal">/ 992k</span>
              </div>
            </div>
          </div>

          {/* Card 2: Danger (Guarded Singularities) */}
          <div className="bg-[#14171a] border border-[#23282e] hover:border-rose-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Guarded</span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-500 font-medium">Safe Singularities</div>
              <div className="text-xl font-bold font-mono text-white tracking-tight">
                1.2k <span className="text-xs text-slate-500 font-normal">/ 992k</span>
              </div>
            </div>
          </div>

          {/* Card 3: Alerts (Active Modulators) */}
          <div className="bg-[#14171a] border border-[#23282e] hover:border-amber-400/50 rounded-2xl p-4 flex flex-col justify-between transition-all group">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Modulators</span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-500 font-medium">Active Frequencies</div>
              <div className="text-xl font-bold font-mono text-white tracking-tight">
                7.4k <span className="text-xs text-slate-500 font-normal">/ 992k</span>
              </div>
            </div>
          </div>

          {/* Card 4: Unknown (Pruned Pareto Terms) */}
          <div className="bg-[#14171a] border border-[#23282e] hover:border-slate-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all group">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-slate-700/40 flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-xs font-semibold text-slate-200">Pruned</span>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-500 font-medium">Reduced AST Nodes</div>
              <div className="text-xl font-bold font-mono text-white tracking-tight">
                1.1k <span className="text-xs text-slate-500 font-normal">/ 992k</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
