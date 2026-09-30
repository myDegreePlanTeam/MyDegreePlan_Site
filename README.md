# MyDegreePlan_Site

Public landing page for MyDegreePlan: features, demos, and the newest download. Static [Astro](https://astro.build) site deployed to GitHub Pages.

```
npm install
npm run releases   # refresh src/data/releases.json from the Deploy repo's GitHub Releases
npm run dev        # http://localhost:4321
npm test           # release-data parser tests
npm run build      # -> dist/
```

## How it stays current

`.github/workflows/site.yml` rebuilds and deploys on: a `release-published` dispatch from the Deploy repo's Release workflow (not wired up yet), pushes to `main`, a daily cron, or manually. Every build re-reads the releases, so the download button always points at the newest published version. `src/data/releases.json` is generated; do not edit it by hand.

Demo videos are looked up in `public/demo/` (git-ignored, filled in by CI). Missing files render as placeholders.

## One-time setup

Repo Settings → Pages → Source: **GitHub Actions**.

## Branding rule

No university names, logos, or school colors on the site.
