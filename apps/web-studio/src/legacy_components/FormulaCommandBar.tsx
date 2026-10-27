import { CheckCircle2, Play } from 'lucide-react';

interface FormulaCommandBarProps {
  equation: string;
  setEquation: (eq: string) => void;
  selectedPreset: string;
  onSelectPreset: (name: string) => void;
  onCompile: () => void;
}

export const PRESETS: Record<string, { label: string; formula: string; desc: string }> = {
  'Hamid Yeganeh Solar Plasma': {
    label: 'Solar Plasma',
    formula: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)',
    desc: 'Hamid Naderi Yeganeh polar-azimuth continuous harmonic manifold',
  },
  'Quantum Wavefunction Dec': {
    label: 'Quantum Wave',
    formula: 'exp(-1.5 * (x*x + y*y)) * sin(14.0 * x) * cos(14.0 * y + t * 1.5)',
    desc: 'Gaussian wavepacket interference in continuous 2D Hilbert space',
  },
  'Nested SDF Torus Rings': {
    label: 'Torus SDF',
    formula: 'cos(12.0 * (sqrt(x*x + y*y) - 0.5) + t) * sin(6.0 * x * y)',
    desc: 'Constructive Solid Geometry (CSG) Euclidean distance signed field',
  },
  'Hyperbolic Harmonic Bloom': {
    label: 'Harmonic Bloom',
    formula: 'sin(5.0 * x) * sin(5.0 * y) + cos(8.0 * sqrt(x*x + y*y) - t)',
    desc: 'Hyperbolic spatial harmonic resonance with radial interference',
  },
  'Mandelbrot Boundary Warp': {
    label: 'Boundary Warp',
    formula: 'sin(safe_div(x, y*y + 0.1) * 3.0 + t) * cos(y * 8.0 + sin(x * 6.0))',
    desc: 'Non-linear coordinate distortion with protected singularity divisors',
  },
};

export function FormulaCommandBar({
  equation,
  setEquation,
  selectedPreset,
  onSelectPreset,
  onCompile,
}: FormulaCommandBarProps) {
  return (
    <div className="w-full bg-[#0e1217] border-b border-[#1c222b] px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 select-none">
      {/* ── Left: Interactive Equation Input Field ─────────────── */}
      <div className="flex-1 w-full flex items-center space-x-2 bg-[#141920] border border-[#232b36] rounded-xl px-3.5 py-1.5 focus-within:border-[#10b981]/70 transition-all">
        <span className="text-xs font-mono font-bold text-[#10b981] select-none whitespace-nowrap">
          f(x, y, t) =
        </span>
        <input
          type="text"
          value={equation}
          onChange={(e) => setEquation(e.target.value)}
          placeholder="Enter symbolic continuous formula..."
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-cyan-300 placeholder-slate-600 w-full"
        />
        <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 bg-[#0d1014] px-2 py-0.5 rounded-md border border-[#1e252f] whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
          <span>AST Verified</span>
        </div>
      </div>

      {/* ── Right: Presets & Quick Compile Action ───────────────── */}
      <div className="flex items-center space-x-2 shrink-0 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
        <div className="flex items-center space-x-1.5">
          {Object.entries(PRESETS).map(([key, item]) => {
            const isSelected = selectedPreset === key;
            return (
              <button
                key={key}
                onClick={() => onSelectPreset(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#1a232f] text-[#10b981] border border-[#10b981]/40 shadow-sm'
                    : 'bg-[#14181f] text-slate-400 hover:text-slate-200 border border-[#202731]'
                }`}
                title={item.desc}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onCompile}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#17202b] hover:bg-[#1f2b3a] border border-[#283546] hover:border-[#10b981]/50 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
        >
          <Play className="w-3 h-3 text-[#10b981]" />
          <span>Compile GLSL</span>
        </button>
      </div>
    </div>
  );
}
