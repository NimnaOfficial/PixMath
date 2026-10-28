import { useStudioStore } from '../store/useStudioStore';
import {
  Sparkles,
  ArrowRightLeft,
  Zap,
  Cpu,
  BookOpen,
} from 'lucide-react';

interface StudioTopbarProps {
  onPresetSelect?: (presetName: string) => void;
}

export function StudioTopbar({ onPresetSelect }: StudioTopbarProps) {
  const {
    mode,
    setMode,
    gpuFps,
    renderLatencyMs,
    resolutionMultiplier,
    setResolutionMultiplier,
    setEquation,
  } = useStudioStore();

  const presets = [
    {
      name: 'Solar Plasma (Yeganeh)',
      eq: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)',
    },
    {
      name: 'Nested Torus SDF',
      eq: 'cos(12.0 * (sqrt(x*x + y*y) - 0.5) + t) * sin(6.0 * x * y)',
    },
    {
      name: 'Quantum Wave Dec',
      eq: 'exp(-1.5 * (x*x + y*y)) * sin(14.0 * x) * cos(14.0 * y + t * 1.5)',
    },
    {
      name: 'Hyperbolic Bloom',
      eq: 'sin(5.0 * x) * sin(5.0 * y) + cos(8.0 * sqrt(x*x + y*y) - t)',
    },
  ];

  return (
    <header className="w-full bg-[#05080E]/95 backdrop-blur-md border-b border-white/[0.08] px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 select-none hw-accelerate">
      {/* ── Brand & Core Identity ──────────────────────────────── */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#06B6D4] to-[#10B981] flex items-center justify-center shadow-lg shadow-[#06B6D4]/20">
            <Sparkles className="w-4 h-4 text-black font-bold" />
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5 font-mono">
              <span className="text-base font-extrabold tracking-tight text-white">pixmath</span>
              <span className="text-sm font-black text-[#06B6D4]">&gt;</span>
              <span className="text-[10px] text-[#06B6D4] bg-[#06B6D4]/15 px-2 py-0.5 rounded-full border border-[#06B6D4]/30">
                STUDIO v0.2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono -mt-0.5">
              Bidirectional Math ↔ GPU Synthesis Workstation
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-white/[0.08] hidden md:block" />

        {/* Mode Toggle Switcher: Forward vs Reverse */}
        <div className="flex items-center bg-[#0A0F1D] p-1 rounded-xl border border-white/[0.08]">
          <button
            onClick={() => setMode('forward')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              mode === 'forward'
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/50 shadow-md shadow-[#06B6D4]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Forward Mode (Math → Image)</span>
          </button>

          <button
            onClick={() => setMode('reverse')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              mode === 'reverse'
                ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/50 shadow-md shadow-[#EC4899]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Reverse Mode</span>
          </button>

          <button
            onClick={() => setMode('help')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              mode === 'help'
                ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/50 shadow-md shadow-[#10B981]/10'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Comprehensive Documentation & Feature Guides"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Help &amp; Guides</span>
          </button>
        </div>
      </div>

      {/* ── Center Preset Dropdown ─────────────────────────────── */}
      <div className="hidden xl:flex items-center space-x-1.5">
        {presets.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setEquation(p.eq);
              if (onPresetSelect) onPresetSelect(p.name);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#0A0F1D] border border-white/[0.06] text-slate-400 hover:text-[#06B6D4] hover:border-[#06B6D4]/40 transition"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* ── Right Telemetry & Job Stats ────────────────────────── */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        {/* Resolution Scaler */}
        <div className="flex items-center bg-[#0A0F1D] border border-white/[0.08] rounded-full p-1 text-[11px]">
          {[
            { label: '1x (FHD)', val: 1.0 },
            { label: '2x (Retina)', val: 2.0 },
            { label: '4K', val: 4.0 },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => setResolutionMultiplier(r.val)}
              className={`px-2.5 py-0.5 rounded-full transition-all ${
                resolutionMultiplier === r.val
                  ? 'bg-[#06B6D4]/25 text-[#06B6D4] font-bold border border-[#06B6D4]/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Live GPU FPS & Latency */}
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#0A0F1D] border border-white/[0.08] rounded-full text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
          </span>
          <span className="text-[#10B981] font-bold">{gpuFps} FPS</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{renderLatencyMs} ms</span>
        </div>

        {/* EGL Engine Status */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-[#0A0F1D] border border-white/[0.08] rounded-full text-slate-400">
          <Cpu className="w-3 h-3 text-[#06B6D4]" />
          <span>ModernGL EGL:</span>
          <span className="text-white font-semibold">Online</span>
        </div>
      </div>
    </header>
  );
}
