// mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B5E3B',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#E8A020',
          foreground: '#FFFFFF',
          light: '#FFF8EE',
        },
        secondary: {
          DEFAULT: '#64748B',
          foreground: '#FFFFFF',
        },
        background: '#F7F5F0',
        card: '#FFFFFF',
        foreground: '#1A1A1A',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#6B6B6B',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        destructive: {
          DEFAULT: '#C0392B',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#2E7D4F',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#D97706',
          foreground: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
