import { Sparkles, Terminal, Activity, Layers, Target, Code, Cpu } from 'lucide-react';

export type StudioTab = 'studio' | 'ast' | 'pareto' | 'target' | 'export';

interface NavbarProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  resolution: string;
  setResolution: (res: string) => void;
  onNewFormula: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  resolution,
  setResolution,
  onNewFormula,
}: NavbarProps) {
  const tabs: { id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'studio', label: 'Studio Viewport', icon: Activity },
    { id: 'ast', label: 'Symbolic AST Lab', icon: Layers },
    { id: 'pareto', label: 'Pareto Frontier', icon: Cpu },
    { id: 'target', label: 'Target Reconstruction', icon: Target },
    { id: 'export', label: 'GLSL Exporter', icon: Code },
  ];

  return (
    <header className="w-full bg-[#0b0e12]/95 backdrop-blur-md border-b border-[#1b2129] px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 select-none">
      {/* ── Brand & Identity ───────────────────────────────────── */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('studio')}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#059669] to-[#10b981] flex items-center justify-center shadow-lg shadow-[#10b981]/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="text-base font-extrabold tracking-tight text-white font-mono">pixmath</span>
              <span className="text-sm font-black text-[#10b981]">&gt;</span>
              <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded-full ml-1 border border-[#10b981]/30">v0.1.0</span>
            </div>
            <p className="text-[10px] text-slate-500 font-sans -mt-0.5">Implicit Neural & Symbolic Synthesis</p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-[#1f2630] hidden md:block" />

        {/* Navigation Tabs (Full Web Mode) */}
        <nav className="hidden lg:flex items-center space-x-1 bg-[#12161c] p-1 rounded-xl border border-[#1e252f]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#1b222b] text-white shadow-sm border border-[#2d3744]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161b22]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#10b981]' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Right Controls & Telemetry Status ─────────────────── */}
      <div className="flex items-center space-x-3">
        {/* ModernGL EGL Worker Status */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-[#12161c] border border-[#1e252f] rounded-full text-xs text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
          </span>
          <span className="font-mono text-[11px] text-slate-400">EGL Engine:</span>
          <span className="font-semibold text-slate-200 text-[11px]">Ready</span>
        </div>

        {/* Resolution Selector */}
        <div className="flex items-center bg-[#12161c] border border-[#1e252f] rounded-full p-1 text-xs">
          {['512²', '1024²', '4K'].map((res) => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all ${
                resolution === res
                  ? 'bg-[#1b222b] text-[#10b981] font-bold border border-[#2d3744]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {res}
            </button>
          ))}
        </div>

        {/* New Formula Action */}
        <button
          onClick={onNewFormula}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs rounded-full shadow-lg shadow-[#10b981]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>+ New Formula</span>
        </button>
      </div>
    </header>
  );
}
