import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      borderRadius: {
        none: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px"
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        6: "24px",
        8: "32px",
        10: "40px"
      },
      fontSize: {
        xs: ["12px", "1.4"],
        sm: ["14px", "1.5"],
        base: ["16px", "1.5"],
        lg: ["18px", "1.5"],
        xl: ["20px", "1.4"],
        "2xl": ["24px", "1.3"]
      }
    }
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      // Provide a light 'nord' theme override so we can make the
      // UI slightly darker in light mode (improves contrast and readability).
      // We darken the background/base colors a bit and lighten button text
      // (primary/secondary/accent content) so buttons read more clearly.
      {
        nord: {
          "color-scheme": "light",
          primary: "#5E81AC",
          "primary-content": "#FFFFFF",
          secondary: "#88C0D0",
          "secondary-content": "#FFFFFF",
          accent: "#B48EAD",
          "accent-content": "#FFFFFF",
          neutral: "#E7EDF6",
          "neutral-content": "#2E3440",
          "base-100": "#E5E9F0",
          "base-200": "#D8DEE9",
          "base-300": "#C6D0DF",
          "base-content": "#2E3440",
          info: "#8FBCBB",
          success: "#A3BE8C",
          warning: "#EBCB8B",
          error: "#F87171",
          "error-content": "#2E3440",
          "--rounded-box": "12px",
          "--rounded-btn": "8px",
          "--rounded-badge": "9999px",
          "--btn-text-case": "none",
          "--btn-focus-scale": "0.98",
          "--animation-btn": "0.15s",
          "--animation-input": "0.15s"
        }
      },
      {
        "nord-dark": {
          "color-scheme": "dark",
          primary: "#81A1C1",
          "primary-content": "#ECEFF4",
          secondary: "#88C0D0",
          "secondary-content": "#2E3440",
          accent: "#B48EAD",
          "accent-content": "#ECEFF4",
          neutral: "#3B4252",
          "neutral-content": "#E5E9F0",
          "base-100": "#2E3440",
          "base-200": "#3B4252",
          "base-300": "#434C5E",
          "base-content": "#E5E9F0",
          info: "#88C0D0",
          success: "#A3BE8C",
          warning: "#EBCB8B",
          error: "#BF616A",
          "--rounded-box": "12px",
          "--rounded-btn": "8px",
          "--rounded-badge": "9999px",
          "--btn-text-case": "none",
          "--btn-focus-scale": "0.98",
          "--animation-btn": "0.15s",
          "--animation-input": "0.15s"
        }
      }
    ]
  }
};

export default config;
