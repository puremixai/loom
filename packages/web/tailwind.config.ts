import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core
        'vercel-black': '#171717',
        // Vercel gray scale — explicit names to avoid collision with Tailwind's built-in grays
        ink: {
          50: '#fafafa',
          100: '#ebebeb',
          400: '#808080',
          500: '#666666',
          600: '#4d4d4d',
          900: '#171717',
        },
        // Workflow accents
        'ship-red': '#ff5b4f',
        'preview-pink': '#de1d8d',
        'develop-blue': '#0a72ef',
        // Interactive
        'link-blue': '#0072f5',
        'focus-blue': 'hsla(212, 100%, 48%, 1)',
        // Status badge surfaces
        'badge-blue-bg': '#ebf5ff',
        'badge-blue-text': '#0068d6',
        'badge-red-bg': '#fff0ef',
        'badge-red-text': '#c72318',
        'badge-green-bg': '#edfbf3',
        'badge-green-text': '#006827',
        'badge-yellow-bg': '#fffbeb',
        'badge-yellow-text': '#855500',
      },
      fontFamily: {
        sans: ['Geist', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Pairs (size, { lineHeight, letterSpacing }) matching DESIGN.md hierarchy
        'display': ['3rem', { lineHeight: '1.0', letterSpacing: '-0.05em', fontWeight: '600' }],
        'section': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.048em', fontWeight: '600' }],
        'subheading': ['2rem', { lineHeight: '1.25', letterSpacing: '-0.04em' }],
        'card-title': ['1.5rem', { lineHeight: '1.33', letterSpacing: '-0.04em', fontWeight: '600' }],
        'body-lg': ['1.25rem', { lineHeight: '1.8' }],
        'body': ['1.125rem', { lineHeight: '1.56' }],
        'body-sm': ['1rem', { lineHeight: '1.5' }],
        'control': ['0.875rem', { lineHeight: '1.43', fontWeight: '500' }],
        'caption': ['0.75rem', { lineHeight: '1.33' }],
        'mono-sm': ['0.75rem', { lineHeight: '1', fontWeight: '500' }],
      },
      letterSpacing: {
        display: '-0.05em',
        heading: '-0.04em',
        emphasis: '-0.02em',
      },
      boxShadow: {
        border: '0 0 0 1px rgba(0, 0, 0, 0.08)',
        'ring-light': '0 0 0 1px #ebebeb',
        card: '0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 2px rgba(0, 0, 0, 0.04)',
        'card-elevated':
          '0 0 0 1px rgba(0, 0, 0, 0.08), 0 2px 2px rgba(0, 0, 0, 0.04), 0 8px 8px -8px rgba(0, 0, 0, 0.04), inset 0 0 0 1px #fafafa',
        'focus-ring': '0 0 0 2px hsla(212, 100%, 48%, 1)',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        'pill-sm': '64px',
        pill: '100px',
        full: '9999px',
      },
      spacing: {
        '18': '4.5rem',   // 72px gap commonly needed
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
} satisfies Config;
