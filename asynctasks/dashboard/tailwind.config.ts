import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                card: "#121212",
                "card-border": "#282828",
                accent: "#3b82f6", //AutoDeploy Blue
            },
        },
    },
    plugins: [],
};
export default config;