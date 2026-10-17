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
        obsidian: {
          950: '#04080a',
          900: '#070d10',
          850: '#0a1317',
          800: '#0f1c22',
          700: '#172831',
          600: '#233b47',
        },
        math: {
          cyan: '#06B6D4',
          teal: '#14B8A6',
          mint: '#2DD4BF',
          amber: '#F59E0B',
          gold: '#FBBF24',
          emerald: '#10B981',
          purple: '#A855F7',
          violet: '#8B5CF6',
          coral: '#F43F5E',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'spin-very-slow': 'spin 30s linear infinite',
        'spin-reverse': 'spin-rev 24s linear infinite',
        'pulse-subtle': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow 3s ease-in-out infinite',
      },
      keyframes: {
        'spin-rev': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 15px rgba(168, 85, 247, 0.4))' },
          '50%': { filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.8))' },
        }
      }
    },
  },
  plugins: [],
}
