/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#FAFAF8',
        sheet: '#FFFFFF',
        ink: '#1A1915',
        graphite: '#6B675F',
        rule: '#E7E4DD',
        marker: '#F5E27A',
        score: {
          weak: '#A63A2E',
          fair: '#8A6512',
          good: '#1E6B45',
          excellent: '#134F33',
        },
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        column: '52rem',
      },
    },
  },
  plugins: [],
}
