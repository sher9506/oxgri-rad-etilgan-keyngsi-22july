import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '0 0% 100%',
        foreground: '222.2 84% 4.9%',
        card: '0 0% 100%',
        'card-foreground': '222.2 84% 4.9%',
        popover: '0 0% 100%',
        'popover-foreground': '222.2 84% 4.9%',
        primary: '221 83% 53%',
        'primary-foreground': '210 40% 98%',
        secondary: '210 40% 96.1%',
        'secondary-foreground': '222.2 47.4% 11.2%',
        muted: '210 40% 96.1%',
        'muted-foreground': '215.4 16.3% 46.9%',
        accent: '43 96% 56%',
        'accent-foreground': '222.2 47.4% 11.2%',
        destructive: '0 84.2% 60.2%',
        'destructive-foreground': '210 40% 98%',
        border: '214.3 31.8% 91.4%',
        input: '214.3 31.8% 91.4%',
        ring: '221 83% 53%',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
