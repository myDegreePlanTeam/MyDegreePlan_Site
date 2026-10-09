// Pure helpers for the Windows desktop app's releases (the MyDegreePlan_Desktop repo): turn GitHub's release API
// payload into the small shape the pages render. No network here, so it is unit-testable (see tests/desktop.test.js).
//
// Each desktop release carries the installer twice: MyDegreePlan-Setup-<version>.exe (the name the in-app updater
// reads from latest.yml) and MyDegreePlan-Setup.exe (a fixed name, which is what the site links to).
import { toAsset } from './releases.js'

export const INSTALLER = 'MyDegreePlan-Setup.exe'

/**
 * @param {object[]} apiReleases  response of GET /repos/:owner/:repo/releases
 * @returns newest-first list; drafts, prereleases and releases without the installer are dropped
 */
export function normalizeDesktopReleases(apiReleases) {
  return (Array.isArray(apiReleases) ? apiReleases : [])
    .filter((r) => r && !r.draft && !r.prerelease)
    .map((r) => {
      const installer = toAsset((r.assets ?? []).find((a) => a.name === INSTALLER))
      if (!installer) return null
      return {
        tag: r.tag_name,
        version: String(r.tag_name).replace(/^v/, ''),
        publishedAt: r.published_at,
        notes: (r.body ?? '').trim(),
        htmlUrl: r.html_url,
        installer,
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
}
