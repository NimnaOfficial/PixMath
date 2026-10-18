import { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useScrubberBridge } from '../hooks/useScrubberBridge';
import { useStudioStore } from '../store/useStudioStore';
import katex from 'katex';
import {
  Code2,
  Layers,
  ShieldCheck,
  Sliders,
  Play,
} from 'lucide-react';

interface SymbolicEditorPanelProps {
  onCompileShader?: () => void;
}

export function SymbolicEditorPanel({ onCompileShader }: SymbolicEditorPanelProps) {
  const {
    equation,
    setEquation,
    hoveredSubExpr,
    setHoveredSubExpr,
    activeScrubber,
  } = useStudioStore();

  const [editorInstance, setEditorInstance] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);

  // Bind the Alt-Drag Scrubber Engine to Monaco
  useScrubberBridge(editorInstance, equation, (newEq) => {
    setEquation(newEq);
  });

  // Convert raw expression to KaTeX math format
  const formatLatex = (rawEq: string) => {
    return rawEq
      .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
      .replace(/atan2\((.*?),(.*?)\)/g, '\\operatorname{atan2}\\left($1,$2\\right)')
      .replace(/sin\((.*?)\)/g, '\\sin\\left($1\\right)')
      .replace(/cos\((.*?)\)/g, '\\cos\\left($1\\right)')
      .replace(/exp\((.*?)\)/g, 'e^{$1}')
      .replace(/\*/g, ' \\cdot ');
  };

  const katexHtml = useMemo(() => {
    try {
      return katex.renderToString(`f(x, y, t) = ${formatLatex(equation)}`, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return `f(x, y, t) = ${equation}`;
    }
  }, [equation]);

  // Extract Tokenized AST Breadcrumbs for interactive X-Ray inspection
  const astTokens = useMemo(() => {
    const tokens: { id: number; label: string; type: 'trig' | 'coord' | 'sdf' | 'noise' | 'op' }[] = [];
    const keywords = [
      { word: 'sin', type: 'trig' as const },
      { word: 'cos', type: 'trig' as const },
      { word: 'atan2', type: 'trig' as const },
      { word: 'sqrt', type: 'sdf' as const },
      { word: 'exp', type: 'sdf' as const },
      { word: 'noise', type: 'noise' as const },
      { word: 'x', type: 'coord' as const },
      { word: 'y', type: 'coord' as const },
      { word: 't', type: 'coord' as const },
    ];

    let id = 0;
    keywords.forEach(({ word, type }) => {
      if (equation.includes(word)) {
        tokens.push({ id: id++, label: word, type });
      }
    });
    return tokens;
  }, [equation]);

  const handleEditorMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
    setEditorInstance(editor);

    // Define custom Obsidian Math-Lab theme
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontLigatures: true,
      lineNumbers: 'on',
      lineNumbersMinChars: 2,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      renderLineHighlight: 'all',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      padding: { top: 12, bottom: 12 },
    });
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 select-none">
      {/* ── Panel Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.07]">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-[#06B6D4]" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide font-mono uppercase">
            Symbolic AST Formula IDE
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-mono text-[#06B6D4]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AST Sandbox: Depth 4/8</span>
        </div>
      </div>

      {/* ── KaTeX Equation Typesetting Bar ─────────────────────── */}
      <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-3 flex flex-col space-y-1 shadow-md">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="uppercase text-[#06B6D4] font-semibold">Continuous Formulation</span>
          <span className="text-slate-500">KaTeX Synchronous Typesetting</span>
        </div>
        <div
          className="text-cyan-300 font-mono text-xs overflow-x-auto py-1 flex items-center justify-center min-h-[44px]"
          dangerouslySetInnerHTML={{ __html: katexHtml }}
        />
      </div>

      {/* ── Monaco Code Editor Chassis ─────────────────────────── */}
      <div className="relative flex-1 min-h-[220px] bg-[#0A0F1D]/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl flex flex-col group focus-within:border-[#06B6D4]/50 transition-all">
        {/* Monaco Editor Toolbar */}
        <div className="h-8 px-4 flex items-center justify-between bg-[#05080E]/70 border-b border-white/[0.06] text-[10px] font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Domain:</span>
            <span className="text-slate-200 font-bold">x, y ∈ [-1, 1], t ≥ 0</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-slate-500 hidden sm:inline">Hold [Alt] + Drag to scrub numbers</span>
            <button
              onClick={onCompileShader}
              className="flex items-center space-x-1 text-[#06B6D4] hover:text-white transition"
              title="Manual Transpile"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Transpile</span>
            </button>
          </div>
        </div>

        {/* Monaco React Editor */}
        <div className="flex-1 w-full relative">
          <Editor
            height="100%"
            language="c"
            theme="vs-dark"
            value={equation}
            onChange={(val) => {
              if (val !== undefined) setEquation(val);
            }}
            onMount={handleEditorMount}
            loading={
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-500">
                Loading Monaco AST Engine...
              </div>
            }
          />

          {/* Floating Scrubber HUD Badge when Alt-Dragging */}
          {activeScrubber && (
            <div
              style={{
                position: 'fixed',
                left: `${activeScrubber.x}px`,
                top: `${activeScrubber.y}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
              }}
              className="z-50 bg-[#06B6D4] text-black font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-2xl flex items-center space-x-1.5 animate-pulse"
            >
              <Sliders className="w-3 h-3" />
              <span>u_c[{activeScrubber.index}]: {activeScrubber.value.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tokenized AST Breadcrumbs & X-Ray Hover Bar ────────── */}
      <div className="bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-3 flex flex-col space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3 h-3 text-[#06B6D4]" />
            <span className="uppercase font-semibold">AST X-Ray Breadcrumbs</span>
          </div>
          <span className="text-[9px] text-slate-500">Hover node to isolate coordinates</span>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          {astTokens.map((tok) => {
            let colorCls = 'bg-white/[0.05] text-slate-300 border-white/[0.08]';
            if (tok.type === 'trig') colorCls = 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
            if (tok.type === 'sdf') colorCls = 'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30';
            if (tok.type === 'coord') colorCls = 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30';
            if (tok.type === 'noise') colorCls = 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30';

            const isHovered = hoveredSubExpr === tok.label;

            return (
              <button
                key={tok.id}
                onMouseEnter={() => setHoveredSubExpr(tok.id, tok.label)}
                onMouseLeave={() => setHoveredSubExpr(-1, null)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${colorCls} ${
                  isHovered ? 'ring-2 ring-[#06B6D4] scale-105 shadow-md' : 'hover:scale-102'
                }`}
              >
                {tok.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
