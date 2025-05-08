/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eaf3fb',
          100: '#c8e0f6',
          200: '#93c5ea',
          300: '#5a9fd6',
          400: '#2176ae',
          500: '#174ea6',
          600: '#143d7a',
          700: '#102e5a',
          800: '#0c2040',
          900: '#08142a',
          950: '#050a14',
        },
        secondary: {
          50: '#e6f7f1',
          100: '#b8e9d6',
          200: '#7fd6b3',
          300: '#3dbd8c',
          400: '#159a6b',
          500: '#107a54',
          600: '#0d5c3e',
          700: '#09412b',
          800: '#06291a',
          900: '#03140c',
          950: '#010a06',
        },
        accent: {
          50: '#fffbe6',
          100: '#fff3b8',
          200: '#ffe47f',
          300: '#ffd23d',
          400: '#ffc107',
          500: '#e6a700',
          600: '#b38600',
          700: '#806200',
          800: '#4d3d00',
          900: '#2a2100',
          950: '#140e00',
        },
        cinema: {
          dark: '#0a0a0a',
          light: '#f5f5f5',
          gold: '#ffc107',
        },
      },
      fontFamily: {
        heading: ['Georgia', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};