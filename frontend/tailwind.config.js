/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // KAAPAV White & Gold Theme
        gold: {
          50: '#FBF8F0',
          100: '#F7F0E0',
          200: '#EFE1C1',
          300: '#E5D0A2',
          400: '#D4AF37', // Primary Gold
          500: '#C9A227',
          600: '#B8941E',
          700: '#9A7B19',
          800: '#7C6314',
          900: '#5E4A0F'
        },
        kaapav: {
          white: '#FFFFFF',
          cream: '#FFFEF7',
          light: '#F9F8F5',
          gold: '#D4AF37',
          darkGold: '#B8941E',
          text: '#1A1A1A',
          muted: '#6B7280',
          border: '#E5E7EB'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'serif']
      },
      boxShadow: {
        'gold': '0 4px 14px 0 rgba(212, 175, 55, 0.15)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }
    }
  },
  plugins: []
};