/**
 * Structured content repository for the PixMath Help & Documentation Module.
 * Provides detailed architectural overviews, technical explanations, and step-by-step
 * guides for every user-facing tool, activity, and CLI command in the platform.
 */

export interface GuideStep {
  step: number;
  title: string;
  description: string;
  details?: string[];
  tip?: string;
  codeSnippet?: string;
}

export interface Subsection {
  title: string;
  body: string;
  keyPoints?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface HelpSection {
  id: string;
  category: 'about' | 'forward' | 'viewport' | 'reverse' | 'analytics' | 'cli' | 'shortcuts';
  categoryLabel: string;
  title: string;
  shortDescription: string;
  badge?: string;
  badgeColor?: 'cyan' | 'emerald' | 'pink' | 'amber' | 'purple';
  icon: string;
  content: {
    lead: string;
    subsections?: Subsection[];
    steps?: GuideStep[];
    proTips?: string[];
    troubleshooting?: {
      problem: string;
      solution: string;
    }[];
    quickAction?: {
      label: string;
      mode: 'forward' | 'reverse';
      presetName?: string;
      equation?: string;
    };
  };
}

export const HELP_SECTIONS: HelpSection[] = [
  // ── 1. ABOUT THIS PROJECT ─────────────────────────────────────────────
  {
    id: 'about-project',
    category: 'about',
    categoryLabel: 'Overview',
    title: 'About PixMath Platform',
    shortDescription: 'Project vision, core mathematical architecture, and industrial bidirectional graphics synthesis.',
    badge: 'Architecture & Vision',
    badgeColor: 'cyan',
    icon: 'Sparkles',
    content: {
      lead: 'PixMath is an industrial-grade, bidirectional software platform, Command-Line Interface (CLI), and interactive Web Studio that bridges pure algebraic mathematics and discrete computer graphics. Inspired by mathematical artists like Hamid Naderi Yeganeh (creator of "Solar Eruption"), PixMath proves that multi-million-pixel imagery can emerge purely from closed-form algebraic equations without a single polygon mesh or artist brushstroke.',
      subsections: [
        {
          title: 'The Dual Engine Architecture',
          body: 'PixMath solves both the direct and the inverse computer graphics problem through two complementary computational pipelines:',
          keyPoints: [
            'The Forward Engine (Math → Image): Validates algebraic expressions through an AST sandbox, transpiles them into OpenGL Shading Language (GLSL #330), and executes real-time fragment shaders on the GPU at 60-120 FPS in WebGL2 or headlessly via ModernGL EGL.',
            'The Reverse Engine (Image → Math): Inverts arbitrary digital imagery into concise, human-readable closed-form formulas by combining Implicit Neural Representations (SIREN / KAN) with evolutionary Pareto Symbolic Regression (PySR) and dedicated Math OCR models.',
          ],
        },
        {
          title: 'Theoretical & Mathematical Foundations',
          body: 'Every visual pixel in PixMath corresponds to an analytical coordinate transformation:',
          table: {
            headers: ['Mathematical Primitive', 'Algebraic Formula', 'Visual Application in PixMath'],
            rows: [
              ['Parametric Trigonometry', 'f(x, y) = sin(10r - 2t) * cos(8θ + t)', 'Organic solar plasma, whirlpools, wave pulses, floral petals'],
              ['Signed Distance Functions (SDF)', 'f(x, y) = sqrt(x² + y²) - r', 'Anti-aliased geometric primitives (circles, torus, rounded boxes)'],
              ['Boolean Constructive Geometry', 'min(A, B) / max(A, -B)', 'Union, intersection, and subtraction of geometric contours'],
              ['Domain Warping & Noise', 'f(x + noise(x,y), y + noise(x,y))', 'Continuous turbulent fluids, marble patterns, smoke eddies'],
              ['LSB Steganographic Watermark', 'b"PXMT" + length + payload + CRC16', '100% lossless round-trip recovery for exported image files'],
            ],
          },
        },
        {
          title: 'Strict Ephemeral Security & Zero-Disk Retention',
          body: 'In Reverse Mode, uploaded images are treated strictly as volatile, in-memory payloads. PixMath enforces architectural zero-persistence: no uploaded image bytes are ever written to the host filesystem, Docker containers, or persistent databases. Buffers are processed through memory streams and immediately purged via explicit garbage collection (gc.collect).',
        },
      ],
      proTips: [
        'All coordinates in the Forward Engine are mapped to a standardized Cartesian range x, y ∈ [-1.0, 1.0], with aspect ratio correction applied automatically by the WebGL viewport.',
        'Holding Alt and dragging across any number in the editor activates live 60 FPS constant scrubbing without recompiling the GLSL shader.',
      ],
    },
  },

  // ── 2. FORWARD MODE WORKSTATION ───────────────────────────────────────
  {
    id: 'forward-guide',
    category: 'forward',
    categoryLabel: 'Forward Mode',
    title: 'Forward Workstation & Formula IDE',
    shortDescription: 'Step-by-step guide to writing mathematical expressions, AST sandboxing, and real-time shader compilation.',
    badge: 'Step-by-Step Guide',
    badgeColor: 'cyan',
    icon: 'Zap',
    content: {
      lead: 'The Forward Workstation transforms mathematical formulas into high-speed GPU fragment shaders. Learn how to write safe equations, inspect abstract syntax trees, and dynamically scrub numerical constants in real time.',
      steps: [
        {
          step: 1,
          title: 'Compose Mathematical Equations in the Monaco Editor',
          description: 'Type any continuous algebraic formula in the left-hand Symbolic Formula IDE. The editor features full JetBrains Mono typography, syntax highlighting, and auto-pairing.',
          details: [
            'Use standard mathematical functions: sin, cos, tan, atan2, sqrt, exp, log, abs.',
            'Reference continuous spatial variables: x (horizontal [-1, 1]), y (vertical [-1, 1]), and t (monotonic time variable).',
            'Numerical constants (e.g. 10.0, 3.1415, 0.5) are automatically bound to uniform registers u_c[64].',
          ],
          codeSnippet: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)',
        },
        {
          step: 2,
          title: 'Automated AST Security Sandboxing',
          description: 'Before any formula touches the GPU, it is validated against the compiler-level AST Security Sandbox.',
          details: [
            'Whitelisted Grammar: Only pure mathematical operations (Add, Sub, Mult, Div, Pow, Call) are allowed.',
            'Disallowed Nodes: Imports, attribute lookups (__class__, os), control flow, and infinite loops are aggressively rejected.',
            'Security Status: A green "Sandbox Verified: Safe AST" badge confirms validation.',
          ],
        },
        {
          step: 3,
          title: 'Interactive Alt-Drag Constant Scrubbing',
          description: 'Modify numerical constants interactively without triggering a full GLSL re-transpilation or recompilation.',
          details: [
            'Hold the Alt key (Option on macOS) and click-and-drag horizontally over any number in the editor.',
            'Dragging modifies the value with smooth sensitivity (0.02 step per pixel).',
            'The value updates the GPU uniform buffer array (u_c[64]) directly at 60 FPS.',
          ],
          tip: 'Hold Shift while Alt-dragging for ultra-fine micro-adjustments (0.002 step).',
        },
        {
          step: 4,
          title: 'AST X-Ray Inspector & Tokenized Breadcrumbs',
          description: 'Hover your cursor over token badges (e.g., sin, sqrt, atan2) in the AST breadcrumb bar to highlight and isolate coordinate sub-expressions.',
        },
        {
          step: 5,
          title: 'Explore Curated Mathematical Presets',
          description: 'Click any preset in the topbar dropdown (Solar Plasma, Nested Torus SDF, Quantum Wave, Hyperbolic Bloom) to instantly load complex mathematical art into the canvas.',
        },
      ],
      subsections: [
        {
          title: 'Supported Mathematical Functions Reference',
          body: 'The following functions are natively supported and transpiled to optimized GLSL equivalents:',
          table: {
            headers: ['Function', 'Description', 'GLSL Transpiled Equivalent'],
            rows: [
              ['sin(v)', 'Sine wave oscillation', 'sin(v)'],
              ['cos(v)', 'Cosine wave oscillation', 'cos(v)'],
              ['tan(v)', 'Tangent function', 'tan(v)'],
              ['atan2(y, x)', 'Four-quadrant inverse tangent (polar angle θ)', 'atan(y, x)'],
              ['sqrt(v)', 'Square root with clamp protection (safe_sqrt)', 'sqrt(max(v, 0.0))'],
              ['exp(v)', 'Exponential base e (e^v)', 'exp(v)'],
              ['log(v)', 'Natural logarithm with clamp protection', 'log(max(v, 1e-6))'],
              ['abs(v)', 'Absolute value (non-negative magnitude)', 'abs(v)'],
              ['pi', 'Mathematical constant π (3.14159265...)', '3.1415926535'],
              ['e', 'Euler constant e (2.71828182...)', '2.7182818284'],
              ['t', 'Real-time elapsed clock variable (seconds)', 'u_time'],
            ],
          },
        },
      ],
      quickAction: {
        label: 'Switch to Forward Mode',
        mode: 'forward',
      },
    },
  },

