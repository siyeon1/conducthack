/** @type {import('tailwindcss').Config} */
// shft brand system (brand kit v1.0): Shift Purple on warm off-white paper, Signal Coral for the
// human-gate moment, and a trust palette (verified / inferred / danger) that is core to the product.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["General Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        // Primary — Shift Purple
        brand: {
          50: "#F6E9FC",
          100: "#EFDAF8",
          200: "#E0B8F1",
          400: "#BC4AE3",
          500: "#9400D3",
          700: "#6D00A0",
          900: "#3B0059",
        },
        // Accent — Signal Coral (energy, highlights, the human-gate moment · use sparingly)
        coral: {
          tint: "#FBDDF6",
          400: "#ED80E9",
          600: "#C64DDB",
        },
        magenta: { 700: "#B5259F" },
        // Neutrals — warm violet-grey
        ink: {
          DEFAULT: "#0B0B10",
          soft: "#4A4652",
          mute: "#9A96A3",
        },
        line: "#E7E0EE",
        paper: {
          DEFAULT: "#F7F5FE",
          light: "#FCFBFF",
          dark: "#E6DBEE",
        },
        lavender: "#D3D3FF",
        // The one confident dark section (hero)
        hero: "#141019",
        // Signal — trust states (verified / inferred / tamper)
        verified: { DEFAULT: "#1C7C46", tint: "#E7F3CF" },
        inferred: { DEFAULT: "#B58318", tint: "#F4E6BF" },
        danger: { DEFAULT: "#D93A56", tint: "#FBD6DC" },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,11,16,.04), 0 18px 40px -24px rgba(11,11,16,.32)",
        pop: "0 12px 44px -8px rgba(11,11,16,.30)",
      },
      transitionTimingFunction: {
        brand: "cubic-bezier(.2,.7,.2,1)",
      },
      transitionDuration: {
        micro: "150ms",
        enter: "250ms",
      },
      letterSpacing: {
        display: "-0.05em",
        label: "0.14em",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseline: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s cubic-bezier(.2,.7,.2,1)",
        pulseline: "pulseline 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
