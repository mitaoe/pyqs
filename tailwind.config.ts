import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#18181b', // zinc-900
        secondary: '#27272a', // zinc-800
        accent: '#3f3f46',   // zinc-700
        content: '#d4d4d8',  // zinc-300
      },
    },
  },
  plugins: [],
};

export default config;
