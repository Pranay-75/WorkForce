/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          base: '#070B14',
          subtle: '#0B1120',
          card: '#0F172A',
          hover: '#162038',
          elevated: '#1E293B',
        },
        border: {
          subtle: '#1E293B',
          DEFAULT: '#283548',
          strong: '#3B4B64',
          accent: 'rgba(139, 92, 246, 0.3)',
        },
        navy: {
          950: '#070B14',
          900: '#0B1120',
          850: '#0F172A',
          800: '#162038',
          700: '#1E293B',
          600: '#334155',
        },
        violet: {
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          900: '#3B0764',
        },
        cyan: {
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          900: '#164E63',
        },
      },
      boxShadow: {
        glow: '0 0 20px -5px rgba(139, 92, 246, 0.35)',
        'glow-cyan': '0 0 20px -5px rgba(6, 182, 212, 0.35)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        elevated: '0 10px 30px -5px rgba(0, 0, 0, 0.65)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
