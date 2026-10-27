import { useState, useEffect } from 'react';
import { StudioTopbar } from './components/StudioTopbar';
import { SymbolicEditorPanel } from './components/SymbolicEditorPanel';
import { MathCanvas } from './components/MathCanvas';
import { AnalyticsRadarPanel } from './components/AnalyticsRadarPanel';
import { ReverseExtractionStudio } from './components/ReverseExtractionStudio';
import { useStudioStore } from './store/useStudioStore';
import {
  ChevronLeft,
  ChevronRight,
  Terminal,
  Copy,
  Check,
  X,
} from 'lucide-react';

export default function App() {
  const {
    mode,
    equation,
    isRoiBrushActive,
    setIsRoiBrushActive,
  } = useStudioStore();

  const [panel1Collapsed, setPanel1Collapsed] = useState(false);
  const [panel3Collapsed, setPanel3Collapsed] = useState(false);
  const [exportModal, setExportModal] = useState<'glsl' | 'latex' | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Keyboard shortcut listener ('B' key to toggle ROI Attention Brush in Reverse Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        setIsRoiBrushActive(!isRoiBrushActive);
        notify(
          !isRoiBrushActive
            ? 'ROI Attention Brush Active: Paint priority areas for SIREN/PySR'
            : 'ROI Attention Brush Deactivated'
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoiBrushActive, setIsRoiBrushActive]);

  const glslCode = `// ========================================================
// PixMath Transpiled GLSL Fragment Shader
// Formula: ${equation}
// Continuous Domain: x, y in [-1.0, 1.0], time t >= 0
// ========================================================
#version 330 core

out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_offset;
uniform float u_zoom;

float safe_div(float a, float b) {
    return a / (abs(b) < 1e-6 ? (b >= 0.0 ? 1e-6 : -1e-6) : b);
}

float safe_sqrt(float v) {
    return sqrt(max(v, 0.0));
}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec2 coord = (uv / u_zoom) + u_offset;
    float x = coord.x;
    float y = coord.y;
    float t = u_time;

    float val = ${equation
      .replace(/atan2\(/g, "atan(")
      .replace(/pi/g, "3.14159265")
      .replace(/e\b/g, "2.71828182")};

    float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.02, 0.03, 0.05), vec3(0.02, 0.71, 0.83), smoothstep(0.1, 0.5, elev));
    col = mix(col, vec3(0.06, 0.72, 0.51), smoothstep(0.5, 0.8, elev));
    fragColor = vec4(col, 1.0);
}
`;

  const latexCode = `\\begin{equation}
  f(x, y, t) = ${equation
    .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}')
    .replace(/atan2\((.*?),(.*?)\)/g, '\\operatorname{atan2}\\left($1,$2\\right)')
    .replace(/sin\((.*?)\)/g, '\\sin\\left($1\\right)')
    .replace(/cos\((.*?)\)/g, '\\cos\\left($1\\right)')
    .replace(/exp\((.*?)\)/g, 'e^{$1}')
    .replace(/\*/g, ' \\cdot ')}
\\end{equation}
`;

  const handleCopyModalCode = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify('Copied to clipboard');
  };

  return (
    <div className="min-h-screen w-full bg-[#05080E] text-slate-100 flex flex-col antialiased select-none overflow-x-hidden font-sans">
      {/* ── 1. Topbar: Mode Switcher, Latency, FPS, Job Stats ────── */}
      <StudioTopbar onPresetSelect={(name) => notify(`Loaded Preset: ${name}`)} />

      {/* ── 2. Master Workstation Topology ────────────────────── */}
      {mode === 'reverse' ? (
        <main className="flex-1 w-full p-2 md:p-4 overflow-y-auto relative animate-fade-in">
          <ReverseExtractionStudio onNotify={notify} />
        </main>
      ) : (
        <main className="flex-1 w-full flex p-3 md:p-4 gap-3 md:gap-4 overflow-hidden relative animate-fade-in">
          {/* ── Panel 1: Symbolic Formula IDE (Left) ─────────────── */}
          {!panel1Collapsed ? (
            <section className="w-[360px] lg:w-[400px] shrink-0 flex flex-col surface-panel-glass rounded-2xl p-4 border border-white/[0.07] shadow-2xl relative hw-accelerate">
              <button
                onClick={() => setPanel1Collapsed(true)}
                className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#0A0F1D] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center z-30 shadow-lg"
                title="Collapse Panel 1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <SymbolicEditorPanel onCompileShader={() => notify('GLSL Transpiled to WebGL2 Pipeline')} />
            </section>
          ) : (
            <button
              onClick={() => setPanel1Collapsed(false)}
              className="w-8 h-12 my-auto bg-[#0A0F1D] border border-white/[0.1] rounded-r-xl text-slate-400 hover:text-[#06B6D4] flex items-center justify-center shadow-lg transition"
              title="Expand Symbolic IDE"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* ── Panel 2: Real-Time Viewport (Center Stage) ───────── */}
          <section className="flex-1 min-h-[500px] flex flex-col relative rounded-2xl overflow-hidden hw-accelerate">
            <MathCanvas
              onExportPng={() => notify('4K Frame Snapshot Saved')}
              onExportGlsl={() => setExportModal('glsl')}
              onExportLatex={() => setExportModal('latex')}
            />
          </section>

          {/* ── Panel 3: Analytics & Radar (Right) ───────────────── */}
          {!panel3Collapsed ? (
            <section className="w-[380px] lg:w-[420px] shrink-0 flex flex-col surface-panel-glass rounded-2xl p-4 border border-white/[0.07] shadow-2xl relative hw-accelerate">
              <button
                onClick={() => setPanel3Collapsed(true)}
                className="absolute -left-3 top-6 w-6 h-6 rounded-full bg-[#0A0F1D] border border-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center z-30 shadow-lg"
                title="Collapse Panel 3"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <AnalyticsRadarPanel />
            </section>
          ) : (
            <button
              onClick={() => setPanel3Collapsed(false)}
              className="w-8 h-12 my-auto bg-[#0A0F1D] border border-white/[0.1] rounded-l-xl text-slate-400 hover:text-[#10B981] flex items-center justify-center shadow-lg transition"
              title="Expand Analytics Radar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </main>
      )}

      {/* ── Export Code Modal (GLSL / LaTeX) ───────────────────── */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-[680px] max-w-full bg-[#0A0F1D] border border-white/[0.1] rounded-2xl p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#06B6D4]" />
                <h3 className="font-mono text-sm font-bold text-white uppercase">
                  {exportModal === 'glsl' ? 'GLSL Fragment Shader #330' : 'LaTeX Mathematical Formulation'}
                </h3>
              </div>
              <button
                onClick={() => setExportModal(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="p-4 bg-[#05080E] border border-white/[0.06] rounded-xl font-mono text-xs text-cyan-300 overflow-x-auto max-h-96 leading-relaxed">
              <code>{exportModal === 'glsl' ? glslCode : latexCode}</code>
            </pre>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => handleCopyModalCode(exportModal === 'glsl' ? glslCode : latexCode)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#06B6D4] hover:bg-[#0891b2] text-black font-semibold text-xs rounded-xl shadow-lg transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy to Clipboard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Floating Toast ──────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 bg-[#0A0F1D]/95 border border-[#06B6D4]/50 text-[#06B6D4] px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono animate-bounce">
          <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
