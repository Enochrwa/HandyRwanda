/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        // Map to CSS variables defined in styles.css
        primary: "var(--color-primary)",
        "primary-light": "var(--color-primary-light)",
        accent: "var(--color-accent)",
        "accent-light": "var(--color-accent-light)",
        background: "var(--color-bg)",
        surface: "var(--color-surface)", // This is the card background
        text: "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        verified: "var(--color-verified)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        "card-foreground": "var(--color-card-foreground)",
        // Sidebar colors
        "sidebar-border": "var(--color-sidebar-border)",
        "sidebar-accent": "var(--color-sidebar-accent)",
        "sidebar-foreground": "var(--color-sidebar-foreground)",
        "sidebar-ring": "var(--color-sidebar-ring)",
        // Alias for consistency with existing usage
        card: "var(--color-surface)",
        border: "var(--color-border, var(--color-text-secondary))", // Fallback to text-secondary if not defined
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
