/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#5B5EF4', dark: '#4547E0', light: '#7B7EF8' },
        surface: { DEFAULT: '#111113', elevated: '#1A1A1E', border: '#27272A' },
      },
    },
  },
  plugins: [],
}
