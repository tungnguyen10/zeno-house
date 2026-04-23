/// <reference types="node" />
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/components/**/*.{vue,js,ts}",
    "./app/layouts/**/*.vue",
    "./app/pages/**/*.vue",
    "./app/plugins/**/*.{js,ts}",
    "./app/app.vue",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand ──────────────────────────────
        theme: {
          DEFAULT: "#0B59DB", // --theme-color / --primary-color
          purple: "#6653E8", // --theme-color2
        },
        brand: "#79F4E4", // --brand-color (teal accent)

        // ── Text ───────────────────────────────
        title: "#0B1422", // --title-color
        body: "#6E7070", // --body-color

        // ── Backgrounds ────────────────────────
        smoke: {
          DEFAULT: "#F2F5FA", // --smoke-color  (section bg)
          blue: "#EEF1FF", // --smoke-color3 (tint xanh nhạt)
          card: "#F4F6F8", // --smoke-color4 (card bg)
        },

        // ── Borders ────────────────────────────
        border: {
          DEFAULT: "#D5D7DA", // --th-border-color
          light: "#E1E4E5", // --gray-color / --light-color
        },

        // ── Status ─────────────────────────────
        success: "#28A745", // --success-color
        error: "#DC3545", // --error-color
        warning: "#FFB539", // --yellow-color

        // ── Dark sections / Footer ─────────────
        dark: {
          DEFAULT: "#1A1B1D", // --dark-bg-color
          card: "#242528", // --light-bg-color
          nav: "#001C49",    // --light-blue-color (dark header/nav)
          deep: "#0a0f1e",   // testimonials / hero dark section
        },
      },
      fontFamily: {
        inter: ["Inter", "ui-sans-serif", "system-ui"],
      },
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
      },
    },
  },
  plugins: [],
} satisfies Config;
