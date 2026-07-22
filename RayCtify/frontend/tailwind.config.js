/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#0A0A0C",
        ink: "#111115",
        "ink-soft": "#18181D",
        "ink-elevated": "#212128",
        parchment: "#F5F1E8",
        "parchment-muted": "#CFC8B8",
        gold: "#D4AF37",
        "gold-soft": "#C5A059",
        bronze: "#8A6A2C",
        rust: "#9C6949",
        "line-subtle": "rgba(212, 175, 55, 0.16)"
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        sans: ['"Inter"', "sans-serif"]
      },
      boxShadow: {
        luxe: "0 28px 70px rgba(0, 0, 0, 0.45)",
        panel: "0 10px 40px rgba(0, 0, 0, 0.35)",
        insetGold: "inset 0 1px 0 rgba(212, 175, 55, 0.18)"
      },
      backgroundImage: {
        canvas:
          "radial-gradient(circle at top, rgba(212,175,55,0.10), transparent 34%), linear-gradient(180deg, #141418 0%, #0A0A0C 52%, #060607 100%)",
        panel:
          "linear-gradient(140deg, rgba(212,175,55,0.12), rgba(255,255,255,0.03) 22%, rgba(17,17,21,0.98) 65%, rgba(10,10,12,0.98) 100%)"
      }
    }
  },
  plugins: []
};

