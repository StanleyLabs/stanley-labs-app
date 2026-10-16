/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				// Stanley Labs core palette
				ink: "#0B0D10",
				graphite: "#151A21",
				fog: "#C7CEDA",
				paper: "#F2F4F7",
				electric: "#2D6BFF",
				signal: "#FF3B3B",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
				display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
				mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
			},
			boxShadow: {
				"glow-electric": "0 0 20px rgba(45, 107, 255, 0.3)",
			},
			fontSize: {
				"2xs": ["0.6875rem", { lineHeight: "1rem" }],
			},
			animation: {
				"fade-in": "fadeIn 150ms ease-out",
				"slide-up": "slideUp 200ms ease-out",
				"scale-in": "scaleIn 150ms ease-out",
			},
			keyframes: {
				fadeIn: {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				slideUp: {
					from: { opacity: "0", transform: "translateY(8px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				scaleIn: {
					from: { opacity: "0", transform: "scale(0.95)" },
					to: { opacity: "1", transform: "scale(1)" },
				},
			},
		},
	},
	plugins: [],
}
