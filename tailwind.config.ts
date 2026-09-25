import type { Config } from "tailwindcss"
import typography from "@tailwindcss/typography"

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "hsl(var(--primary))",
                secondary: "hsl(var(--secondary))",
                accent: "hsl(var(--accent))",
                content: "hsl(var(--content))",
                brand: "hsl(var(--brand))",
            },
        },
    },
    plugins: [typography],
}

export default config
