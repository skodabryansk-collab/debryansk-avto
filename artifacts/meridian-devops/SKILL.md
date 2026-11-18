# Meridian DevOps Design System

## Source

This system is extracted from the selected **Swiss DevOps Lineup Poster**,
showing the MERIDIAN SHIPFEST '25 event. The source component is
`artifacts/mockup-sandbox/src/components/mockups/templates/SwissDevOpsLineupPoster-Fz4sU-/App.tsx`.
The package themes the standard design-system component families; it does not
copy or migrate the poster screen.

## Visual rules

- Use warm paper `#F4F1EA`, near-black ink `#0D0D0D`, and signal red `#E63312`.
  Keep red for the active state, headline emphasis, and small highlights.
- Build hierarchy with a 12-column grid, square panels, and thin rules. Use
  stronger ink rules for major boundaries and softer ink rules for subdivisions.
- Set display and body copy in **Inter Tight**. Use **IBM Plex Mono** for
  uppercase metadata, dates, identifiers, section labels, and command strings.
- Make display headings very large, heavy, tightly tracked, and closely led.
  Keep supporting copy compact and readable.
- Keep the visual language mostly monochrome; use paper and ink before adding
  another color. Do not add rounded card styling or decorative gradients.
- The source contains an inline red-square plus `MERIDIAN` text lockup, but no
  standalone logo asset. Do not invent or redraw a separate logo file.

## Content, layout, and motion

- Prefer short technical labels and operational copy over generic promotional
  language. Dates, session numbers, commands, and identifiers use monospaced
  metadata styling.
- Use generous display areas and compact metadata bands. The source uses
  3/6/3, 5/4/3, and 3/9 column divisions to create varied editorial layouts.
- When content changes, use the source's restrained transition: opacity with a
  short vertical move over 350 ms and the cubic-bezier curve
  `(0.22, 1, 0.36, 1)`. Active tab color changes use 200 ms; the small plus
  icon rotates 45 degrees over 300 ms.

## Typography fallback

The source uses loadable Google Fonts families Inter Tight and IBM Plex Mono.
Georgia is retained only as the required unused serif token role; the source
does not use a serif typeface.
