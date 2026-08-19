---
name: VPS SSH transient refusal
description: Deploying while the Timeweb VPS intermittently refuses new SSH connections.
---

When the Timeweb VPS accepts one SSH command but refuses the next, avoid a multi-connection deploy sequence.

**Why:** A standard deploy can transfer the API but fail before scripts, admin assets, and the PM2 restart when port 22 begins refusing fresh connections.

**How to apply:** Wait for SSH to recover, establish one SSH ControlMaster session, stream a staged tar bundle through it, install atomically, restart PM2, then verify both localhost and the public domain.