  // ── 3. INTERACTIVE VIEWPORT GUIDE ─────────────────────────────────────
  {
    id: 'viewport-guide',
    category: 'viewport',
    categoryLabel: 'Viewport & Canvas',
    title: 'Interactive WebGL2 Viewport & Export',
    shortDescription: 'Master pan/zoom navigation, live coordinate HUD, resolution scaling, and 4K snapshot export.',
    badge: 'User Guide',
    badgeColor: 'emerald',
    icon: 'Eye',
    content: {
      lead: 'The central stage features a high-performance WebGL2 canvas rendering mathematical manifolds directly on your GPU. Explore continuous space, inspect Cartesian coordinates, and export production assets in multiple formats.',
      steps: [
        {
          step: 1,
          title: 'Pan and Zoom across the Continuous Domain',
          description: 'Navigate the infinite Cartesian plane using mouse or trackpad controls.',
          details: [
            'Click and drag anywhere on the canvas to pan the coordinate origin.',
            'Scroll the mouse wheel (or pinch on trackpads) to zoom in and out smoothly from 0.1x to 50x.',
            'Use the floating zoom buttons (+ / -) in the bottom-left controls for precise incremental magnification.',
            'Click the Reset (circular arrow) button to instantly recenter coordinates at (0.0, 0.0) with 1.0x zoom.',
          ],
        },
        {
          step: 2,
          title: 'Real-Time Coordinate HUD & Crosshair',
          description: 'Hover your cursor over any pixel to inspect analytical values in the bottom-right HUD badge.',
          details: [
            'Displays Cartesian x and y coordinates in the current viewport frame.',
            'Displays the exact mathematical function output f(x, y, t) computed on the GPU.',
          ],
        },
        {
          step: 3,
          title: 'Toggle Cartesian Grid & Major Axes',
          description: 'Click the Grid icon in the floating toolbar to toggle the Cartesian coordinate crosshairs (X and Y axes) and grid lines.',
        },
        {
          step: 4,
          title: 'Adjust Resolution Multiplier',
          description: 'Scale rendering resolution in the topbar switcher to balance rendering performance with visual fidelity:',
          details: [
            '1x (FHD): Standard device pixel ratio for maximum frame rate (60-120 FPS).',
            '2x (Retina): High-density supersampling for crisp geometric curves and fine SDF boundaries.',
            '4K: Ultra-high-definition multi-sample rendering for publication-quality output.',
          ],
        },
        {
          step: 5,
          title: 'Export Multi-Format Production Assets',
          description: 'Use the floating export buttons in the top-right corner of the canvas:',
          details: [
            'PNG Snapshot (Download icon): Captures a lossless 4K image snapshot with embedded PixMath provenance metadata.',
            'GLSL Shader (Terminal icon): Opens the export modal displaying the complete, standalone GLSL Fragment Shader #330 code ready for ShaderToy, Three.js, or Unity.',
            'LaTeX Formulation (Code icon): Generates clean, publication-ready KaTeX mathematical equation syntax.',
          ],
        },
      ],
      proTips: [
        'When exporting GLSL, the shader includes clamp protection helpers (safe_div and safe_sqrt) to prevent NaN/Infinity GPU crashes.',
        'Render latency and GPU frame rates are streamed in real time in the topbar telemetry counter.',
      ],
    },
  },

