import { useState } from 'react';
import { 
  Layers, 
  Cpu, 
  Workflow, 
  TrendingUp, 
  Code2, 
  ChevronRight,
  Crosshair
} from 'lucide-react';

export interface ASTBranch {
  id: string;
  count: number;
  label: string;
  code: string;
  icon: any;
  isActive?: boolean;
}

export interface LeafNode {
  id: string;
  name: string;
  expression: string;
  tag: string;
  rating: number;
  status: 'verified' | 'optimal' | 'draft';
  complexity: number;
}

interface DendriteGraphProps {
  scale: number;
  selectedLeaf: LeafNode;
  onSelectLeaf: (leaf: LeafNode) => void;
  equation: string;
}

export const SAMPLE_BRANCHES: ASTBranch[] = [
  { id: 'b1', count: 18, label: 'Trigonometric Harmonics', code: 'TRIG-01', icon: Workflow },
  { id: 'b2', count: 3, label: 'SDF Shape Topologies', code: 'SDF-02', icon: Layers },
  { id: 'b3', count: 24, label: 'Closed-Form Manifolds', code: 'FORM-03', icon: Code2, isActive: true },
  { id: 'b4', count: 32, label: 'Simplex Noise Fields', code: 'NOIS-04', icon: Cpu },
  { id: 'b5', count: 12, label: 'Pareto Evolutionary Runs', code: 'EVOL-05', icon: TrendingUp },
];

export const SAMPLE_LEAF_NODES: LeafNode[] = [
  { id: 'l1', name: 'YEGANEH SOLAR ARCH', expression: 'sin(10.0 * sqrt(x*x + y*y) - 2.0*t)', tag: 'SPEC: 12.1', rating: 98, status: 'verified', complexity: 7 },
  { id: 'l2', name: 'HARMONIC AZIMUTH', expression: 'cos(8.0 * atan2(y, x) + t)', tag: 'SPEC: 08.4', rating: 94, status: 'optimal', complexity: 6 },
  { id: 'l3', name: 'GAUSSIAN ORBITAL DEC', expression: 'exp(-1.5 * (x*x + y*y))', tag: 'SPEC: 25.1', rating: 99, status: 'verified', complexity: 5 },
  { id: 'l4', name: 'RADIAL SAFE SQRT', expression: 'safe_sqrt(x*x + y*y)', tag: 'SPEC: 19.3', rating: 92, status: 'optimal', complexity: 4 },
  { id: 'l5', name: 'PHASE MODULATOR', expression: 'sin(6.0 * x * y + t * 0.5)', tag: 'SPEC: 16.0', rating: 95, status: 'verified', complexity: 8 },
  { id: 'l6', name: 'CSG SMOOTH UNION', expression: 'smooth_min(d1, d2, 0.25)', tag: 'SPEC: 09.2', rating: 97, status: 'optimal', complexity: 9 },
  { id: 'l7', name: 'SIMPLEX WARP X-AXIS', expression: 'noise(x * 2.0, y * 2.0)', tag: 'SPEC: 14.8', rating: 91, status: 'verified', complexity: 7 },
  { id: 'l8', name: 'SIMPLEX WARP Y-AXIS', expression: 'noise(y * 2.0 + 3.14, x * 2.0)', tag: 'SPEC: 11.2', rating: 90, status: 'verified', complexity: 7 },
  { id: 'l9', name: 'SINGULARITY GUARD', expression: 'safe_div(x, y + 1.2)', tag: 'SPEC: 15.6', rating: 96, status: 'optimal', complexity: 4 },
  { id: 'l10', name: 'HIGH-FREQ RESONATOR', expression: 'sin(24.0 * (x + y)) * 0.08', tag: 'SPEC: 12.0', rating: 88, status: 'draft', complexity: 6 },
  { id: 'l11', name: 'CONCENTRIC RING SDF', expression: 'abs(sqrt(x*x + y*y) - 0.6) - 0.1', tag: 'SPEC: 18.4', rating: 99, status: 'optimal', complexity: 8 },
  { id: 'l12', name: 'COLOR GRADIENT MIX', expression: 'mix(vec3(0.1), vec3(0.9), val)', tag: 'SPEC: 14.1', rating: 94, status: 'verified', complexity: 5 },
  { id: 'l13', name: 'SPECTRAL SSIM LOSS', expression: 'lambda * L2 + (1-lambda) * DSSIM', tag: 'SPEC: 10.3', rating: 97, status: 'optimal', complexity: 11 },
  { id: 'l14', name: 'HYPERBOLIC HARMONIC', expression: 'cos(12.0 * atan2(y, x)) * 0.3', tag: 'SPEC: 13.9', rating: 93, status: 'verified', complexity: 6 },
];

