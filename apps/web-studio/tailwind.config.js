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
          900: '#0B0F19',
          800: '#111827',
          700: '#1F2937',
        },
        math: {
          cyan: '#06B6D4',
          amber: '#F59E0B',
          emerald: '#10B981',
          purple: '#8B5CF6',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