  // ── 4. REVERSE MODE & MATH OCR ────────────────────────────────────────
  {
    id: 'reverse-guide',
    category: 'reverse',
    categoryLabel: 'Reverse Mode',
    title: 'Reverse Mode: Image to Closed-Form Math',
    shortDescription: 'Deep image validation, SIREN/KAN neural distillation, Math OCR integration, and round-trip extraction.',
    badge: 'Step-by-Step Guide',
    badgeColor: 'pink',
    icon: 'ArrowRightLeft',
    content: {
      lead: 'The Reverse Extraction Studio solves the inverse problem: converting an arbitrary digital image back into a compact, human-readable closed-form equation. It combines deep multi-layer feasibility screening, neural-symbolic distillation (SIREN + PySR), and dedicated Math OCR models.',
      steps: [
        {
          step: 1,
          title: 'Switch to Reverse Mode',
          description: 'Click "Reverse Mode (Image → SIREN/KAN)" in the top navigation bar. The studio transitions to a dedicated elevated workstation.',
        },
        {
          step: 2,
          title: 'Upload Target Image',
          description: 'Drag and drop an image file (PNG, JPEG, WebP up to 10MB) into the central dashed dropzone, or click "Select File from Computer".',
          tip: 'You can also click "Load Valid Math Sample" to test instantly with a pre-synthesized wave, torus, or hyperbolic manifold.',
        },
        {
          step: 3,
          title: 'Layer 1 & Layer 2 Ephemeral Mathematical Validation',
          description: 'Every uploaded image is screened in memory before consuming neural computing resources:',
          details: [
            'Layer 1 (Client Pre-check): Verifies file format, reasonable byte size, and non-monochrome pixel variance in a WebGL-accelerated Web Worker.',
            'Layer 2 (Deep Server Check): Evaluates dynamic range, spatial autocorrelation (detecting continuous manifolds vs. random static), and discrete Laplacian gradient sharpness.',
            'If an image is blank, severely out of focus, or pure white noise, it is declined with a detailed diagnostic report explaining why.',
          ],
        },
        {
          step: 4,
          title: 'Neural-Symbolic Distillation & Math OCR Processing',
          description: 'Images passing validation are routed through the extraction pipeline:',
          details: [
            'Lossless Fast-Path (<1 ms): Images previously generated by PixMath are detected via embedded PNG metadata and LSB steganographic watermarks, recovering the exact original formula with 100% confidence.',
            'Math OCR Bridge: Formula and equation images are routed cleanly to dedicated Math OCR engines (Mathpix API or local LaTeX-OCR Vision Transformer) for direct LaTeX extraction.',
            'Neural Distillation (SIREN + PySR): Continuous textures and gradient fields are modeled by fitting an Implicit Neural Representation (SIREN) and evolving closed-form formulas through multi-population Pareto regression.',
          ],
        },
        {
          step: 5,
          title: 'Use the ROI Attention Brush (Optional)',
          description: 'Press the "B" key to toggle the ROI Attention Brush. Paint directly on the image preview to mark high-frequency regions (e.g., spiral centers or boundaries) for prioritized neural fitting.',
        },
        {
          step: 6,
          title: 'Review Results and Execute Mandatory Actions',
          description: 'Once the formula is extracted, review the KaTeX mathematical display and choose one of the three primary actions:',
          details: [
            'Copy Equation: Copies either the raw expression string or the LaTeX formulation to your clipboard with a confirmation toast.',
            'Edit in Forward Mode: Seamlessly transitions the studio back to Forward Mode, injecting the extracted equation directly into the Monaco editor for live GPU morphing.',
            'Cancel / Clear: Wipes all volatile buffers from RAM and resets Reverse Mode to receive a new image.',
          ],
        },
      ],
      subsections: [
        {
          title: 'Understanding the Confidence Score Gauge',
          body: 'The extracted result displays a prominent Confidence Pill Badge indicating recognition certainty:',
          table: {
            headers: ['Score Range', 'Grade', 'Meaning & Recommended Action'],
            rows: [
              ['90% - 100%', 'High Confidence (Green)', 'Exact or high-certainty symbol extraction. Safe for immediate production use.'],
              ['80% - 89%', 'Medium Confidence (Cyan)', 'Valid structural syntax with minor typographical ambiguity.'],
              ['< 80%', 'Low Confidence (Amber)', 'Triggers a friendly warning banner. Some symbols or exponents may need manual verification in Forward Mode.'],
            ],
          },
        },
        {
          title: 'What Images Yield Valid Equations?',
          body: 'Closed-form symbolic expressions model continuous coordinate relationships f(x, y). The table below outlines what can and cannot be distilled:',
          table: {
            headers: ['Input Type', 'Feasibility', 'Reason'],
            rows: [
              ['Parametric wave fields & ripples', 'High (Passes)', 'Smooth, continuous trigonometric harmonic frequencies'],
              ['Signed Distance Fields (SDFs)', 'High (Passes)', 'Coherent geometric boundaries and distance gradients'],
              ['Mathematical equation screenshots', 'High (Passes)', 'Processed directly via Mathpix / LaTeX-OCR into exact formulas'],
              ['Solid monochrome or blank images', 'Declined', 'Zero contrast variance; cannot map coordinate relationships'],
              ['Random TV static / white noise', 'Declined', 'Uncorrelated entropy; continuous math cannot model random noise'],
              ['Heavily blurred or out-of-focus images', 'Declined', 'Laplacian sharpness below threshold; missing boundary contours'],
            ],
          },
        },
      ],
      quickAction: {
        label: 'Switch to Reverse Mode',
        mode: 'reverse',
      },
    },
  },

