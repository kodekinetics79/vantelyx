/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#f8fafc',
        brand: {
          50: '#eef8ff',
          100: '#d9efff',
          500: '#2477ff',
          600: '#145ee4',
          700: '#114ab8',
          900: '#0d245c'
        },
        emeraldsoft: '#eafbf4',
        amberlight: '#fff7df',
        violetsoft: '#f3edff'
      },
      boxShadow: {
        soft: '0 18px 60px rgba(15, 23, 42, 0.08)',
        glow: '0 18px 48px rgba(36, 119, 255, 0.22)'
      }
    }
  },
  plugins: []
};
