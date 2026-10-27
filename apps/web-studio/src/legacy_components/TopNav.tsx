import { 
  Network, 
  Layers, 
  Maximize2, 
  Plus, 
  Minus, 
  Filter, 
  Search, 
  SlidersHorizontal,
  Monitor,
  Activity
} from 'lucide-react';

interface TopNavProps {
  viewMode: 'graph' | 'shader' | 'split';
  setViewMode: (mode: 'graph' | 'shader' | 'split') => void;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  onNewSynthesis: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export function TopNav({
  viewMode,
  setViewMode,
  scale,
  setScale,
  onNewSynthesis,
  searchTerm,
  setSearchTerm,
}: TopNavProps) {
  return (
    <header className="h-14 border-b border-[#1C232B] bg-[#070A0E] flex items-center justify-between px-6 z-30 select-none relative">
      {/* ── Left Industrial Brand Identity ────────────────────── */}
      <div className="flex items-center space-x-3">
        {/* Sharp Square Aperture Logo */}
        <div className="w-8 h-8 bg-[#0D1217] border border-[#232C37] flex items-center justify-center relative">
          <div className="w-3.5 h-3.5 border-t border-l border-[#00F0FF]" />
          <span className="font-mono text-xs font-bold text-[#00F0FF] absolute">π</span>
          <div className="w-3.5 h-3.5 border-b border-r border-[#00F0FF] absolute" />
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono font-bold text-xs tracking-wider text-white uppercase">
              PIXMATH // WORKBENCH
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-1 py-0.2">
              SYSTEM: ONLINE
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
            Bidirectional Mathematical Image Engine
          </p>
        </div>
      </div>

      {/* ── Center Sharp Segmented Command Dock ────────────────── */}
      <div className="flex items-center space-x-2">
        {/* View Mode Segmented Controls */}
        <div className="flex bg-[#0A0E13] border border-[#1C232B] p-0.5">
          <button
            onClick={() => setViewMode('graph')}
            title="AST Dendrite Matrix"
            className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-[11px] uppercase transition-all ${
              viewMode === 'graph'
                ? 'bg-[#16212B] text-[#00F0FF] border-b-2 border-[#00F0FF] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>01 // Matrix</span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            title="Split Workbench HUD"
            className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-[11px] uppercase transition-all ${
              viewMode === 'split'
                ? 'bg-[#16212B] text-[#00F0FF] border-b-2 border-[#00F0FF] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>02 // Split</span>
          </button>

          <button
            onClick={() => setViewMode('shader')}
            title="Full GPU Viewport"
            className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-[11px] uppercase transition-all ${
              viewMode === 'shader'
                ? 'bg-[#16212B] text-[#00F0FF] border-b-2 border-[#00F0FF] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>03 // Viewport</span>
          </button>
        </div>

        {/* Sharp Numeric Zoom Controller */}
        <div className="flex items-center bg-[#0A0E13] border border-[#1C232B] p-0.5 font-mono text-xs text-slate-300">
          <button
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
            title="Zoom Out"
            className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] text-slate-400 hover:text-white transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          
          <span className="w-12 text-center text-[10px] text-slate-400 border-x border-[#1C232B] py-1">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
            title="Zoom In"
            className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] text-slate-400 hover:text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tools Segment */}
        <div className="flex bg-[#0A0E13] border border-[#1C232B] p-0.5">
          <button
            title="Filter Layers"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            title="Parameter Controls"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale(1.0)}
            title="Reset Scale"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Right System Actions ───────────────────────────────── */}
      <div className="flex items-center space-x-3">
        {/* Monospaced Precision Search */}
        <div className="hidden lg:flex items-center bg-[#090C10] border border-[#1C232B] px-3 py-1.5 w-64 space-x-2">
          <Search className="w-3 h-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="FILTER NODES [CTRL+K]..."
            className="bg-transparent border-none outline-none font-mono text-[10px] text-white placeholder-slate-600 w-full uppercase"
          />
        </div>

        {/* Sharp High-Contrast Action Button */}
        <button
          onClick={onNewSynthesis}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#00F0FF] hover:bg-[#38bdf8] text-black font-mono font-bold text-xs uppercase tracking-wider transition active:bg-white"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>SYNTHESIS</span>
        </button>

        {/* Telemetry Badge */}
        <div className="flex items-center space-x-1 border border-[#1C232B] bg-[#0A0E13] px-2 py-1 text-[10px] font-mono text-slate-400">
          <Activity className="w-3 h-3 text-[#10B981]" />
          <span>60 FPS</span>
        </div>
      </div>
    </header>
  );
}