  // ── 5. ANALYTICS RADAR & PARETO EXPLORER ──────────────────────────────
  {
    id: 'analytics-guide',
    category: 'analytics',
    categoryLabel: 'Analytics & Pareto',
    title: 'Analytics Radar & Pareto Explorer',
    shortDescription: 'Dual precision radial gauges (PSNR/D-SSIM), live WebSocket stream, and Pareto elbow selection.',
    badge: 'Diagnostics',
    badgeColor: 'purple',
    icon: 'Activity',
    content: {
      lead: 'The right-hand Analytics Radar panel provides real-time quantitative telemetry and evolutionary Pareto frontier exploration during neural-symbolic distillation.',
      steps: [
        {
          step: 1,
          title: 'Inspect Dual Precision Radial Gauges',
          description: 'Monitor reconstruction accuracy through two complementary scientific metrics:',
          details: [
            'PSNR (Peak Signal-to-Noise Ratio): Measures pixel-wise mathematical fidelity in decibels (dB). A value above 35 dB indicates near-lossless visual reconstruction.',
            'D-SSIM (Structural Dissimilarity): Measures perceived structural distortion based on human visual perception. Lower values (<0.05) represent excellent contour preservation.',
          ],
        },
        {
          step: 2,
          title: 'Explore the Interactive Pareto Curve',
          description: 'In the Pareto Radar sub-tab, view candidate equations plotted along the Pareto Frontier (Formula Complexity in AST nodes vs. Visual Accuracy in PSNR/SSIM).',
          details: [
            'Minimalist Candidates (Left): Shorter, simpler formulas with fewer AST nodes.',
            'High-Fidelity Candidates (Right): Higher complexity formulas capturing micro-textures.',
            'The Pareto Elbow: The mathematically optimal balance point marked with a distinct badge.',
          ],
        },
        {
          step: 3,
          title: 'Select Candidates with 200ms Cross-Dissolve',
          description: 'Click any candidate dot along the Pareto curve. The WebGL canvas executes a smooth 200ms cross-dissolve transition from the previous formula to the new candidate without stuttering.',
        },
        {
          step: 4,
          title: 'Inspect FlatBuffers AST & WebSocket Stream',
          description: 'Switch between the "FlatBuffers AST" tab to view binary serialized syntax trees, and the "WS Stream" tab to monitor real-time generation events received from the reverse worker.',
        },
      ],
      proTips: [
        'The Pareto Explorer allows you to choose between an elegant 12-node formula suitable for real-time mobile shaders, or a 40-node formula with maximum visual accuracy.',
      ],
    },
  },

