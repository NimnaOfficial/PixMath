import { useState } from 'react';
import { Search, ChevronDown, Bell, Settings, X, Plus } from 'lucide-react';

interface SplunkHeaderProps {
  viewMode: 'view' | 'compiler' | 'pareto';
  setViewMode: (mode: 'view' | 'compiler' | 'pareto') => void;
  selectedFormula: string;
  onSelectFormula: (name: string) => void;
}

export function SplunkHeader({
  viewMode,
  setViewMode,
  selectedFormula,
  onSelectFormula,
}: SplunkHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const formulas = [
    'Hamid Yeganeh Solar Plasma',
    'Nested SDF Torus Rings',
    'Quantum Wavefunction Dec',
    'Hyperbolic Harmonic Bloom',
  ];

  return (
    <div className="flex flex-col border-b border-[#21262d] bg-[#111417] select-none z-30">
      {/* ── macOS Window Chrome & Tab Bar ─────────────────────── */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-[#1c2025] bg-[#0c0e11]">
        {/* Traffic Lights */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] hover:opacity-80 cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:opacity-80 cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] hover:opacity-80 cursor-pointer" />

          {/* Active Tab */}
          <div className="ml-4 flex items-center space-x-2 px-3 py-1 bg-[#161a1f] border-t-2 border-[#10b981] text-xs font-medium text-slate-200 rounded-t-md">
            <span className="font-bold text-[#10b981]">pixmath&gt;</span>
            <span className="text-slate-400">studio</span>
            <X className="w-3 h-3 text-slate-500 hover:text-white cursor-pointer ml-1" />
          </div>
          <button className="p-1 text-slate-500 hover:text-slate-300">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Global Status Pill */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>EGL GPU Worker: Active</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>v0.1.0-alpha</span>
        </div>
      </div>

      {/* ── Main Splunk-Style Navbar ───────────────────────────── */}
      <div className="h-14 px-6 flex items-center justify-between">
        {/* Left: Brand Logo & Context Selectors */}
        <div className="flex items-center space-x-6">
          {/* Logo */}
          <div className="flex items-baseline cursor-pointer">
            <span className="text-lg font-extrabold tracking-tight text-white">pixmath</span>
            <span className="text-xl font-black text-[#10b981] leading-none">&gt;</span>
          </div>

          {/* Context Dropdowns */}
          <div className="hidden xl:flex items-center space-x-5 text-xs text-slate-400">
            {/* Manifold Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1.5 hover:text-white transition group"
              >
                <span className="text-slate-500">Manifold:</span>
                <span className="font-medium text-slate-200 group-hover:text-[#10b981]">{selectedFormula}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {dropdownOpen && (
                <div className="absolute top-8 left-0 w-60 bg-[#161a1f] border border-[#282f37] rounded-xl shadow-2xl py-1 z-50">
                  {formulas.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        onSelectFormula(f);
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-[#20262e] hover:text-[#10b981] transition flex items-center justify-between"
                    >
                      <span>{f}</span>
                      {selectedFormula === f && <span className="text-[#10b981] font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Domain Dropdown */}
            <div className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
              <span className="text-slate-500">Domain:</span>
              <span className="font-medium text-slate-200">[-1.0, 1.0]²</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>

            {/* AST Depth Dropdown */}
            <div className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
              <span className="text-slate-500">Epoch:</span>
              <span className="font-medium text-slate-200">100 / 100</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>

            {/* Backend Dropdown */}
            <div className="flex items-center space-x-1.5 cursor-pointer hover:text-white transition">
              <span className="text-slate-500">Engine:</span>
              <span className="font-medium text-slate-200">ModernGL EGL</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Right: Search, View Mode Pills & Profile */}
        <div className="flex items-center space-x-4">
          {/* Search Pill */}
          <div className="hidden md:flex items-center bg-[#181c21] border border-[#282f37] rounded-full px-3.5 py-1.5 w-60 space-x-2 focus-within:border-[#10b981]/60 transition">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by formula etc..."
              className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 w-full"
            />
          </div>

          {/* View Mode Pills (View, AST Compiler, Pareto) */}
          <div className="flex items-center bg-[#15191d] border border-[#262c33] p-1 rounded-full space-x-1">
            <button
              onClick={() => setViewMode('view')}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'view'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              View
            </button>
            <button
              onClick={() => setViewMode('compiler')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'compiler'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AST Compiler
            </button>
            <button
              onClick={() => setViewMode('pareto')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'pareto'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pareto Frontier
            </button>
          </div>

          {/* Quick Icons */}
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-full transition">
            <Bell className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-full transition">
            <Settings className="w-4 h-4" />
          </button>

          {/* User Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-0.5">
            <div className="w-full h-full bg-[#111417] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
              PM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
