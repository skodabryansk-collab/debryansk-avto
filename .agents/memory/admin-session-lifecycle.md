---
name: Admin and manager session lifecycle
description: Session renewal behavior shared by the admin panel and manager quote portal.
---

# Admin and manager session lifecycle

Admin and manager access tokens last 30 days and renew during authenticated activity when they enter the final seven days, with a 90-day maximum lifetime from the original sign-in.

Both client API paths must store the renewed `X-Session-Token` response header. A 401 must clear the matching local token and route the user to the appropriate login screen rather than leaving the interface looking active but unusable.

**Why:** The admin JWT previously expired after 24 hours, while the browser still treated any saved token as proof of a live session. Requests then failed silently behind an otherwise loaded interface.

**How to apply:** Keep the lifetime, renewal-header handling, and 401 behavior consistent in admin and manager authentication middleware and clients.
