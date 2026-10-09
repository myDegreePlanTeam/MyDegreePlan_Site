// Pure helpers: turn GitHub's release API payload into the small shape the pages render.
// No network here, so it is unit-testable (see tests/releases.test.js).

const ZIP = /^MyDegreePlan-.+\.zip$/

function findAsset(assets, matcher) {
  return assets.find((a) => (matcher instanceof RegExp ? matcher.test(a.name) : a.name === matcher)) ?? null
}

export function toAsset(a) {
  if (!a) return null
  return {
    name: a.name,
    url: a.browser_download_url,
    size: a.size,
    // GitHub reports "sha256:<hex>" for assets uploaded recently; older ones have none.
    sha256: typeof a.digest === 'string' && a.digest.startsWith('sha256:') ? a.digest.slice(7) : null,
  }
}

/**
 * @param {object[]} apiReleases  response of GET /repos/:owner/:repo/releases
 * @param {Record<string, object>} manifests  parsed release.json keyed by tag (optional)
 * @returns newest-first list; drafts, prereleases and releases without a fresh-install zip are dropped
 */
export function normalizeReleases(apiReleases, manifests = {}) {
  return (Array.isArray(apiReleases) ? apiReleases : [])
    .filter((r) => r && !r.draft && !r.prerelease)
    .map((r) => {
      const assets = r.assets ?? []
      const zip = toAsset(findAsset(assets, ZIP))
      const manifest = manifests[r.tag_name] ?? null
      return {
        tag: r.tag_name,
        version: String(r.tag_name).replace(/^v/, ''),
        publishedAt: r.published_at,
        notes: (r.body ?? '').trim(),
        htmlUrl: r.html_url,
        zip,
        compose: toAsset(findAsset(assets, 'docker-compose.yml')),
        manifest: toAsset(findAsset(assets, 'release.json')),
        signature: toAsset(findAsset(assets, 'release.json.sig')),
        // make-release.mjs marks a release "required" by setting min_sequence to its own sequence.
        required: Boolean(manifest && manifest.min_sequence > 0 && manifest.min_sequence >= manifest.sequence),
        composeSha256: manifest?.compose?.sha256 ?? null,
      }
    })
    .filter((r) => r.zip)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
}

export function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`
}
