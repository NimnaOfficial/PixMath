import { create } from 'zustand';

export type StudioMode = 'forward' | 'reverse' | 'help';

export interface ValidationMetrics {
  width: number;
  height: number;
  contrast_score: number;
  sharpness_score: number;
  coherence_score: number;
  purity_score: number;
  luminance_std: number;
  dynamic_range: number;
  autocorrelation: number;
  tv_ratio: number;
}

export interface ImageValidationReport {
  is_valid: boolean;
  overall_score: number;
  grade: string;
  feasibility_assessment: string;
  rejection_reasons: string[];
  metrics: ValidationMetrics;
  recommended_action: string;
}

export interface UncertainTokenInfo {
  token: string;
  position: [number, number];
  confidence: number;
  reason: string;
}

export interface ReverseExtractedResult {
  equation: string;
  latex: string;
  complexity: number;
  loss: number;
  psnr?: number;
  confidence: number;
  confidenceGrade: 'high' | 'medium' | 'low';
  isRoundtripLossless?: boolean;
  method?: string;
  uncertainTokens?: UncertainTokenInfo[];
}

export type ReverseStatus = 'idle' | 'validating' | 'extracting' | 'success' | 'declined';

export interface ParetoCandidate {
  id: string;
  generation: number;
  nodes: number;
  psnr: number;
  ssim: number;
  equation: string;
  isElbow?: boolean;
  timestamp: number;
}

interface StudioState {
  // Mode
  mode: StudioMode;
  setMode: (mode: StudioMode) => void;

  // Formula & Compilation
  equation: string;
  setEquation: (eq: string) => void;
  isCompiling: boolean;
  setIsCompiling: (v: boolean) => void;
  compileError: string | null;
  setCompileError: (err: string | null) => void;

  // Viewport Settings
  zoom: number;
  setZoom: (z: number) => void;
  offset: [number, number];
  setOffset: (offset: [number, number]) => void;
  resolutionMultiplier: number;
  setResolutionMultiplier: (m: number) => void;
  gridAxesVisible: boolean;
  setGridAxesVisible: (v: boolean) => void;

  // Scrubber Bridge & Uniform Constants (u_c[64])
  uniformConstants: Float32Array;
  constantMappings: { index: number; originalValue: number; textRange: { start: number; end: number } }[];
  setConstantMappings: (mappings: { index: number; originalValue: number; textRange: { start: number; end: number } }[]) => void;
  activeScrubber: { index: number; value: number; x: number; y: number } | null;
  setActiveScrubber: (sc: { index: number; value: number; x: number; y: number } | null) => void;

  // AST X-Ray Inspector
  hoveredNodeId: number;
  hoveredSubExpr: string | null;
  setHoveredSubExpr: (id: number, subExpr: string | null) => void;

  // Reverse Extraction & ROI Attention Brush
  isRoiBrushActive: boolean;
  setIsRoiBrushActive: (v: boolean) => void;
  brushRadius: number;
  setBrushRadius: (r: number) => void;
  brushFalloff: number;
  setBrushFalloff: (f: number) => void;
  targetImageUri: string | null;
  setTargetImageUri: (uri: string | null) => void;
  roiMask: Uint8Array | null;
  setRoiMask: (mask: Uint8Array | null) => void;

  // Reverse Mode Dedicated State
  reverseStatus: ReverseStatus;
  setReverseStatus: (status: ReverseStatus) => void;
  reverseProgress: number; // 0 to 100
  setReverseProgress: (progress: number) => void;
  reversePhase: string;
  setReversePhase: (phase: string, message?: string) => void;
  reversePhaseMessage: string;
  reverseValidationReport: ImageValidationReport | null;
  setReverseValidationReport: (report: ImageValidationReport | null) => void;
  reverseExtractedResult: ReverseExtractedResult | null;
  setReverseExtractedResult: (res: ReverseExtractedResult | null) => void;
  ephemeralPreviewUrl: string | null;
  ephemeralFileName: string | null;
  ephemeralFileSize: number | null;
  setEphemeralImage: (file: File | null) => void;
  resetReverseState: () => void;

