/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void:    '#030308',
        surface: '#080812',
        primary: '#8B5CF6',
        accent:  '#06B6D4',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      backgroundImage: {
        'violet-radial': 'radial-gradient(ellipse at center, rgba(139,92,246,0.18) 0%, transparent 70%)',
        'cyan-radial':   'radial-gradient(ellipse at center, rgba(6,182,212,0.18) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
