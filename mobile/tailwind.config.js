// mobile/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B5E3B',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#E8A020',
          light: '#FFF8EE',
        },
        background: '#F7F5F0',
        card: '#FFFFFF',
        foreground: '#1A1A1A',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#6B6B6B',
        },
        border: '#E2E8F0',
        destructive: '#C0392B',
        success: '#2E7D4F',
      },
    },
  },
  plugins: [],
}
