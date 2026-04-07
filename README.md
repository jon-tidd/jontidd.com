# jontidd.com

Personal project portfolio for Jon Tidd — a place to park and showcase projects, seen by friends, family, and professionals.

## Aspiration

A polished, modern personal site that conveys: software engineer, father, builder of meaningful tools at the intersection of technology and classical wisdom. Not a resume — a living portfolio that grows as new projects launch. Should feel premium, interesting, and slightly unexpected. The kind of site that makes someone want to click around.

## Current Concept

Single-page dark-themed landing (`index.html`) with:

- **Dark ambient aesthetic** — near-black background with floating gradient orbs and subtle grid overlay
- **Frosted glass navigation** — sticky nav with backdrop blur and green "Available" status pulse
- **Shimmer gradient headline** — "I build tools for human flourishing" with animated color sweep
- **3D project cards** — glassmorphism cards with CSS perspective tilt on hover and cursor-following glow effect. Two projects: Bedtime Virtues (LIVE) and The Rudyard Collection (COMING SOON)
- **Featured project spotlight** — deeper showcase of Bedtime Virtues with hero image
- **About section** — short bio with highlighted keywords
- **Connect grid** — GitHub, LinkedIn, Email, Project links
- **Scroll-reveal animations** — IntersectionObserver-based fade-in on scroll
- **Fully responsive** — mobile, tablet, desktop
- **Zero dependencies** — pure HTML/CSS/JS, no build step

## Recommended Architecture

**For v1 (now):** Static HTML hosted on Vercel or Cloudflare Pages. Zero build step, instant deploys, free tier. The current `index.html` concept is ready to ship as-is.

**For v2 (when you have 3+ projects):** Migrate to a lightweight framework:
- **Astro** (recommended) — static-first, zero JS by default, component islands for interactive bits. Perfect for a portfolio that's mostly content with a few interactive elements.
- Keep the same visual language and interactions
- Add individual project detail pages
- Add a blog/writing section if desired

**Hosting:** Vercel (already familiar from VirtueForge) or Cloudflare Pages (faster edge network, also free). Either works — Vercel is simpler since you already have it set up.

**Domain:** Point jontidd.com DNS to whichever host. Add both `jontidd.com` and `www.jontidd.com`.

## Project Structure

```
jontidd.com/
  index.html          # Main landing page (current concept)
  images/
    hero-firelight.png # Bedtime Virtues featured image
  README.md           # This file
```

## Related Projects

- [Bedtime Virtues](https://virtueforge.vercel.app) — AI bedtime stories + curated classics mapped to cardinal virtues
- The Rudyard Collection — curated library of public domain character literature (coming soon)
