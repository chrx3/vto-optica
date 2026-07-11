/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta neutra, sin branding de cliente
        surface: {
          50: '#fafafa',
          900: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}