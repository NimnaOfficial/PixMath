import { useState } from 'react';
import { ArrowLeft, ChevronDown, RotateCw, MoreHorizontal, ShieldCheck } from 'lucide-react';

interface IntensityGraphProps {
  onBack?: () => void;
  equation: string;
}

export function IntensityGraph({ onBack, equation }: IntensityGraphProps) {
  const [trendRange, setTrendRange] = useState('Monthly Trend');
  const [timeWindow, setTimeWindow] = useState('Last 12 Hour');

  return (
    <div className="w-[300px] flex flex-col justify-between py-6 pl-6 pr-2 select-none">
      {/* ── Top Header Section ─────────────────────────────────── */}
      <div className="space-y-6">
        {/* Back Button & Title */}
        <div className="space-y-4">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#1c2025] hover:bg-[#252a31] border border-[#282f37] flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
              Mathematical<br />Performance
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono truncate max-w-[240px]" title={equation}>
              {equation || 'Continuous Domain f(x, y, t)'}
            </p>
          </div>
        </div>

        {/* ── Alerts / Harmonic Intensity Chart ──────────────────── */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-medium text-slate-300">
            <span>Harmonic Intensity in Blocks</span>
          </div>

          {/* SVG Sparkline & Spikes (Exact replication from des2.jpg) */}
          <div className="h-28 w-full bg-[#14171a] border border-[#23282e] rounded-xl p-3 relative flex flex-col justify-between">
            {/* Upper Value Labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>316 Hz</span>
              <span>564 Hz</span>
            </div>

            {/* SVG Waveform / Spikes */}
            <svg className="w-full h-12 overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 40">
              <path
                d="M 0 35 L 20 34 L 35 25 L 45 32 L 60 10 L 70 30 L 85 8 L 95 28 L 110 5 L 125 32 L 140 18 L 155 33 L 170 12 L 185 28 L 200 35"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Fill Area Gradient */}
              <defs>
                <linearGradient id="intensity-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 35 L 20 34 L 35 25 L 45 32 L 60 10 L 70 30 L 85 8 L 95 28 L 110 5 L 125 32 L 140 18 L 155 33 L 170 12 L 185 28 L 200 35 L 200 40 L 0 40 Z"
                fill="url(#intensity-grad)"
              />
            </svg>

            {/* Lower Timeline Needles / Markers (72, 50, 100) */}
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 pt-1 border-t border-[#23282e]">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span>72</span>
              </span>
              <span className="flex items-center space-x-1 text-[#10b981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                <span>50</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span>100</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Filter Pills ────────────────────────────────── */}
      <div className="space-y-2 pt-4">
        <div className="flex items-center space-x-2">
          {/* Monthly Trend Pill */}
          <div
            onClick={() => setTrendRange((prev) => (prev === 'Monthly Trend' ? 'Weekly Trend' : 'Monthly Trend'))}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-[#171b1f] border border-[#252b32] rounded-full text-xs text-slate-300 hover:border-slate-500 transition cursor-pointer"
          >
            <span>{trendRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>

          {/* Last 12 Hour Pill */}
          <div
            onClick={() => setTimeWindow((prev) => (prev === 'Last 12 Hour' ? 'Last 24 Hour' : 'Last 12 Hour'))}
            className="flex-1 flex items-center justify-between px-3 py-1.5 bg-[#171b1f] border border-[#252b32] rounded-full text-xs text-slate-300 hover:border-slate-500 transition cursor-pointer"
          >
            <span>{timeWindow}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex items-center space-x-2">
          <button className="p-2 bg-[#171b1f] hover:bg-[#20252b] border border-[#252b32] rounded-full text-slate-400 hover:text-white transition">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button className="p-2 bg-[#171b1f] hover:bg-[#20252b] border border-[#252b32] rounded-full text-slate-400 hover:text-white transition">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button className="p-2 bg-[#171b1f] hover:bg-[#20252b] border border-[#252b32] rounded-full text-slate-400 hover:text-white transition">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
          </button>
        </div>
      </div>
    </div>
  );
}
