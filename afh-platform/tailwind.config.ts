import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12181f",
          soft: "#4a5763",
        },
        brand: {
          50: "#eef6f4",
          100: "#d3e9e4",
          200: "#a8d3ca",
          300: "#74b8ab",
          400: "#469a8b",
          500: "#2b7f70",
          600: "#1f6459",
          700: "#1a5049",
          800: "#17403b",
          900: "#123330",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