  // ── 6. PIXMATH CLI REFERENCE ──────────────────────────────────────────
  {
    id: 'cli-guide',
    category: 'cli',
    categoryLabel: 'CLI & Terminal',
    title: 'PixMath Command-Line Interface (CLI)',
    shortDescription: 'Headless GPU rendering, command-line extraction, and backend health diagnostics via the pixmath command.',
    badge: 'Terminal Reference',
    badgeColor: 'amber',
    icon: 'Terminal',
    content: {
      lead: 'PixMath includes a dedicated Python Command-Line Interface (CLI) built with Typer and Rich, enabling scriptable automation, CI/CD rendering pipelines, and headless extraction on Linux and Windows 11.',
      subsections: [
        {
          title: '1. pixmath render — Headless GPU/CPU Image Generation',
          body: 'Renders an equation directly to an image file headlessly via ModernGL EGL (GPU) with automatic CPU fallback.',
          table: {
            headers: ['Flag / Option', 'Type', 'Default', 'Description'],
            rows: [
              ['--eq / -e', 'STRING', 'Required', 'Mathematical equation string (e.g. "sin(10*x) * cos(10*y)")'],
              ['--out / -o', 'PATH', 'output.png', 'Output image file path (PNG format)'],
              ['--width / -w', 'INTEGER', '512', 'Render width in pixels (1 to 8192)'],
              ['--height / -h', 'INTEGER', '512', 'Render height in pixels (1 to 8192)'],
              ['--time / -t', 'FLOAT', '0.0', 'Clock time variable value for dynamic formulas'],
            ],
          },
        },
        {
          title: '2. pixmath extract — Command-Line Image-to-Equation',
          body: 'Extracts a mathematical equation from an image using the math recognition engine with confidence scoring and lossless watermark extraction.',
          table: {
            headers: ['Flag / Option', 'Type', 'Default', 'Description'],
            rows: [
              ['--image / -i', 'PATH', 'Required', 'Input target image file path (PNG, JPG, WebP)'],
              ['--out / -o', 'PATH', 'equation.txt', 'Output text file path to write the extracted formula'],
            ],
          },
        },
        {
          title: '3. pixmath info — System & Backend Diagnostics',
          body: 'Prints platform details, Python runtime version, ModernGL GPU driver status, and CUDA acceleration availability.',
        },
      ],
      steps: [
        {
          step: 1,
          title: 'Render an Image via ModernGL Headless GPU',
          description: 'Execute pixmath render with an equation string:',
          codeSnippet: 'uv run pixmath render --eq "sin(10.0 * sqrt(x*x + y*y)) * cos(8.0 * atan2(y, x))" -o render.png',
        },
        {
          step: 2,
          title: 'Extract an Equation from an Image File',
          description: 'Execute pixmath extract to recover the formula with accuracy scoring:',
          codeSnippet: 'uv run pixmath extract -i render.png -o extracted.txt',
        },
        {
          step: 3,
          title: 'Inspect Available GPU Backends',
          description: 'Verify ModernGL and CUDA driver bindings:',
          codeSnippet: 'uv run pixmath info',
        },
      ],
    },
  },

