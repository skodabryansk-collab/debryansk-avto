---
name: Mobile detail sticky bars
description: Placement constraints for the fixed call-to-action bars on car detail pages.
---

Mobile car-detail call-to-action bars should be rendered through a portal into `document.body` and avoid `backdrop-filter`. Keep the safe-area inset padding.

**Why:** The user reported that the bottom bar drifted into the middle of the page while scrolling on mobile. Detaching it from page ancestors avoids transformed or clipped containing blocks and reduces fixed-layer compositing risks in mobile Safari.

**How to apply:** Use this pattern for both new and used car detail CTAs. Verify the bar's bottom edge before and after scrolling on a narrow viewport.