export function DendriteGraph({
  scale,
  selectedLeaf,
  onSelectLeaf,
  equation,
}: DendriteGraphProps) {
  const [activeBranchId, setActiveBranchId] = useState<string>('b3');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Precision Engineering Grid Layout
  const coreX = 170;
  const coreY = 360;

  const branchX = 390;
  const branchSpacing = 68;
  const branchStartY = 220;

  const leafX = 660;
  const leafSpacing = 38;
  const leafStartY = 110;

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-cad-grid select-none">
      {/* Precision CAD Crosshairs and Coordinates */}
      <div className="absolute top-4 left-4 font-mono text-[9px] text-slate-600 flex items-center space-x-4">
        <span>GRID: 32PX [CAD-MODE]</span>
        <span>ORIGIN: (0.000, 0.000)</span>
        <span>TOPOLOGY: ORTHOGONAL BUS</span>
      </div>

      <div 
        className="relative transition-transform duration-200 ease-out origin-center"
        style={{
          width: '1180px',
          height: '740px',
          transform: `scale(${scale})`,
        }}
      >
        {/* ── Orthogonal & Precision Angled Bus Lines ─────────────── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <pattern id="grid-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* 1. Core to Branch Conduits (Right-Angle / Chamfered Precision Bus) */}
          {SAMPLE_BRANCHES.map((b, i) => {
            const by = branchStartY + i * branchSpacing + 22;
            const bx = branchX;
            const isSelected = b.id === activeBranchId;
            const cornerX = coreX + 90;

            // Precision 45-degree chamfered conduit path
            const pathData = `M ${coreX + 50} ${coreY} L ${cornerX} ${coreY} L ${cornerX + 30} ${by} L ${bx} ${by}`;

            return (
              <g key={b.id}>
                {/* Background conduit line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={isSelected ? '#F59E0B' : '#1C2530'}
                  strokeWidth={isSelected ? 2 : 1}
                  className="transition-colors duration-150"
                />
                {/* Pin terminal square */}
                <rect
                  x={bx - 4}
                  y={by - 2}
                  width={4}
                  height={4}
                  fill={isSelected ? '#F59E0B' : '#334155'}
                />
              </g>
            );
          })}

          {/* 2. Active Branch to Leaf Nodes Bus Lines */}
          {SAMPLE_LEAF_NODES.map((leaf, idx) => {
            const sourceY = branchStartY + 2 * branchSpacing + 22;
            const sourceX = branchX + 175;

            const targetY = leafStartY + idx * leafSpacing + 16;
            const targetX = leafX;

            const isCurrent = leaf.id === selectedLeaf.id;
            const isHover = leaf.id === hoveredNode;

            const bus1X = sourceX + 25;
            const bus2X = targetX - 35;

            // Strict orthogonal circuit trace (Horizontal -> Vertical -> Horizontal)
            const pathData = `M ${sourceX} ${sourceY} L ${bus1X} ${sourceY} L ${bus2X} ${targetY} L ${targetX} ${targetY}`;

            return (
              <g key={leaf.id}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={
                    isCurrent
                      ? '#00F0FF'
                      : isHover
                      ? '#38BDF8'
                      : '#1A232D'
                  }
                  strokeWidth={isCurrent ? 1.8 : 1}
                  className="transition-all duration-100"
                />
                {/* Sharp square terminal node */}
                <rect
                  x={targetX - 3}
                  y={targetY - 1.5}
                  width={3}
                  height={3}
                  fill={isCurrent ? '#00F0FF' : '#232D3A'}
                />
              </g>
            );
          })}
        </svg>

        {/* ── 1. The Iconic Architectural Root Core ───────────────── */}
        <div 
          className="absolute z-10 flex flex-col items-center justify-center"
          style={{
            left: `${coreX - 75}px`,
            top: `${coreY - 75}px`,
            width: '150px',
            height: '150px',
          }}
        >
          {/* Outer Square Reticle with Precision Corner Ticks */}
          <div className="absolute inset-0 border border-[#232C37] bg-[#080B0F]">
            {/* Corner Crosshairs */}
            <span className="absolute -top-1.5 -left-1.5 text-[10px] font-mono text-[#00F0FF] leading-none">+</span>
            <span className="absolute -top-1.5 -right-1.5 text-[10px] font-mono text-[#00F0FF] leading-none">+</span>
            <span className="absolute -bottom-1.5 -left-1.5 text-[10px] font-mono text-[#00F0FF] leading-none">+</span>
            <span className="absolute -bottom-1.5 -right-1.5 text-[10px] font-mono text-[#00F0FF] leading-none">+</span>

            {/* Coordinate Ruler Markings */}
            <div className="w-full h-full p-2 flex flex-col justify-between text-[8px] font-mono text-slate-600">
              <div className="flex justify-between">
                <span>-1.0</span>
                <span>+1.0</span>
              </div>
              <div className="flex justify-between items-center text-center">
                <span className="text-[9px] text-[#00F0FF] font-bold">X</span>
                <span className="text-[9px] text-amber-400 font-bold">Y</span>
              </div>
              <div className="flex justify-between">
                <span>0.00</span>
                <span>t=0</span>
              </div>
            </div>
          </div>

          {/* Central Precision Aperture */}
          <div className="relative z-10 w-16 h-16 bg-[#0E1318] border-2 border-[#00F0FF] flex flex-col items-center justify-center shadow-lg shadow-[#00F0FF]/10">
            <Crosshair className="w-6 h-6 text-[#00F0FF]" />
            <span className="font-mono text-[9px] text-white font-bold mt-0.5">f(x,y,t)</span>
          </div>

          {/* Core Technical Status Plate */}
          <div className="mt-4 text-center">
            <div className="font-mono text-[10px] uppercase font-bold text-slate-200 tracking-wider">
              ROOT MANIFOLD
            </div>
            <div className="text-[9px] font-mono text-slate-500 mt-0.5 truncate max-w-[130px]" title={equation}>
              {equation}
            </div>
            <div className="mt-1 flex items-center justify-center space-x-1 font-mono text-[8px]">
              <span className="bg-[#1C232B] text-slate-300 px-1 py-0.2 border border-[#28323D]">
                DEPTH: 04/32
              </span>
              <span className="bg-[#10B981]/20 text-[#10B981] px-1 py-0.2 border border-[#10B981]/40">
                PASS
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Primary Intermediate Category Cards (Sharp Rectangles) ─ */}
        <div 
          className="absolute z-10 flex flex-col space-y-3"
          style={{
            left: `${branchX}px`,
            top: `${branchStartY}px`,
            width: '175px',
          }}
        >
          {SAMPLE_BRANCHES.map((branch) => {
            const isSelected = branch.id === activeBranchId;
            const IconComponent = branch.icon;

            return (
              <div
                key={branch.id}
                onClick={() => setActiveBranchId(branch.id)}
                className={`relative px-3 py-2 cursor-pointer transition-all duration-100 select-none ${
                  isSelected
                    ? 'tech-card-active border-l-4 border-l-[#F59E0B]'
                    : 'tech-card hover:bg-[#12171E] hover:border-[#384554]'
                }`}
              >
                {/* Active Indicator Pip */}
                {isSelected && (
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-3 bg-[#F59E0B]" />
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1 border ${
                      isSelected 
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]' 
                        : 'bg-[#141A22] border-[#222B36] text-slate-400'
                    }`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    <div>
                      <div className="flex items-baseline space-x-1.5">
                        <span className={`font-mono text-xs font-bold ${
                          isSelected ? 'text-[#F59E0B]' : 'text-slate-200'
                        }`}>
                          [{branch.count.toString().padStart(2, '0')}]
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">
                          {branch.code}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[105px]">
                        {branch.label}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#F59E0B]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 3. The Fine Fan-Out Leaf Matrix (Sharp Telemetry Strips) ── */}
        <div 
          className="absolute z-10 flex flex-col space-y-1.5"
          style={{
            left: `${leafX}px`,
            top: `${leafStartY}px`,
            width: '350px',
          }}
        >
          {SAMPLE_LEAF_NODES.map((leaf) => {
            const isSelected = leaf.id === selectedLeaf.id;
            const isHover = leaf.id === hoveredNode;

            return (
              <div
                key={leaf.id}
                onClick={() => onSelectLeaf(leaf)}
                onMouseEnter={() => setHoveredNode(leaf.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-all duration-75 border font-mono ${
                  isSelected
                    ? 'bg-[#0E1620] border-[#00F0FF] border-l-4 border-l-[#00F0FF] shadow-md shadow-[#00F0FF]/10'
                    : isHover
                    ? 'bg-[#10151C] border-[#2E3B4B]'
                    : 'bg-[#090D11] border-[#182028] hover:bg-[#0E1318]'
                }`}
              >
                {/* Node Identifier */}
                <div className="flex items-center space-x-2 truncate">
                  <span className={`text-[10px] font-bold ${
                    isSelected ? 'text-[#00F0FF]' : 'text-slate-300'
                  }`}>
                    {leaf.name}
                  </span>
                </div>

                {/* Technical Specifications */}
                <div className="flex items-center space-x-2 text-[9px] shrink-0">
                  <span className="text-slate-500 bg-[#121820] px-1 py-0.2 border border-[#1E2733]">
                    {leaf.tag}
                  </span>

                  <span className={`px-1 py-0.2 font-bold ${
                    leaf.status === 'optimal'
                      ? 'text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30'
                      : leaf.status === 'verified'
                      ? 'text-[#00F0FF] bg-[#00F0FF]/10 border border-[#00F0FF]/30'
                      : 'text-slate-500 bg-slate-900 border border-slate-700'
                  }`}>
                    [{leaf.status.toUpperCase()}]
                  </span>

                  <span className="text-slate-400 font-mono">
                    {leaf.rating}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
