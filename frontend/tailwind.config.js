/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E8177A', 50: '#FDE8F3', 100: '#FBCEE6', 500: '#E8177A', 600: '#C9136A', 700: '#A50F57' },
        blue:    { DEFAULT: '#4AAEE0', 500: '#4AAEE0', 600: '#3A9ED0' },
        purple:  { DEFAULT: '#A87BC8', 500: '#A87BC8' },
      }
    },
  },
  plugins: [],
}
