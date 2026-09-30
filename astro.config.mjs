import { defineConfig } from 'astro/config'

// SITE_URL / SITE_BASE are set by the Pages workflow. Locally the site is served from "/".
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'ignore',
})
