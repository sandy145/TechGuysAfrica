import type { Config } from "tailwindcss";

// Palette taken from the national flag: red, gold, green, and the black star.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#111418", soft: "#4b5560" },
        flag: {
          red: "#CE1126",
          gold: "#FCD116",
          green: "#006B3F",
          star: "#000000",
        },
        forest: {
          50: "#ecf7f1",
          100: "#d0ecdc",
          600: "#00804b",
          700: "#006B3F",
          800: "#005533",
          900: "#003d25",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
