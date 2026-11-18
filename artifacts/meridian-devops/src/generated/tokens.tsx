/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F4F1EA",
      "foreground": "#0D0D0D",
      "border": "#AFADA8",
      "card": "#F4F1EA",
      "cardForeground": "#0D0D0D",
      "popover": "#F4F1EA",
      "popoverForeground": "#0D0D0D",
      "primary": "#E63312",
      "primaryForeground": "#F4F1EA",
      "secondary": "#0D0D0D",
      "secondaryForeground": "#F4F1EA",
      "muted": "#E9E6DE",
      "mutedForeground": "#5A5751",
      "accent": "#E9E6DE",
      "accentForeground": "#0D0D0D",
      "destructive": "#E63312",
      "destructiveForeground": "#F4F1EA",
      "input": "#AFADA8",
      "ring": "#E63312",
      "chart1": "#E63312",
      "chart2": "#0D0D0D",
      "chart3": "#625F5A",
      "chart4": "#AFADA8",
      "chart5": "#D8D4CC",
      "sidebar": "#101010",
      "sidebarForeground": "#F4F1EA",
      "sidebarBorder": "#333333",
      "sidebarPrimary": "#E63312",
      "sidebarPrimaryForeground": "#F4F1EA",
      "sidebarAccent": "#1F1F1F",
      "sidebarAccentForeground": "#F4F1EA",
      "sidebarRing": "#F4F1EA"
    },
    "dark": {
      "background": "#101010",
      "foreground": "#F4F1EA",
      "border": "#3A3A3A",
      "card": "#171717",
      "cardForeground": "#F4F1EA",
      "popover": "#171717",
      "popoverForeground": "#F4F1EA",
      "primary": "#E63312",
      "primaryForeground": "#F4F1EA",
      "secondary": "#2B2B2B",
      "secondaryForeground": "#F4F1EA",
      "muted": "#292929",
      "mutedForeground": "#B8B4AC",
      "accent": "#292929",
      "accentForeground": "#F4F1EA",
      "destructive": "#E63312",
      "destructiveForeground": "#F4F1EA",
      "input": "#474747",
      "ring": "#E63312",
      "chart1": "#E63312",
      "chart2": "#F4F1EA",
      "chart3": "#C4C0B8",
      "chart4": "#74716C",
      "chart5": "#4B4945",
      "sidebar": "#101010",
      "sidebarForeground": "#F4F1EA",
      "sidebarBorder": "#333333",
      "sidebarPrimary": "#E63312",
      "sidebarPrimaryForeground": "#F4F1EA",
      "sidebarAccent": "#1F1F1F",
      "sidebarAccentForeground": "#F4F1EA",
      "sidebarRing": "#F4F1EA"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter Tight",
      "Helvetica",
      "Arial",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "IBM Plex Mono",
      "SFMono-Regular",
      "monospace"
    ]
  },
  "radius": "0px",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