  // ── 7. KEYBOARD SHORTCUTS & PRO-TIPS ──────────────────────────────────
  {
    id: 'shortcuts-guide',
    category: 'shortcuts',
    categoryLabel: 'Shortcuts',
    title: 'Keyboard Shortcuts & Productivity Tips',
    shortDescription: 'Master speed navigation, constant scrubbing hotkeys, and expert developer shortcuts.',
    badge: 'Quick Reference',
    badgeColor: 'cyan',
    icon: 'Sliders',
    content: {
      lead: 'Accelerate your workflow with dedicated keyboard shortcuts and expert interaction patterns designed for rapid mathematical exploration.',
      subsections: [
        {
          title: 'Global Hotkeys & Navigation Shortcuts',
          body: 'Use these keyboard shortcuts anywhere in the PixMath Studio:',
          table: {
            headers: ['Shortcut / Action', 'Context', 'Functionality'],
            rows: [
              ['Alt + Click-Drag (Option + Drag)', 'Monaco Formula IDE', 'Real-time 60 FPS constant scrubbing on any number'],
              ['Shift + Alt + Click-Drag', 'Monaco Formula IDE', 'Fine micro-scrubbing (0.002 sensitivity step)'],
              ['B key', 'Reverse Mode', 'Toggle ROI Attention Brush to paint priority neural regions'],
              ['Click + Drag', 'WebGL Canvas', 'Pan continuous Cartesian plane coordinates'],
              ['Mouse Wheel / Pinch', 'WebGL Canvas', 'Smooth zoom in and out (0.1x to 50x)'],
              ['Ctrl + Click / Cmd + Click', 'Presets', 'Instant preset load without dialog confirmation'],
              ['Double Click Canvas', 'WebGL Canvas', 'Quick center coordinate crosshairs at cursor'],
            ],
          },
        },
        {
          title: 'Pro-Tips for Formula Writers',
          body: 'Essential techniques for crafting high-impact mathematical art:',
          keyPoints: [
            'Trigonometric Modulation: Multiplying sine waves of different frequencies (e.g. sin(5x) * sin(5y)) creates grid interference and moiré patterns.',
            'Polar Coordinates: Using atan2(y, x) transforms linear coordinates into polar angles (θ), producing rotational spirals, sunbursts, and radial petals.',
            'Radial Distance (r): Computing r = sqrt(x*x + y*y) gives the Euclidean distance from the origin, perfect for concentric ripples and circular SDF contours.',
            'Time Animation (t): Adding or subtracting t inside periodic terms (e.g. sin(10*r - 2*t)) animates continuous radial expansion or rotation.',
          ],
        },
      ],
    },
  },
];
