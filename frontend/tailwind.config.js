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
          base: '#0B0F17',
          subtle: '#111827',
          card: '#111827',
          hover: '#1F2937',
          elevated: '#1F2937',
        },
        border: {
          subtle: '#1E293B',
          DEFAULT: '#27354A',
          strong: '#374151',
          accent: 'rgba(59, 130, 246, 0.3)',
        },
        navy: {
          950: '#0B0F17',
          900: '#111827',
          850: '#151D2A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
        },
        violet: {
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
          950: '#0F172A',
        },
        cyan: {
          300: '#94A3B8',
          400: '#64748B',
          500: '#0284C7',
          600: '#0369A1',
          700: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          subtle: '#1E3A8A',
        },
      },
      boxShadow: {
        glow: '0 0 15px -3px rgba(59, 130, 246, 0.2)',
        'glow-cyan': '0 0 15px -3px rgba(2, 132, 199, 0.2)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        elevated: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
