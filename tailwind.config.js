/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0b",
        bone: "#f4f4f2",
        ash: "#8a8a8a",
        // Studio (private area) accent.
        champagne: "#c8b697",
        graphite: "#17171a",
        // Electric blue — used only as a minimal accent.
        electric: "#1f6bff",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wider2: "0.22em",
        wider3: "0.34em",
      },
      transitionTimingFunction: {
        cine: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
