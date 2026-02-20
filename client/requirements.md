## Packages
recharts | Dashboard charts and analytics
date-fns | Date manipulation for attendance grids
lucide-react | Icons for UI (already in base but needed for imports)
framer-motion | Smooth transitions and animations
xlsx | For parsing Excel files on the client side before upload

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["'Cairo'", "sans-serif"], // Arabic friendly font
  display: ["'Tajawal'", "sans-serif"], // Arabic display font
}

The application requires RTL layout support.
Add `dir="rtl"` to the root HTML element or body for proper rendering.
