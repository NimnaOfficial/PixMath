import React, { useState, useRef, useEffect, useCallback } from 'react';
import katex from 'katex';
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  Info,
  Activity,
  Flame,
  XCircle,
  Cpu,
} from 'lucide-react';
import {
  useStudioStore,
  ImageValidationReport,
} from '../store/useStudioStore';
import {
  validateImageLocally,
  validateImageOnServer,
  executeReverseExtraction,
  createSyntheticMathSample,
} from '../services/reverseService';

interface ReverseExtractionStudioProps {
  onNotify: (msg: string) => void;
}

export function ReverseExtractionStudio({ onNotify }: ReverseExtractionStudioProps) {
  const {
    reverseStatus,
    setReverseStatus,
    reverseProgress,
    setReverseProgress,
    reversePhase,
    reversePhaseMessage,
    setReversePhase,
    reverseValidationReport,
    setReverseValidationReport,
    reverseExtractedResult,
    setReverseExtractedResult,
    ephemeralPreviewUrl,
    ephemeralFileName,
    ephemeralFileSize,
    setEphemeralImage,
    resetReverseState,
    setMode,
    setEquation,
  } = useStudioStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'latex' | 'raw' | 'channels'>('latex');
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const katexContainerRef = useRef<HTMLDivElement>(null);
  const currentFileRef = useRef<File | null>(null);

  // Render KaTeX whenever the extracted LaTeX changes
  useEffect(() => {
    if (reverseExtractedResult && katexContainerRef.current) {
      try {
        let latex = reverseExtractedResult.latex || '';
        // If multiple channels are present, clean formatting
        if (latex.includes(';')) {
          const parts = latex.split(';').map((p) => p.trim());
          latex = `\\begin{aligned} R &= ${parts[0] || '0'} \\\\ G &= ${parts[1] || '0'} \\\\ B &= ${parts[2] || '0'} \\end{aligned}`;
        }
        katex.render(latex, katexContainerRef.current, {
          displayMode: true,
          throwOnError: false,
        });
      } catch (err) {
        if (katexContainerRef.current) {
          katexContainerRef.current.innerText = reverseExtractedResult.equation;
        }
      }
    }
  }, [reverseExtractedResult, activeCodeTab]);

  // Main file processing handler
  const handleProcessFile = useCallback(
    async (file: File) => {
      setClientError(null);
      currentFileRef.current = file;
      setEphemeralImage(file);
      setReverseStatus('validating');
      setReverseProgress(10);
      setReversePhase('validation', 'Analyzing pixel variance and coordinate feasibility');

      // Layer 1: Client Pre-check
      const localCheck = await validateImageLocally(file);
      if (!localCheck.ok) {
        setReverseStatus('declined');
        setClientError(localCheck.reason || 'File failed pre-flight checks.');
        onNotify('Image validation failed');
        return;
      }

      setReverseProgress(25);
      setReversePhase('validation', 'Computing spatial autocorrelation & Laplacian sharpness');

      // Layer 2: Deep Server-Side Validation
      let report: ImageValidationReport;
      try {
        report = await validateImageOnServer(file);
        setReverseValidationReport(report);
      } catch (err) {
        setReverseStatus('declined');
        setClientError(err instanceof Error ? err.message : String(err));
        onNotify('Validation check failed');
        return;
      }

      if (!report.is_valid) {
        setReverseStatus('declined');
        onNotify('Image declined for mathematical extraction');
        return;
      }

      // Layer 3: Extraction Pipeline (SIREN / PySR)
      setReverseStatus('extracting');
      setReverseProgress(35);
      onNotify(`Image validated (Score ${report.overall_score}/100) — Starting Distillation`);

      try {
        const result = await executeReverseExtraction(
          file,
          (progress, phase, message) => {
            setReverseProgress(progress);
            setReversePhase(phase, message);
          }
        );

        setReverseExtractedResult(result);
        setReverseStatus('success');
        onNotify('Mathematical equation extracted successfully!');
      } catch (err) {
        setReverseStatus('declined');
        setClientError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during neural-symbolic extraction.'
        );
        onNotify('Extraction pipeline failed');
      }
    },
    [
      setEphemeralImage,
      setReverseStatus,
      setReverseProgress,
      setReversePhase,
      setReverseValidationReport,
      setReverseExtractedResult,
      onNotify,
    ]
  );

  // Drag and drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFile(e.target.files[0]);
    }
  };

  // Quick Curated Sample Loader
  const handleLoadSample = async (type: 'wave' | 'torus' | 'hyperbolic') => {
    try {
      onNotify(`Generating synthetic ${type} manifold sample...`);
      const sampleFile = await createSyntheticMathSample(type);
      handleProcessFile(sampleFile);
    } catch (err) {
      onNotify('Failed to generate sample');
    }
  };

  // Action A: Copy Equation
  const handleCopyEquation = (isLatex = false) => {
    if (!reverseExtractedResult) return;
    const textToCopy = isLatex
      ? reverseExtractedResult.latex
      : reverseExtractedResult.equation;

    navigator.clipboard.writeText(textToCopy);
    if (isLatex) {
      setCopiedLatex(true);
      setTimeout(() => setCopiedLatex(false), 2000);
      onNotify('Copied LaTeX formula to clipboard');
    } else {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
      onNotify('Copied mathematical equation to clipboard');
    }
  };

  // Action B: Edit in Forward Mode
  const handleEditInForwardMode = () => {
    if (!reverseExtractedResult) return;
    // Set the extracted equation into the forward editor
    setEquation(reverseExtractedResult.equation);
    // Switch mode back to forward
    setMode('forward');
    onNotify('Transferred extracted equation to Forward Mode IDE');
  };

  // Action C: Cancel / Reset
  const handleCancelAndClear = () => {
    currentFileRef.current = null;
    resetReverseState();
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNotify('Reverse workspace cleared');
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4 max-w-7xl mx-auto p-2 md:p-4 text-slate-100 hw-accelerate animate-fade-in select-text">
      {/* ── Top Header & Guarantee Banner ─────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0A0F1D]/80 border border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#EC4899] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#EC4899]/25 shrink-0">
            <Layers className="w-5 h-5 text-white font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-mono text-base font-extrabold text-white tracking-wide">
                REVERSE NEURAL-SYMBOLIC STUDIO
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] font-bold">
                IMAGE → CLOSED-FORM FORMULA
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Distill continuous mathematical equations from 2D pixel fields via SIREN & PySR Pareto regression
            </p>
          </div>
        </div>

        {/* Hardware & Privacy Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-cyan-300 text-xs font-mono shrink-0">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Hardware Accel: WebGL / Worker</span>
          </div>

          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-emerald-400 text-xs font-mono shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">100% In-Memory Ephemeral</span>
          </div>
        </div>
      </div>

      {/* ── Main Interactive Stage ────────────────────────────── */}
      <div className="flex-1 min-h-[580px] grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Left Column: Upload / Validation / Stage Control (col-span-5) ── */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Upload Dropzone Card */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`flex-1 min-h-[360px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden backdrop-blur-xl ${
              isDragOver
                ? 'border-[#EC4899] bg-[#EC4899]/10 shadow-2xl shadow-[#EC4899]/20 scale-[0.99]'
                : reverseStatus === 'declined'
                ? 'border-red-500/50 bg-red-950/15'
                : 'border-white/[0.12] bg-[#0A0F1D]/80 hover:border-[#EC4899]/50 hover:bg-[#0A0F1D]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileSelect}
              className="hidden"
            />

            {ephemeralPreviewUrl ? (
              /* Preview Mode */
              <div className="w-full h-full flex flex-col items-center justify-center space-y-3 relative z-10">
                <div className="relative group rounded-xl overflow-hidden border border-white/[0.15] max-w-[280px] max-h-[220px] shadow-2xl bg-black">
                  <img
                    src={ephemeralPreviewUrl}
                    alt="Ephemeral Target"
                    className="w-full h-full object-contain"
                  />
                  {reverseStatus === 'validating' && (
                    <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none overflow-hidden">
                      <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#EC4899] to-transparent animate-pulse shadow-lg shadow-[#EC4899]" />
                    </div>
                  )}
                </div>

                <div className="text-center font-mono">
                  <div className="text-xs font-semibold text-white truncate max-w-[240px]">
                    {ephemeralFileName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {ephemeralFileSize ? `${(ephemeralFileSize / 1024).toFixed(1)} KB` : 'Ephemeral Image'}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 transition"
                  >
                    Change Image
                  </button>
                  <button
                    onClick={handleCancelAndClear}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Dropzone Prompt */
              <div className="flex flex-col items-center justify-center space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#EC4899]/20 to-[#8B5CF6]/20 border border-[#EC4899]/30 flex items-center justify-center text-[#EC4899] shadow-inner">
                  <UploadCloud className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white tracking-wide">
                    Drag & Drop Target Image
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                    Upload mathematical manifolds, SDF curves, periodic textures, or coordinate patterns
                  </p>
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl font-mono text-xs font-bold text-white bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] hover:from-[#db2777] hover:to-[#7c3aed] shadow-lg shadow-[#EC4899]/20 transition-all hover:scale-105 active:scale-95"
                >
                  Select File from Computer
                </button>

                <div className="text-[10px] font-mono text-slate-500 pt-1">
                  Supports PNG, JPG, WebP up to 10MB • Ephemeral volatile memory
                </div>
              </div>
            )}
          </div>

          {/* Curated Synthetic Samples (Instant Test without needing local files) */}
          <div className="bg-[#0A0F1D]/80 border border-white/[0.08] p-4 rounded-2xl backdrop-blur-xl">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 mb-2.5">
              <Sparkles className="w-4 h-4 text-[#EC4899]" />
              <span>Or Try a Curated Synthetic Math Surface:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'wave' as const, label: 'Solar Wave', tag: 'Trig' },
                { type: 'torus' as const, label: 'Torus SDF', tag: 'Implicit' },
                { type: 'hyperbolic' as const, label: 'Hyperbolic', tag: 'Algebraic' },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleLoadSample(s.type)}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-[#EC4899]/50 hover:bg-[#EC4899]/10 text-left font-mono transition group"
                >
                  <div className="text-[10px] text-[#EC4899] font-bold uppercase">{s.tag}</div>
                  <div className="text-xs text-slate-200 font-semibold group-hover:text-white truncate">
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right Column: Dynamic State (Validation / Processing / Result) (col-span-7) ── */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* State 1: IDLE Guide View */}
          {reverseStatus === 'idle' && (
            <div className="flex-1 bg-[#0A0F1D]/80 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center space-x-2 text-[#06B6D4] font-mono text-xs font-bold uppercase tracking-wider mb-2">
                  <Info className="w-4 h-4" />
                  <span>Deep Validation & Feasibility Principles</span>
                </div>
                <h3 className="text-lg font-bold text-white font-mono">
                  What images can yield mathematical equations?
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                  Unlike natural photographs containing millions of discrete chaotic details, symbolic equations model
                  smooth, continuous coordinate relationships: <code className="text-cyan-300">f(x, y)</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {/* What Passes */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5 text-emerald-400">
                    <FileCheck2 className="w-4 h-4" />
                    <span>Valid Inputs (High Feasibility):</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-300">
                    <li>Parametric wave & ripple fields</li>
                    <li>Signed Distance Fields (circles, torus)</li>
                    <li>Smooth mathematical gradients & contours</li>
                    <li>Symmetric geometric manifolds</li>
                  </ul>
                </div>

                {/* What Gets Declined */}
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5 text-red-400">
                    <XCircle className="w-4 h-4" />
                    <span>Declined Inputs (Auto-rejected):</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-300">
                    <li>Solid monochrome or blank images</li>
                    <li>Severely blurry or out-of-focus captures</li>
                    <li>Pure random TV static / white noise</li>
                    <li>Corrupted or micro-scale files (&lt;32×32)</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] font-mono text-xs text-slate-400">
                <span className="text-[#EC4899] font-bold">Deep Multi-Layer Guard:</span> Every upload is automatically
                screened in memory for contrast variance, spatial autocorrelation, and Laplacian gradient sharpness
                before consuming neural computing resources.
              </div>
            </div>
          )}

          {/* State 2: VALIDATING View */}
          {reverseStatus === 'validating' && (
            <div className="flex-1 bg-[#0A0F1D]/80 border border-[#06B6D4]/30 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-center items-center text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#06B6D4]/15 border border-[#06B6D4]/40 flex items-center justify-center text-[#06B6D4] animate-spin">
                <Activity className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="font-mono text-base font-bold text-white tracking-wide">
                  Deep Mathematical Feasibility Screening...
                </h3>
                <p className="font-mono text-xs text-cyan-300 max-w-md">
                  {reversePhaseMessage || 'Analyzing pixel variance, spatial coherence, and edge sharpness in volatile RAM'}
                </p>
              </div>

              {/* Step checklist */}
              <div className="w-full max-w-md bg-[#05080E]/90 border border-white/[0.08] rounded-xl p-4 font-mono text-xs text-left space-y-2.5">
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Layer 1: MIME & Dimension Check</span>
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between text-cyan-300 animate-pulse">
                  <span>Layer 2: Luminance Variance & Flatness</span>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Layer 3: Spatial Autocorrelation vs. Noise</span>
                  <span>pending</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Layer 4: Laplacian Gradient Sharpness</span>
                  <span>pending</span>
                </div>
              </div>
            </div>
          )}

          {/* State 3: DECLINED / REJECTED View */}
          {reverseStatus === 'declined' && (
            <div className="flex-1 bg-gradient-to-b from-red-950/20 to-[#0A0F1D]/90 border border-red-500/40 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-red-400 font-mono text-sm font-bold uppercase">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span>Image Declined: Cannot Synthesize Equation</span>
                </div>

                <p className="font-mono text-xs text-slate-300 leading-relaxed">
                  Our deep mathematical analysis determined that this image cannot reliably produce a closed-form
                  symbolic equation. Detailed diagnostic findings are listed below:
                </p>

                {/* Specific Rejection Reasons */}
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 font-mono text-xs text-red-200 space-y-2">
                  <div className="font-bold text-red-300 uppercase tracking-wider text-[11px]">
                    Identified Deficiencies:
                  </div>
                  {clientError && (
                    <div className="flex items-start space-x-2">
                      <span className="text-red-400 font-bold">•</span>
                      <span>{clientError}</span>
                    </div>
                  )}
                  {reverseValidationReport?.rejection_reasons.map((reason, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-red-400 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {/* Diagnostic Metric Gauges */}
                {reverseValidationReport && (
                  <div className="grid grid-cols-4 gap-2 pt-2 font-mono text-center">
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-slate-400">Overall</div>
                      <div className="text-sm font-bold text-red-400">
                        {reverseValidationReport.overall_score}/100
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-slate-400">Contrast</div>
                      <div className="text-sm font-bold text-slate-200">
                        {reverseValidationReport.metrics.contrast_score}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-slate-400">Sharpness</div>
                      <div className="text-sm font-bold text-slate-200">
                        {reverseValidationReport.metrics.sharpness_score}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-slate-400">Coherence</div>
                      <div className="text-sm font-bold text-slate-200">
                        {reverseValidationReport.metrics.coherence_score}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons to recover */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
                <button
                  onClick={handleCancelAndClear}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 font-mono text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset & Try Another</span>
                </button>

                <button
                  onClick={() => handleLoadSample('wave')}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#EC4899] hover:bg-[#db2777] text-white font-mono text-xs font-bold shadow-lg shadow-[#EC4899]/25 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Valid Math Sample</span>
                </button>
              </div>
            </div>
          )}

          {/* State 4: EXTRACTING View (Neural SIREN / KAN + PySR) */}
          {reverseStatus === 'extracting' && (
            <div className="flex-1 bg-[#0A0F1D]/80 border border-[#EC4899]/40 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center space-x-2 text-[#EC4899] font-bold uppercase tracking-wider">
                    <Flame className="w-4 h-4 text-[#EC4899] animate-pulse" />
                    <span>Neural-Symbolic Distillation in Progress</span>
                  </div>
                  <span className="text-slate-400 font-bold">{reverseProgress}%</span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-3 rounded-full bg-black/60 border border-white/[0.1] overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#EC4899] via-[#8B5CF6] to-[#06B6D4] transition-all duration-500 shadow-md shadow-[#EC4899]/40"
                    style={{ width: `${reverseProgress}%` }}
                  />
                </div>

                {/* Phase description */}
                <div className="p-3.5 rounded-xl bg-[#05080E] border border-white/[0.08] font-mono text-xs text-slate-300 flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-[#EC4899] animate-ping shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-white uppercase">{reversePhase}: </span>
                    <span className="text-slate-400">{reversePhaseMessage}</span>
                  </div>
                </div>

                {/* Stepped Phase indicators */}
                <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-center pt-2">
                  <div
                    className={`p-2 rounded-lg border ${
                      reverseProgress >= 15
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/[0.06] text-slate-500'
                    }`}
                  >
                    1. Ingestion
                  </div>
                  <div
                    className={`p-2 rounded-lg border ${
                      reverseProgress >= 45
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : reverseProgress >= 15
                        ? 'border-[#EC4899]/40 bg-[#EC4899]/10 text-[#EC4899] font-bold'
                        : 'border-white/[0.06] text-slate-500'
                    }`}
                  >
                    2. SIREN Fit
                  </div>
                  <div
                    className={`p-2 rounded-lg border ${
                      reverseProgress >= 90
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : reverseProgress >= 45
                        ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-[#8B5CF6] font-bold'
                        : 'border-white/[0.06] text-slate-500'
                    }`}
                  >
                    3. PySR Pareto
                  </div>
                  <div
                    className={`p-2 rounded-lg border ${
                      reverseProgress >= 100
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : reverseProgress >= 90
                        ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300 font-bold'
                        : 'border-white/[0.06] text-slate-500'
                    }`}
                  >
                    4. Elbow Select
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] font-mono text-xs text-slate-400 flex items-center justify-between">
                <span>Memory hygiene: 512MB RAM constraint enforcement active</span>
                <span className="text-[#06B6D4] font-semibold">Running PySR Julia</span>
              </div>
            </div>
          )}

          {/* State 5: SUCCESS View (The Result + 3 Mandatory Actions) */}
          {reverseStatus === 'success' && reverseExtractedResult && (
            <div className="flex-1 bg-[#0A0F1D]/90 border border-emerald-500/40 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-5 shadow-2xl">
              <div className="space-y-4">
                {/* Header with Confidence Gauge */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-mono text-sm font-bold uppercase">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span>Closed-Form Equation Extracted!</span>
                  </div>

                  <div className="flex items-center space-x-2 font-mono text-xs">
                    {/* Confidence Score Pill */}
                    <div
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-bold shadow-sm ${
                        (reverseExtractedResult.confidence ?? 100) >= 80
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}
                      title={`Recognition Accuracy: ${reverseExtractedResult.confidence}%`}
                    >
                      {(reverseExtractedResult.confidence ?? 100) >= 80 ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>{reverseExtractedResult.confidence ?? 100}% Accuracy</span>
                    </div>

                    {reverseExtractedResult.isRoundtripLossless ? (
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold hidden sm:inline">
                        100% Lossless Roundtrip
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-slate-300 border border-white/[0.1] font-medium hidden sm:inline">
                        Method: {reverseExtractedResult.method || 'Surface Regression'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Friendly Warning Banner if Confidence < 80% */}
                {(reverseExtractedResult.confidence ?? 100) < 80 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 font-mono text-xs space-y-2">
                    <div className="flex items-center space-x-2 text-amber-300 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Surface Fit Notice ({reverseExtractedResult.confidence}% Fit Fidelity)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      The surface regression engine identified the primary continuous contour topology, but high-frequency harmonics or subtle ripples may have higher error variance.
                      We recommend reviewing the equation and making fine-tuning edits by clicking{' '}
                      <span className="text-cyan-300 font-bold">Edit in Forward Mode</span> below.
                    </p>
                    {reverseExtractedResult.uncertainTokens && reverseExtractedResult.uncertainTokens.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-amber-400 font-bold">Diagnostics:</span>
                        {reverseExtractedResult.uncertainTokens.map((tok, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold"
                            title={tok.reason}
                          >
                            {tok.token} ({tok.confidence}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* View Tabs */}
                <div className="flex items-center space-x-2 border-b border-white/[0.06] pb-2">
                  <button
                    onClick={() => setActiveCodeTab('latex')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
                      activeCodeTab === 'latex'
                        ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mathematical Formulation (KaTeX)
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('raw')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition ${
                      activeCodeTab === 'raw'
                        ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Raw Expression String
                  </button>
                </div>

                {/* Equation Display Box */}
                <div className="p-5 rounded-2xl bg-[#05080E] border border-white/[0.1] shadow-inner relative overflow-x-auto min-h-[110px] flex items-center justify-center">
                  {activeCodeTab === 'latex' ? (
                    <div
                      ref={katexContainerRef}
                      className="text-center font-serif text-lg md:text-xl text-slate-100 overflow-x-auto py-2"
                    />
                  ) : (
                    <code className="font-mono text-sm text-cyan-300 break-all leading-relaxed">
                      {reverseExtractedResult.equation}
                    </code>
                  )}
                </div>
              </div>

              {/* ── THE 3 MANDATORY ACTIONS ─────────────────────────── */}
              <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Action C: Cancel / Clear */}
                <button
                  onClick={handleCancelAndClear}
                  className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 font-mono text-xs font-semibold transition"
                  title="Wipe volatile buffers and start a new extraction"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cancel / Clear</span>
                </button>

                <div className="w-full sm:w-auto flex items-center space-x-2.5">
                  {/* Action A: Copy Equation */}
                  <button
                    onClick={() => handleCopyEquation(activeCodeTab === 'latex')}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0A0F1D] border border-white/[0.15] hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold transition shadow-md"
                  >
                    {copiedRaw || copiedLatex ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedRaw || copiedLatex ? 'Copied!' : 'Copy Equation'}</span>
                  </button>

                  {/* Action B: Edit in Forward Mode */}
                  <button
                    onClick={handleEditInForwardMode}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#06B6D4] to-[#10B981] hover:from-[#0891b2] hover:to-[#059669] text-black font-mono text-xs font-extrabold shadow-lg shadow-[#06B6D4]/25 transition hover:scale-105 active:scale-95"
                  >
                    <span>Edit in Forward Mode</span>
                    <ArrowRight className="w-4 h-4 text-black font-bold" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
