/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom colors for HTTP methods
        method: {
          get: '#22c55e',
          post: '#eab308',
          put: '#3b82f6',
          patch: '#a855f7',
          delete: '#ef4444',
          head: '#6b7280',
          options: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
