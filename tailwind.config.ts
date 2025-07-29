import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Disable dark mode to prevent system dark mode from interfering
  darkMode: 'class', // Only enable dark mode with explicit class, not system preference
  theme: {
    extend: {
      colors: {
        // Ensure we have explicit color definitions
        background: '#ffffff',
        foreground: '#171717',
      },
    },
  },
  plugins: [],
}

export default config