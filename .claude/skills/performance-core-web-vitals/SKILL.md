---
name: performance-core-web-vitals
description: Performance optimization guidance centered on Core Web Vitals and fast SaaS UX for Dental SMS pages and app surfaces.
---

# Performance Core Web Vitals

Use this skill for frontend and runtime performance work.

Targets:
- LCP under 2.5 seconds.
- INP under 200 milliseconds.
- CLS under 0.1.

Implementation rules:
- Prioritize above-the-fold rendering on landing pages.
- Defer non-critical JavaScript and third-party scripts.
- Use optimized images, fonts, and caching.
- Limit layout shift from late-loading components.

Engineering practices:
- Measure before and after each change.
- Guard against waterfall data fetching.
- Keep bundle size predictable and trimmed.

Dental SMS context:
- Fast page loads improve trust and conversion for busy office staff.
- Keep scheduling and trial flows responsive on mobile and desktop.
