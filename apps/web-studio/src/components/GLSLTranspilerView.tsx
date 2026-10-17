import { useState } from 'react';
import { Code, Copy, Check, Download } from 'lucide-react';

interface GLSLTranspilerViewProps {
  equation: string;
}

export function GLSLTranspilerView({ equation }: GLSLTranspilerViewProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'glsl' | 'python'>('glsl');

  const glslCode = `// ========================================================
// PixMath Transpiled GLSL Fragment Shader
// Formula: ${equation}
// Continuous Domain: x, y in [-1.0, 1.0], time t >= 0
// ========================================================
#version 330 core

out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_domain;

// Mathematical Singularity Guards
float safe_div(float a, float b) {
    return a / (abs(b) < 1e-6 ? 1e-6 : b);
}

float safe_sqrt(float v) {
    return sqrt(max(v, 0.0));
}

void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    float x = uv.x * (u_domain > 0.0 ? u_domain : 1.8);
    float y = uv.y * (u_domain > 0.0 ? u_domain : 1.8);
    float t = u_time;

    // Evaluated continuous formula
    float val = ${equation
      .replace(/atan2\(/g, "atan(")
      .replace(/pi/g, "3.14159265")
      .replace(/e/g, "2.71828182")};

    // Normalized radiance color map
    float elev = clamp(val * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.05, 0.08, 0.10), vec3(0.06, 0.72, 0.51), smoothstep(0.1, 0.6, elev));
    col = mix(col, vec3(0.25, 0.92, 0.78), smoothstep(0.6, 0.9, elev));

    fragColor = vec4(col, 1.0);
}
`;

  const pythonCode = `"""
PixMath Headless ModernGL Standalone Synthesis Script
"""
import moderngl
import numpy as np
from PIL import Image

ctx = moderngl.create_standalone_context()
prog = ctx.program(
    vertex_shader='''
        #version 330
        in vec2 in_vert;
        void main() { gl_Position = vec4(in_vert, 0.0, 1.0); }
    ''',
    fragment_shader='''
${glslCode}
    '''
)

fbo = ctx.framebuffer(color_attachments=[ctx.texture((1024, 1024), 4)])
fbo.use()
prog['u_resolution'].value = (1024.0, 1024.0)
prog['u_time'].value = 0.0
prog['u_domain'].value = 1.8

# Render quad
vbo = ctx.buffer(np.array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1], dtype='f4'))
vao = ctx.vertex_array(prog, [(vbo, '2f', 'in_vert')])
vao.render()

data = fbo.read(components=4)
img = Image.frombytes('RGBA', (1024, 1024), data).transpose(Image.FLIP_TOP_BOTTOM)
img.save('pixmath_export.png')
print("Rendered 1024x1024 frame to pixmath_export.png")
`;

  const codeToShow = activeTab === 'glsl' ? glslCode : pythonCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToShow);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeToShow], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'glsl' ? 'pixmath_shader.frag' : 'pixmath_render.py';
    a.click();
  };

  return (
    <div className="w-full flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#1c222b] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-[#10b981]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              GLSL & ModernGL Code Transpiler
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Compile symbolic expressions directly into high-throughput GPU fragment shaders and Python render pipelines.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[#12161c] border border-[#1e252f] rounded-lg p-1 text-xs">
            <button
              onClick={() => setActiveTab('glsl')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                activeTab === 'glsl' ? 'bg-[#1a232f] text-[#10b981]' : 'text-slate-400 hover:text-white'
              }`}
            >
              GLSL #330
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                activeTab === 'python' ? 'bg-[#1a232f] text-[#10b981]' : 'text-slate-400 hover:text-white'
              }`}
            >
              Python ModernGL
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#17202b] hover:bg-[#202b3a] border border-[#263242] text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-black text-xs font-semibold rounded-lg shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0c0f13] border border-[#1b222b] rounded-2xl p-5 overflow-x-auto shadow-2xl">
        <pre className="font-mono text-xs text-slate-300 leading-relaxed">
          <code>{codeToShow}</code>
        </pre>
      </div>
    </div>
  );
}
