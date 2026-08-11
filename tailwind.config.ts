import type { Config } from 'tailwindcss';

/**
 * Faction colours are design tokens, not ad-hoc hexes, so that "blue means
 * Resistance / green means Enlightened / amber means Crossfaction" stays
 * consistent everywhere including charts and badges.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        faction: {
          blue: '#1d4ed8',
          'blue-soft': '#dbeafe',
          green: '#15803d',
          'green-soft': '#dcfce7',
          // Crossfaction gets its own token deliberately - rendering it as a
          // blue/green gradient everywhere made small UI unreadable.
          crossfaction: '#b45309',
          'crossfaction-soft': '#fef3c7',
        },
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          faint: '#5b6b80',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
