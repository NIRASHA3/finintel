import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#001524",
          teal: "#15616D",
          orange: "#FF7D00",
          surface: "#F8F9FA",
          error: "#BA1A1A",
          "navy-container": "#071D2D",
          "teal-container": "#A8EAF8",
          "orange-container": "#FFDBC8",
          "surface-container": "#EDEEEF",
          "surface-low": "#F3F4F5",
          "surface-high": "#E7E8E9",
          "surface-highest": "#E1E3E4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      maxWidth: {
        container: "1440px",
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        badge: "4px",
      },
      boxShadow: {
        card: "0px 1px 3px rgba(0, 0, 0, 0.05), 0px 10px 15px -5px rgba(0, 0, 0, 0.03)",
        modal: "0px 10px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)",
        dropdown: "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
