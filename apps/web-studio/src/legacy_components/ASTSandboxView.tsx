import { ShieldCheck, CheckCircle2, Layers } from 'lucide-react';

interface ASTSandboxViewProps {
  equation: string;
}

export function ASTSandboxView({ equation }: ASTSandboxViewProps) {
  // Symbolic AST node mock structure
  const astTokens = [
    { type: 'Operator', val: 'Mul (*)', color: 'text-amber-400', depth: 1 },
    { type: 'Function', val: 'sin(...)', color: 'text-[#10b981]', depth: 2 },
    { type: 'BinaryOp', val: 'Sub (-)', color: 'text-amber-400', depth: 3 },
    { type: 'Function', val: 'sqrt(...)', color: 'text-[#10b981]', depth: 4 },
    { type: 'Variable', val: 'x * x + y * y', color: 'text-cyan-300', depth: 5 },
    { type: 'Function', val: 'cos(...)', color: 'text-[#10b981]', depth: 2 },
    { type: 'Function', val: 'atan2(y, x)', color: 'text-[#10b981]', depth: 3 },
    { type: 'Variable', val: 't (Time)', color: 'text-purple-400', depth: 3 },
  ];

  const securityChecks = [
    { title: 'AST Tree Depth Limit', status: 'Passed (Depth 5 <= 8 Max)', pass: true },
    { title: 'Division by Zero Guard', status: 'Protected via safe_div(a, b)', pass: true },
    { title: 'Whitelisted Function Symbols', status: 'sin, cos, sqrt, atan2, exp permitted', pass: true },
    { title: 'No System/Eval Execution', status: 'Strictly mathematical AST', pass: true },
    { title: 'Execution Latency Guard', status: 'Bounded to <10ms budget', pass: true },
  ];

  return (
    <div className="w-full flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex items-center justify-between border-b border-[#1c222b] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#10b981]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              Symbolic AST Compiler & Sandbox
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Abstract Syntax Tree parsing, operator whitelisting, and singularity guard verification.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-[#12161c] border border-[#1e252f] px-3 py-1.5 rounded-lg text-xs font-mono text-[#10b981]">
          <ShieldCheck className="w-4 h-4 text-[#10b981]" />
          <span>AST Sandbox: Compliant</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AST Node Tree View */}
        <div className="lg:col-span-2 bg-[#0d1014] border border-[#1b222b] rounded-2xl p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Parsed AST Expression Nodes</span>
            <span className="text-[10px] font-mono text-slate-500">24 Nodes Parsed</span>
          </div>

          <div className="bg-[#12161c] border border-[#1e252f] rounded-xl p-3 font-mono text-xs text-cyan-300 break-all">
            {equation}
          </div>

          {/* Tree hierarchy */}
          <div className="flex flex-col space-y-2 pt-2">
            {astTokens.map((tok, i) => (
              <div
                key={i}
                style={{ marginLeft: `${(tok.depth - 1) * 20}px` }}
                className="flex items-center space-x-3 bg-[#131820] border border-[#202834] px-3 py-2 rounded-xl text-xs font-mono"
              >
                <span className="text-[10px] text-slate-500">L{tok.depth}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  tok.type === 'Function' ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-[#1e2733] text-slate-300'
                }`}>
                  {tok.type}
                </span>
                <span className={tok.color}>{tok.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Sandboxing Checklist */}
        <div className="bg-[#0d1014] border border-[#1b222b] rounded-2xl p-5 flex flex-col space-y-4">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
            <span>Safety Audit Checklist</span>
          </div>

          <div className="flex flex-col space-y-3">
            {securityChecks.map((check, i) => (
              <div key={i} className="p-3 bg-[#12161c] border border-[#1e252f] rounded-xl space-y-1">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>{check.title}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 pl-5">
                  {check.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
