/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warmly: {
          orange:  '#FF6B35',
          peach:   '#FFB347',
          cream:   '#FFF8F0',
          dark:    '#1A1A2E',
          deep:    '#0A0A18',
          card:    'rgba(255,255,255,0.06)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'glow-orange': 'radial-gradient(ellipse at center, rgba(255,107,53,0.15) 0%, transparent 70%)',
        'hero-gradient': 'linear-gradient(135deg, #0A0A18 0%, #1A0A2E 50%, #0A0A18 100%)',
      },
      boxShadow: {
        'glow': '0 0 40px rgba(255,107,53,0.25)',
        'glow-sm': '0 0 20px rgba(255,107,53,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
