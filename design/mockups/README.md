Map Veto Button Concepts
========================

Files
- map-veto-button-dark.svg — High‑level concept for a floating Map Veto tile that visually matches the auth container in dark mode.

Notes
- The background uses a subtle vertical gradient and soft shadow to match the existing glassy panel look.
- The icon is a simple folded‑map motif with a soft highlight line.
- Text uses a semi‑bold weight with slightly increased letter spacing for legibility.

Implementation tips
- Keep radius at 12–14px to match other pills.
- Use a hover glow, not scale, to avoid layout shift.
- Provide a visible focus ring for keyboard users.
- Prefer `aria-label` or visible text on the tile at wider widths; at narrower widths, consider icon‑only with a tooltip.

