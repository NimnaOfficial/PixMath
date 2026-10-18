/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#05080E',
        surface: {
          base: '#0A0F1D',
          panel: 'rgba(16, 24, 40, 0.65)',
          elevated: 'rgba(23, 33, 56, 0.85)',
          card: '#0E1626',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.07)',
          active: 'rgba(6, 182, 212, 0.45)',
          highlight: 'rgba(6, 182, 212, 0.75)',
        },
        math: {
          coord: '#06B6D4',
          trig: '#F59E0B',
          sdf: '#EC4899',
          noise: '#8B5CF6',
          pareto: '#10B981',
          error: '#EF4444',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Geist', 'Inter', '-apple-system', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-cyan': 'glowCyan 2s ease-in-out infinite',
        'strobe': 'chromaStrobe 1.5s infinite',
      },
      keyframes: {
        glowCyan: {
          '0%, 100%': { filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))' },
          '50%': { filter: 'drop-shadow(0 0 18px rgba(6, 182, 212, 0.85))' },
        },
        chromaStrobe: {
          '0%, 100%': { opacity: '0.85', filter: 'hue-rotate(0deg)' },
          '50%': { opacity: '1', filter: 'hue-rotate(60deg) brightness(1.2)' },
        }
      }
    },
  },
  plugins: [],
}
