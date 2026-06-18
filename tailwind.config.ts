/**
 * tailwind.config.ts
 *
 * Configuração Tailwind CSS para o gestec · help desk.
 *
 * Tema:
 * - Estilo shadcn/ui: Luma
 * - Font: Geist (sans) + Geist Mono (mono)
 * - Cores base: branco (#ffffff), verde Tecnoplanta (#16a34a), preto (#000000)
 * - Variáveis CSS usadas pelo shadcn/ui (definidas em globals.css)
 */

import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './electron/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', ...fontFamily.sans],
        mono: ['Geist Mono', ...fontFamily.mono],
      },
      colors: {
        // Tokens de design — mapeados para variáveis CSS do shadcn/ui Luma
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Cores de SLA (usadas em badges e indicadores)
        sla: {
          ok: '#16a34a',      // verde Tecnoplanta
          warning: '#d97706', // âmbar
          overdue: '#dc2626', // vermelho
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        // Animações de accordion (usadas por componentes Radix).
        // As utilidades animate-in / fade-in / slide-in-from-* vêm do
        // plugin tailwindcss-animate e NÃO devem ser redefinidas aqui.
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
