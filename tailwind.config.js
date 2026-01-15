/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#8B5CF6', // Violet
        'brand-secondary': '#F59E0B', // Amber
        'brand-bg': '#FFF7ED', // Orange-50 (Cream)
        'brand-surface': '#FFFFFF',
        'brand-accent': '#EC4899', // Pink
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
