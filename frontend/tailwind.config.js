/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark background
        background: '#0a0a0f',
        'background-secondary': '#12121a',
        'background-tertiary': '#1a1a24',
        // Accent colors
        amber: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fbbf24',
        },
        teal: {
          DEFAULT: '#14b8a6',
          light: '#2dd4bf',
        },
        // Text colors
        'text-primary': '#f5f5f5',
        'text-secondary': '#a1a1aa',
        'text-muted': '#71717a',
        // Border colors
        'border-subtle': '#27272a',
        'border-medium': '#3f3f46',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'typing': 'typing 1s ease-in-out infinite',
      },
      keyframes: {
        typing: {
          '0%, 100%': { opacity: 0.3 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
