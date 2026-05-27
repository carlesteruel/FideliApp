/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f3f0ff",
          100: "#e9e3ff",
          200: "#d6cbff",
          300: "#b8a4ff",
          400: "#9470ff",
          500: "#6C3DF4", // Color principal
          600: "#5a2de0",
          700: "#4a1fcc",
          800: "#3d1aa8",
          900: "#321788",
        },
        secondary: {
          500: "#F4A33D", // Naranja cálido
        },
        success: {
          500: "#22c55e",
        },
        danger: {
          500: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
