import type { Config } from "tailwindcss";

// Palette is deliberately institutional: a state licensing tool has to read as
// a system of record, not a consumer app. Navy for agency surfaces, amber for
// clocks running, red reserved for enforcement.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#101828",
          soft: "#475467",
          faint: "#98a2b3",
        },
        gov: {
          50: "#eef2f9",
          100: "#d8e1f1",
          200: "#b3c5e3",
          300: "#84a1cf",
          400: "#557cb8",
          500: "#3760a0",
          600: "#2a4b81",
          700: "#233d68",
          800: "#1d3253",
          900: "#162741",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
