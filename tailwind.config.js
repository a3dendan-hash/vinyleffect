/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        'surface-elevated': '#171717',
        border: '#262626',
        'border-subtle': '#1f1f1f',
        primary: '#f5f5f5',
        accent: '#8b5cf6',
        'accent-light': '#a855f7',
        'accent-dim': '#7c3aed',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
