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
        primary: '#121212',
        secondary: '#1e1e1e',
        accent: '#3f3f46',
        content: '#e0e0e0',
      },
    },
  },
  plugins: [],
};

export default config;
