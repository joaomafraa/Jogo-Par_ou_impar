/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6C5CE7",
        secondary: "#00D1FF",
        accent: "#00FFA3",
        dark: "#050816",
        dark2: "#15162C",
        surface: "#0B1223",
        surfaceElevated: "#101A31",
        border: "#26334F",
        success: "#00FFA3",
        danger: "#FF5478",
        warning: "#FFB84D",
        textMuted: "#94A3B8",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        body: ['"Manrope"', "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 209, 255, 0.35)",
        glow: "0 0 30px rgba(108, 92, 231, 0.4)",
        hud: "0 28px 80px rgba(4, 8, 20, 0.72)",
        danger: "0 0 28px rgba(255, 84, 120, 0.28)",
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" },
        },
        "grid-drift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(40px, 40px, 0)" },
        },
        "shake-soft": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "soft-pulse": "soft-pulse 2.4s ease-in-out infinite",
        "grid-drift": "grid-drift 16s linear infinite",
        "shake-soft": "shake-soft 0.5s ease-in-out both",
      },
    },
  },
  plugins: [],
};
