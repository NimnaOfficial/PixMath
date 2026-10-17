import { Plus, X, Zap, Cpu } from 'lucide-react';

interface RadialGaugesProps {
  psnr: number;
  complexity: number;
  onCompile?: () => void;
}

export function RadialGauges({
  psnr = 98.1,
  complexity = 24,
  onCompile,
}: RadialGaugesProps) {
  // SVG Circular Gauge Calculations
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  
  // Progress calculations
  const psnrPercent = Math.min(100, (psnr / 40.0) * 100);
  const psnrOffset = circumference - (psnrPercent / 100) * circumference;

  const compPercent = Math.min(100, (complexity / 32) * 100);
  const compOffset = circumference - (compPercent / 100) * circumference;

  return (
    <div className="w-[180px] flex flex-col justify-between py-6 pr-6 pl-2 select-none">
      {/* ── Gauges Stack ───────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Radial Gauge 1: Visual Fidelity (PSNR) */}
        <div className="flex flex-col items-center p-4 bg-[#14171b] border border-[#23282f] rounded-2xl relative">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-[#20252b]"
                strokeWidth="5"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Arc */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                stroke="#10b981"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={psnrOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Metric Value Inside Ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Zap className="w-4 h-4 text-[#10b981] mb-0.5" />
            </div>
          </div>

          {/* Subtext and Large Metric Readout */}
          <div className="mt-2 text-center">
            <div className="text-[10px] text-slate-500 font-medium">
              Visual Fidelity
            </div>
            <div className="text-base font-bold text-white tracking-tight font-mono">
              981 <span className="text-slate-500 text-xs font-normal">/ 1.7k</span>
            </div>
          </div>
        </div>

        {/* Radial Gauge 2: AST Complexity Budget */}
        <div className="flex flex-col items-center p-4 bg-[#14171b] border border-[#23282f] rounded-2xl relative">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="text-[#20252b]"
                strokeWidth="5"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Arc in Coral / Amber */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                stroke="#f43f5e"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={compOffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Cpu className="w-4 h-4 text-[#f43f5e] mb-0.5" />
            </div>
          </div>

          <div className="mt-2 text-center">
            <div className="text-[10px] text-slate-500 font-medium">
              AST Complexity
            </div>
            <div className="text-base font-bold text-white tracking-tight font-mono">
              2.4k <span className="text-slate-500 text-xs font-normal">/ 8k</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Action Pill (+ Compile GLSL) ────────────────── */}
      <div className="pt-4">
        <button
          onClick={onCompile}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-[#171b1f] hover:bg-[#20252b] border border-[#282f37] rounded-full text-xs text-slate-300 hover:text-white transition group"
        >
          <div className="flex items-center space-x-1.5">
            <Plus className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="font-semibold">Compile GLSL</span>
          </div>
          <X className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
        </button>
      </div>
    </div>
  );
}
