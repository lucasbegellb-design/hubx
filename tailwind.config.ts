import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Tokens de design XTIM (cf. cahier des charges §6). Les valeurs sont dans src/index.css.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
    },
    // Échelle typographique imposée : 12 / 13 / 14 / 16 / 20 / 24
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["13px", { lineHeight: "18px" }],
      base: ["14px", { lineHeight: "20px" }],
      lg: ["16px", { lineHeight: "22px" }],
      xl: ["20px", { lineHeight: "26px" }],
      "2xl": ["24px", { lineHeight: "30px" }],
    },
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        surface: token("card"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        urgent: token("urgent"),
        retard: token("retard"),
        fait: token("fait"),
        postit: {
          sable: token("postit-sable"),
          sauge: token("postit-sauge"),
          ciel: token("postit-ciel"),
          lavande: token("postit-lavande"),
        },
      },
      borderRadius: {
        lg: "var(--radius)", // panneaux : 8 px
        md: "calc(var(--radius) - 2px)", // contrôles : 6 px
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "slide-in-right": { from: { transform: "translateX(16px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        "check-pop": { "0%": { transform: "scale(1)" }, "50%": { transform: "scale(1.15)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "slide-in-right": "slide-in-right 160ms ease-out",
        "check-pop": "check-pop 180ms ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
