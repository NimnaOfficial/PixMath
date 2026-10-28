import { useState, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Eye,
  ArrowRightLeft,
  Activity,
  Terminal,
  Sliders,
  Search,
  BookOpen,
  Check,
  Copy,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Code2,
  FileText,
} from 'lucide-react';
import { HELP_SECTIONS, HelpSection } from '../data/helpContent';
import { useStudioStore } from '../store/useStudioStore';

interface HelpDocumentationStudioProps {
  onNotify?: (msg: string) => void;
}

export function HelpDocumentationStudio({ onNotify }: HelpDocumentationStudioProps) {
  const { setMode, setEquation } = useStudioStore();
  const [activeSectionId, setActiveSectionId] = useState<string>('about-project');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return HELP_SECTIONS;
    const q = searchQuery.toLowerCase();
    return HELP_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.shortDescription.toLowerCase().includes(q) ||
        sec.categoryLabel.toLowerCase().includes(q) ||
        sec.content.lead.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Current active section (or fallback to first filtered)
  const activeSection: HelpSection = useMemo(() => {
    const found = HELP_SECTIONS.find((s) => s.id === activeSectionId);
    if (found) return found;
    return filteredSections[0] || HELP_SECTIONS[0];
  }, [activeSectionId, filteredSections]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(code);
    setTimeout(() => setCopiedSnippet(null), 2000);
    if (onNotify) onNotify('Code snippet copied to clipboard');
  };

  const handleQuickAction = (action?: { label: string; mode: 'forward' | 'reverse'; equation?: string }) => {
    if (!action) return;
    if (action.equation) {
      setEquation(action.equation);
    }
    setMode(action.mode);
    if (onNotify) {
      onNotify(`Switched to ${action.mode === 'forward' ? 'Forward Mode' : 'Reverse Mode'}`);
    }
  };

  // Icon mapping helper
  const renderIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Eye':
        return <Eye className={className} />;
      case 'ArrowRightLeft':
        return <ArrowRightLeft className={className} />;
      case 'Activity':
        return <Activity className={className} />;
      case 'Terminal':
        return <Terminal className={className} />;
      case 'Sliders':
        return <Sliders className={className} />;
      default:
        return <BookOpen className={className} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 max-w-7xl mx-auto p-2 md:p-4 text-slate-100 hw-accelerate animate-fade-in select-text">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0A0F1D]/80 border border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#06B6D4] to-[#10B981] flex items-center justify-center shadow-lg shadow-[#06B6D4]/25 shrink-0">
            <BookOpen className="w-5 h-5 text-black font-extrabold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-mono text-base font-extrabold text-white tracking-wide">
                PIXMATH DOCUMENTATION &amp; USER GUIDES
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] font-bold">
                v0.2.0 HANDBOOK
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Comprehensive architectural overview, mathematical foundations, and step-by-step guides for all features
            </p>
          </div>
        </div>

        {/* Quick Mode Jump Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMode('forward')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-cyan-300 font-mono text-xs font-semibold border border-cyan-500/30 transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Forward Mode</span>
          </button>
          <button
            onClick={() => setMode('reverse')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#EC4899] font-mono text-xs font-semibold border border-[#EC4899]/30 transition shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#EC4899]" />
            <span>Reverse Mode</span>
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Stage ──────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[620px]">
        {/* ── Left Sidebar Navigation (col-span-4) ──────────────────── */}
        <div className="lg:col-span-4 flex flex-col space-y-3 bg-[#0A0F1D]/80 border border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl">
          {/* Real-Time Guide Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search guides, functions, hotkeys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#05080E] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#06B6D4] transition"
            />
          </div>

          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold px-1 pt-1 flex items-center justify-between">
            <span>Modules &amp; Feature Guides ({filteredSections.length})</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-cyan-400 hover:underline lowercase font-normal"
              >
                clear
              </button>
            )}
          </div>

          {/* Guide Item List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[540px]">
            {filteredSections.map((sec) => {
              const isActive = sec.id === activeSection.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-3 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#06B6D4]/15 to-transparent border-[#06B6D4]/50 shadow-md shadow-[#06B6D4]/10'
                      : 'bg-[#05080E]/60 border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                        : 'bg-white/[0.04] text-slate-400'
                    }`}
                  >
                    {renderIcon(sec.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-bold truncate ${
                          isActive ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {sec.title}
                      </span>
                      {sec.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 ml-1.5 shrink-0">
                          {sec.categoryLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 line-clamp-1 mt-0.5">
                      {sec.shortDescription}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Ephemeral Guarantee Footer Note */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center space-x-2 text-[11px] font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Strict Zero-Retention Privacy Architecture</span>
          </div>
        </div>

        {/* ── Right Content Stage (col-span-8) ──────────────────────── */}
        <div className="lg:col-span-8 flex flex-col space-y-5 bg-[#0A0F1D]/90 border border-white/[0.08] p-6 rounded-2xl backdrop-blur-xl overflow-y-auto max-h-[640px] shadow-2xl">
          {/* Section Header */}
          <div className="space-y-2 border-b border-white/[0.08] pb-4">
            <div className="flex items-center space-x-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4] font-mono text-[10px] font-bold uppercase">
                {activeSection.categoryLabel}
              </span>
              {activeSection.badge && (
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-slate-300 font-mono text-[10px]">
                  {activeSection.badge}
                </span>
              )}
            </div>
            <h1 className="font-mono text-xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
              <span>{activeSection.title}</span>
            </h1>
            <p className="font-mono text-xs text-slate-300 leading-relaxed pt-1">
              {activeSection.content.lead}
            </p>
          </div>

          {/* Step-by-Step Guides (if present) */}
          {activeSection.content.steps && activeSection.content.steps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>Step-by-Step Execution Guide</span>
              </div>

              <div className="space-y-3">
                {activeSection.content.steps.map((st) => (
                  <div
                    key={st.step}
                    className="p-4 rounded-xl bg-[#05080E] border border-white/[0.07] space-y-2"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 rounded-full bg-[#06B6D4]/20 border border-[#06B6D4]/40 text-[#06B6D4] flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                        {st.step}
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-mono text-xs font-bold text-white tracking-wide">
                          {st.title}
                        </h4>
                        <p className="font-mono text-xs text-slate-300 leading-relaxed">
                          {st.description}
                        </p>
                      </div>
                    </div>

                    {/* Bullet Details */}
                    {st.details && st.details.length > 0 && (
                      <ul className="pl-9 list-disc list-inside space-y-1 font-mono text-[11px] text-slate-400">
                        {st.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}

                    {/* Code Snippet Box */}
                    {st.codeSnippet && (
                      <div className="ml-9 p-2.5 rounded-lg bg-black/60 border border-white/[0.1] font-mono text-xs text-cyan-300 flex items-center justify-between overflow-x-auto">
                        <code className="break-all">{st.codeSnippet}</code>
                        <button
                          onClick={() => handleCopyCode(st.codeSnippet!)}
                          className="ml-3 p-1 rounded bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 shrink-0"
                          title="Copy snippet"
                        >
                          {copiedSnippet === st.codeSnippet ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Tip Callout */}
                    {st.tip && (
                      <div className="ml-9 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] text-emerald-300 flex items-center space-x-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Tip: {st.tip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subsections & Data Tables */}
          {activeSection.content.subsections && activeSection.content.subsections.length > 0 && (
            <div className="space-y-4 pt-1">
              {activeSection.content.subsections.map((sub, idx) => (
                <div key={idx} className="space-y-2.5">
                  <h3 className="font-mono text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{sub.title}</span>
                  </h3>
                  <p className="font-mono text-xs text-slate-300 leading-relaxed">{sub.body}</p>

                  {/* Key Points */}
                  {sub.keyPoints && (
                    <ul className="list-disc list-inside space-y-1.5 font-mono text-xs text-slate-400 pl-2">
                      {sub.keyPoints.map((kp, kpi) => (
                        <li key={kpi} className="leading-relaxed">
                          {kp}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Structured Table */}
                  {sub.table && (
                    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#05080E]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-white/[0.04] border-b border-white/[0.08] text-cyan-300">
                          <tr>
                            {sub.table.headers.map((h, hi) => (
                              <th key={hi} className="p-2.5 font-bold text-[11px] uppercase tracking-wider">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05] text-slate-300 text-[11px]">
                          {sub.table.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-white/[0.02]">
                              {row.map((cell, ci) => (
                                <td key={ci} className="p-2.5 font-mono">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pro-Tips Callout Box */}
          {activeSection.content.proTips && activeSection.content.proTips.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/30 to-[#05080E] border border-cyan-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Expert Pro-Tips</span>
              </div>
              <ul className="list-disc list-inside space-y-1 font-mono text-xs text-slate-300">
                {activeSection.content.proTips.map((tip, ti) => (
                  <li key={ti}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
              <HelpCircle className="w-4 h-4 text-[#06B6D4]" />
              <span>Questions or custom shaders? Review the reference docs in <code className="text-cyan-300">/refs</code></span>
            </div>

            {activeSection.content.quickAction && (
              <button
                onClick={() => handleQuickAction(activeSection.content.quickAction)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] hover:from-[#0891b2] hover:to-[#059669] text-black font-mono text-xs font-extrabold shadow-lg shadow-[#06B6D4]/20 transition hover:scale-105 active:scale-95"
              >
                <span>{activeSection.content.quickAction.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-black font-bold" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
