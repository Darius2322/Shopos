/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#f7f6f2', raised: '#ffffff' },
        ink: '#1c2420',
        field: {
          50: '#eef6f1', 100: '#d3e9dc', 300: '#7fbf9c',
          500: '#2f8f60', 600: '#146b4a', 700: '#0f5439'
        },
        rust: { 50: '#fbeeea', 500: '#c1502e', 600: '#a3401f' },
        amber: { 50: '#fdf3e2', 100: '#fbe6c2', 500: '#c2860f', 600: '#a06f0c' },
        slate: {
          50: '#f5f6f5', 200: '#e2e5e1', 500: '#6b746e', 600: '#525a54'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: { card: '14px' }
    }
  },
  plugins: []
};
