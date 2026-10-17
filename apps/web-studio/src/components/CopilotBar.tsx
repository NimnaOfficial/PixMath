import { useState } from 'react';
import { Bot, Plus, Workflow, Zap, CornerDownLeft } from 'lucide-react';

interface CopilotBarProps {
  onPromptSubmit: (prompt: string) => void;
  onSelectAction: (action: string) => void;
}

export function CopilotBar({
  onPromptSubmit,
  onSelectAction,
}: CopilotBarProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onPromptSubmit(prompt);
    setPrompt('');
  };

  return (
    <div className="w-[380px] flex flex-col space-y-1.5 select-none z-30">
      {/* ── Sharp Command Terminal Input ──────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="tech-panel p-1.5 flex items-center justify-between border border-[#1F2730] shadow-xl focus-within:border-[#00F0FF] transition-colors"
      >
        <div className="flex items-center space-x-2 w-full px-2">
          <span className="font-mono text-xs text-[#00F0FF] font-bold">&gt;</span>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="PROMPT MATHEMATICAL TRANSFORMATION..."
            className="bg-transparent border-none outline-none font-mono text-[10px] text-white placeholder-slate-600 w-full uppercase"
          />
        </div>

        <button
          type="submit"
          className="px-2.5 py-1 bg-[#00F0FF] hover:bg-[#38bdf8] text-black font-mono font-bold text-[10px] uppercase flex items-center space-x-1 shrink-0 transition"
        >
          <span>EXEC</span>
          <CornerDownLeft className="w-3 h-3 stroke-[3]" />
        </button>
      </form>

      {/* ── Sharp Technical Action Trigger Chips ───────────────── */}
      <div className="flex items-center space-x-1 font-mono text-[9px] uppercase">
        <button
          onClick={() => onSelectAction('agent')}
          className="flex items-center space-x-1 px-2 py-1 bg-[#090D11] hover:bg-[#121820] border border-[#1F2730] text-slate-300 hover:text-white transition"
        >
          <Bot className="w-2.5 h-2.5 text-[#00F0FF]" />
          <span>[AGENT]</span>
        </button>

        <button
          onClick={() => onSelectAction('presets')}
          className="flex items-center space-x-1 px-2 py-1 bg-[#090D11] hover:bg-[#121820] border border-[#1F2730] text-slate-300 hover:text-white transition"
        >
          <Plus className="w-2.5 h-2.5 text-slate-400" />
          <span>[PRESETS:14]</span>
        </button>

        <button
          onClick={() => onSelectAction('ri_analysis')}
          className="flex items-center space-x-1 px-2 py-1 bg-[#090D11] hover:bg-[#121820] border border-[#10B981]/40 text-[#10B981] hover:text-white transition"
        >
          <Workflow className="w-2.5 h-2.5 text-[#10B981]" />
          <span>[REDUCTION]</span>
        </button>

        <button
          onClick={() => onSelectAction('glsl')}
          className="flex items-center space-x-1 px-2 py-1 bg-[#090D11] hover:bg-[#121820] border border-[#F59E0B]/40 text-[#F59E0B] hover:text-white transition"
        >
          <Zap className="w-2.5 h-2.5 text-[#F59E0B]" />
          <span>[GLSL]</span>
        </button>
      </div>
    </div>
  );
}
