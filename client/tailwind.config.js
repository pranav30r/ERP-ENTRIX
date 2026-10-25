/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#0a0c0f',
          900: '#111317',
          850: '#16191f',
          800: '#1e2229',
          700: '#2c313a',
          600: '#404754'
        },
        stripe: {
          canvas: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          hover: '#f1f5f9',
          accent: '#635bff', // Classic Stripe purple-blue accent
          accentHover: '#4f46e5'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    },
  },
  plugins: [],
}
