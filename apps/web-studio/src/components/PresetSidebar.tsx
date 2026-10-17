import { ShieldCheck, Sliders, BookOpen } from 'lucide-react';
import { PRESETS } from './FormulaCommandBar';

interface PresetSidebarProps {
  selectedPreset: string;
  onSelectPreset: (name: string) => void;
  domainScale: number;
  setDomainScale: (val: number) => void;
  safeMode: boolean;
  setSafeMode: (val: boolean) => void;
}

export function PresetSidebar({
  selectedPreset,
  onSelectPreset,
  domainScale,
  setDomainScale,
  safeMode,
  setSafeMode,
}: PresetSidebarProps) {
  return (
    <aside className="w-72 flex flex-col space-y-4 select-none shrink-0">
      {/* ── Curated Formula Gallery ────────────────────────────── */}
      <div className="bg-[#0f1318] border border-[#1d242e] rounded-2xl p-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center space-x-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Preset Gallery</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">5 Curated</span>
        </div>

        <div className="flex flex-col space-y-2">
          {Object.entries(PRESETS).map(([key, item]) => {
            const isSelected = selectedPreset === key;
            return (
              <div
                key={key}
                onClick={() => onSelectPreset(key)}
                className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#18212c] border-[#10b981]/50 text-white shadow-sm'
                    : 'bg-[#12171e] border-[#1c232d] text-slate-300 hover:border-[#2a3442] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[11px] truncate">{key}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />}
                </div>
                <p className="text-[10px] font-mono text-slate-400 line-clamp-1 truncate">
                  {item.formula}
                </p>
                <div className="mt-1.5 flex items-center space-x-1 text-[9px] text-slate-500">
                  <span className="bg-[#1a222c] px-1.5 py-0.5 rounded text-[#10b981]">Continuous</span>
                  <span className="bg-[#1a222c] px-1.5 py-0.5 rounded">f(x, y, t)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Domain & Synthesis Controls ────────────────────────── */}
      <div className="bg-[#0f1318] border border-[#1d242e] rounded-2xl p-4 flex flex-col space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <div className="flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Domain Controls</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Continuous 2D</span>
        </div>

        {/* Domain Scale [-L, +L] */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Coordinate Span</span>
            <span className="text-white">[-{domainScale.toFixed(1)}, +{domainScale.toFixed(1)}]²</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={domainScale}
            onChange={(e) => setDomainScale(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#1b222a] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
          />
        </div>

        {/* Singularity Guard Mode */}
        <div className="pt-2 border-t border-[#1d242e]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              <div className="text-[11px] text-slate-300 font-medium">Singularity Guard</div>
            </div>
            <button
              onClick={() => setSafeMode(!safeMode)}
              className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                safeMode ? 'bg-[#10b981]' : 'bg-[#212a36]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-black transition-transform ${
                  safeMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Replaces zero divisors with safe limits (abs(b) &lt; 1e-6)
          </p>
        </div>
      </div>
    </aside>
  );
}
