import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f6f8fa',
        foreground: '#1f2328',
        surface: {
          50: '#f6f8fa',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d0d7de',
        },
        border: {
          subtle: '#e1e4e8',
          DEFAULT: '#d0d7de',
          hover: '#afb8c1',
        },
        brand: {
          50: '#ddf4ff',
          100: '#b6e3ff',
          400: '#54aeff',
          500: '#0969da',
          600: '#1a7f37',
          700: '#0550ae',
        },
      },
    },
  },
  plugins: [],
};

export default config;
