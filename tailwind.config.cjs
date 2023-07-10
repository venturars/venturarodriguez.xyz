/* eslint-disable @typescript-eslint/no-var-requires */
const { fontFamily } = require("tailwindcss/defaultTheme");
const { tailwindPreset } = require("kudu-ui-system/tailwindcss");

/** @type {import('tailwindcss').Config} */
export default {
  mode: "jit",
  content: ["./src/**/*.{astro,html,js,jsx,md,svelte,ts,tsx,vue}"],
  presets: [tailwindPreset],
  theme: {
    fontFamily: {
      ChakraPetch: ["Chakra Petch", ...fontFamily.sans],
    },
  },
  daisyui: {
    themes: [
      {
        kudupay: {
          primary: "#b8b8b8",
          secondary: "#b8b8b8",
          accent: "#b8b8b8",
          neutral: "#ebebeb",
          "base-100": "#ffffff",
          info: "#0000ff",
          success: "#008000",
          warning: "#a6a659",
          error: "#ff0000",
          "--rounded-btn": "0.5rem",
          "--border-btn": "1px",
          "--btn-focus-scale": "",
          "--animation-btn": "",
          "--btn-text-case": "",
          "--animation-input": "0.3s",
        },
      },
    ],
    styled: true,
    base: true,
    utils: true,
    logs: false,
    rtl: false,
    prefix: "",
  },
};