  // Live Telemetry & Pareto Stream
  gpuFps: number;
  setGpuFps: (fps: number) => void;
  renderLatencyMs: number;
  setRenderLatencyMs: (ms: number) => void;
  psnr: number;
  setPsnr: (p: number) => void;
  dssim: number;
  setDssim: (s: number) => void;
  paretoCandidates: ParetoCandidate[];
  addParetoCandidate: (candidate: ParetoCandidate) => void;
  selectedCandidateId: string | null;
  setSelectedCandidateId: (id: string | null) => void;

  // Cross-dissolve transition state
  crossDissolveProgress: number; // 0.0 to 1.0
  setCrossDissolveProgress: (p: number) => void;
  previousEquation: string | null;
  setPreviousEquation: (eq: string | null) => void;
}

// Transient listeners decoupled from React re-renders for 60-120 FPS performance
const uniformListeners = new Set<(uniforms: Float32Array, changedIndex: number) => void>();
const coordListeners = new Set<(coords: { x: number; y: number; val: number }) => void>();

export const broadcastUniformChange = (uniforms: Float32Array, changedIndex: number) => {
  uniformListeners.forEach((cb) => cb(uniforms, changedIndex));
};

export const subscribeToUniformChanges = (cb: (uniforms: Float32Array, changedIndex: number) => void) => {
  uniformListeners.add(cb);
  return () => {
    uniformListeners.delete(cb);
  };
};

export const broadcastCoordChange = (coords: { x: number; y: number; val: number }) => {
  coordListeners.forEach((cb) => cb(coords));
};

export const subscribeToCoordChanges = (cb: (coords: { x: number; y: number; val: number }) => void) => {
  coordListeners.add(cb);
  return () => {
    coordListeners.delete(cb);
  };
};

const initialUniforms = new Float32Array(64);
initialUniforms.fill(1.0);
// Preset values for initial formula: sin(10.0*sqrt(x*x + y*y) - 2.0*t) * cos(8.0*atan2(y, x) + t)
initialUniforms[0] = 10.0;
initialUniforms[1] = 2.0;
initialUniforms[2] = 8.0;

