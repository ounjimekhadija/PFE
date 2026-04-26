/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        jakarta: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        warm: {
          bg: '#faf9f6',
          surface: '#f4f3f1',
          'surface-high': '#efeeeb',
          border: '#d1c5b0',
          'border-high': '#e3e2e0',
          text: '#1a1c1a',
          'text-muted': '#7f7664',
          'text-mid': '#4d4636',
          primary: '#765b00',
          'primary-dim': '#594400',
          'primary-container': '#ffd464',
          'primary-light': '#ffdf94',
          'primary-glow': '#ebc254',
          secondary: '#5f5e5e',
          'secondary-container': '#e2dfde',
          error: '#ba1a1a',
          'error-container': '#ffdad6',
          'on-error': '#93000a',
        },
      },
    },
  },
  plugins: [],
}
