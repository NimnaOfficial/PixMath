import { useState } from 'react';
import { Navbar, StudioTab } from './components/Navbar';
import { FormulaCommandBar, PRESETS } from './components/FormulaCommandBar';
import { StudioViewport } from './components/StudioViewport';
import { PresetSidebar } from './components/PresetSidebar';
import { MathTelemetryDeck } from './components/MathTelemetryDeck';
import { ParetoExplorer } from './components/ParetoExplorer';
import { ASTSandboxView } from './components/ASTSandboxView';
import { TargetMatchingView } from './components/TargetMatchingView';
import { GLSLTranspilerView } from './components/GLSLTranspilerView';

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [selectedPreset, setSelectedPreset] = useState('Hamid Yeganeh Solar Plasma');
  const [equation, setEquation] = useState(PRESETS['Hamid Yeganeh Solar Plasma'].formula);
  const [domainScale, setDomainScale] = useState(1.8);
  const [safeMode, setSafeMode] = useState(true);
  const [resolution, setResolution] = useState('1024²');
  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSelectPreset = (name: string) => {
    setSelectedPreset(name);
    if (PRESETS[name]) {
      setEquation(PRESETS[name].formula);
      notify(`Loaded Preset: ${name}`);
    }
  };

  const handleCompile = () => {
    notify('Transpiled to GLSL Fragment Shader via ModernGL EGL');
  };

  const handleNewFormula = () => {
    setEquation('sin(8.0 * x) * cos(8.0 * y) + sin(t)');
    setSelectedPreset('Custom Formula');
    setActiveTab('studio');
    notify('New custom continuous formula workspace created');
  };

  return (
    <div className="min-h-screen w-full bg-[#090c0f] text-slate-100 flex flex-col antialiased">
      {/* ── 1. Top Responsive Web Navbar ───────────────────────── */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        resolution={resolution}
        setResolution={setResolution}
        onNewFormula={handleNewFormula}
      />

      {/* ── 2. Formula Command Bar ─────────────────────────────── */}
      <FormulaCommandBar
        equation={equation}
        setEquation={setEquation}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        onCompile={handleCompile}
      />

      {/* ── 3. Main Workspace Stage ────────────────────────────── */}
      <main className="flex-1 w-full flex flex-col p-4 md:p-6 overflow-x-hidden">
        {activeTab === 'studio' && (
          <div className="flex-1 w-full flex flex-col lg:flex-row gap-5 items-stretch">
            {/* Left Column: Preset Gallery & Domain Controls */}
            <PresetSidebar
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              domainScale={domainScale}
              setDomainScale={setDomainScale}
              safeMode={safeMode}
              setSafeMode={setSafeMode}
            />

            {/* Center Stage: Interactive Continuous Math Viewport */}
            <div className="flex-1 min-h-[520px] flex flex-col">
              <StudioViewport
                equation={equation}
                domainScale={domainScale}
                palette="emerald"
              />
            </div>

            {/* Right Column: High-End Synthesis Telemetry Deck */}
            <MathTelemetryDeck
              equation={equation}
              onCopyGLSL={() => notify('GLSL Shader copied to clipboard!')}
            />
          </div>
        )}

        {activeTab === 'ast' && <ASTSandboxView equation={equation} />}
        {activeTab === 'pareto' && (
          <ParetoExplorer
            onLoadFormula={(f) => {
              setEquation(f);
              setSelectedPreset('Pareto Discovered Formula');
              setActiveTab('studio');
              notify('Loaded Pareto Formula into Studio Viewport');
            }}
          />
        )}
        {activeTab === 'target' && <TargetMatchingView equation={equation} />}
        {activeTab === 'export' && <GLSLTranspilerView equation={equation} />}
      </main>

      {/* ── Floating Notification Toast ────────────────────────── */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-[#12161c] border border-[#10b981]/50 text-[#10b981] px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono animate-bounce">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
}
