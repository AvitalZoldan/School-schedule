/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c2430',
        'ink-soft': '#5b6472',
        paper: '#f6f4ef',
        panel: '#ffffff',
        line: '#e2ddd2',
        accent: '#2f6f5e',
        'accent-soft': '#e4efec',
        warn: '#b3541e',
        'warn-soft': '#faeadf',
        danger: '#a33636',
        'danger-soft': '#f7e4e2',
        ok: '#3a7d44',
        'ok-soft': '#e7f2e6',
        gold: '#a8823a',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Assistant', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