export const useStudioStore = create<StudioState>((set) => ({
  mode: 'forward',
  setMode: (mode) => set({ mode }),

  equation: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)',
  setEquation: (equation) => set({ equation }),
  isCompiling: false,
  setIsCompiling: (isCompiling) => set({ isCompiling }),
  compileError: null,
  setCompileError: (compileError) => set({ compileError }),

  zoom: 1.0,
  setZoom: (zoom) => set({ zoom }),
  offset: [0, 0],
  setOffset: (offset) => set({ offset }),
  resolutionMultiplier: 1.0,
  setResolutionMultiplier: (resolutionMultiplier) => set({ resolutionMultiplier }),
  gridAxesVisible: true,
  setGridAxesVisible: (gridAxesVisible) => set({ gridAxesVisible }),

  uniformConstants: initialUniforms,
  constantMappings: [],
  setConstantMappings: (constantMappings) => set({ constantMappings }),
  activeScrubber: null,
  setActiveScrubber: (activeScrubber) => set({ activeScrubber }),

  hoveredNodeId: -1,
  hoveredSubExpr: null,
  setHoveredSubExpr: (hoveredNodeId, hoveredSubExpr) => set({ hoveredNodeId, hoveredSubExpr }),

  isRoiBrushActive: false,
  setIsRoiBrushActive: (isRoiBrushActive) => set({ isRoiBrushActive }),
  brushRadius: 40,
  setBrushRadius: (brushRadius) => set({ brushRadius }),
  brushFalloff: 0.5,
  setBrushFalloff: (brushFalloff) => set({ brushFalloff }),
  targetImageUri: null,
  setTargetImageUri: (targetImageUri) => set({ targetImageUri }),
  roiMask: null,
  setRoiMask: (roiMask) => set({ roiMask }),

  gpuFps: 60,
  setGpuFps: (gpuFps) => set({ gpuFps }),
  renderLatencyMs: 1.2,
  setRenderLatencyMs: (renderLatencyMs) => set({ renderLatencyMs }),
  psnr: 38.4,
  setPsnr: (psnr) => set({ psnr }),
  dssim: 0.042,
  setDssim: (dssim) => set({ dssim }),

  paretoCandidates: [
    { id: 'p1', generation: 6, nodes: 6, psnr: 21.4, ssim: 0.685, equation: 'sin(3.0 * x) * cos(3.0 * y)', timestamp: Date.now() - 30000 },
    { id: 'p2', generation: 18, nodes: 12, psnr: 28.2, ssim: 0.792, equation: 'sin(6.0 * sqrt(x*x + y*y)) * cos(4.0 * x)', timestamp: Date.now() - 24000 },
    { id: 'p3', generation: 42, nodes: 24, psnr: 38.4, ssim: 0.942, equation: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)', isElbow: true, timestamp: Date.now() - 15000 },
    { id: 'p4', generation: 76, nodes: 42, psnr: 40.1, ssim: 0.961, equation: 'sin(10.0 * sqrt(x*x + y*y)) * cos(8.0 * atan2(y, x)) + 0.1 * exp(-x*x)', timestamp: Date.now() - 8000 },
    { id: 'p5', generation: 110, nodes: 64, psnr: 41.2, ssim: 0.970, equation: 'sin(10.0 * sqrt(x*x + y*y)) * cos(8.0 * atan2(y, x)) + 0.05 * sin(24.0 * (x+y))', timestamp: Date.now() - 2000 },
  ],
  addParetoCandidate: (candidate) =>
    set((state) => ({ paretoCandidates: [...state.paretoCandidates, candidate] })),
  selectedCandidateId: 'p3',
  setSelectedCandidateId: (selectedCandidateId) => set({ selectedCandidateId }),

  crossDissolveProgress: 0.0,
  setCrossDissolveProgress: (crossDissolveProgress) => set({ crossDissolveProgress }),
  previousEquation: null,
  setPreviousEquation: (previousEquation) => set({ previousEquation }),

  // Reverse Mode Implementation
  reverseStatus: 'idle',
  setReverseStatus: (reverseStatus) => set({ reverseStatus }),
  reverseProgress: 0,
  setReverseProgress: (reverseProgress) => set({ reverseProgress }),
  reversePhase: 'idle',
  reversePhaseMessage: '',
  setReversePhase: (reversePhase, reversePhaseMessage = '') =>
    set({ reversePhase, reversePhaseMessage }),
  reverseValidationReport: null,
  setReverseValidationReport: (reverseValidationReport) => set({ reverseValidationReport }),
  reverseExtractedResult: null,
  setReverseExtractedResult: (reverseExtractedResult) => set({ reverseExtractedResult }),
  ephemeralPreviewUrl: null,
  ephemeralFileName: null,
  ephemeralFileSize: null,
  setEphemeralImage: (file) => {
    set((state) => {
      if (state.ephemeralPreviewUrl) {
        URL.revokeObjectURL(state.ephemeralPreviewUrl);
      }
      if (!file) {
        return {
          ephemeralPreviewUrl: null,
          ephemeralFileName: null,
          ephemeralFileSize: null,
        };
      }
      return {
        ephemeralPreviewUrl: URL.createObjectURL(file),
        ephemeralFileName: file.name,
        ephemeralFileSize: file.size,
      };
    });
  },
  resetReverseState: () => {
    set((state) => {
      if (state.ephemeralPreviewUrl) {
        URL.revokeObjectURL(state.ephemeralPreviewUrl);
      }
      return {
        reverseStatus: 'idle',
        reverseProgress: 0,
        reversePhase: 'idle',
        reversePhaseMessage: '',
        reverseValidationReport: null,
        reverseExtractedResult: null,
        ephemeralPreviewUrl: null,
        ephemeralFileName: null,
        ephemeralFileSize: null,
      };
    });
  },
}));
