// Regenerates src/data/releases.json from the Deploy repo's GitHub Releases.
// Runs before every build. In CI GITHUB_TOKEN raises the rate limit; locally it is optional.
// If GitHub is unreachable the existing file is kept, so a build never fails on a network blip.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizeReleases } from '../src/lib/releases.js'

const REPO = process.env.DEPLOY_REPO || 'myDegreePlanTeam/MyDegreePlan_Deploy'
const OUT = fileURLToPath(new URL('../src/data/releases.json', import.meta.url))
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'mydegreeplan-site' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function getJson(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

try {
  const api = await getJson(`https://api.github.com/repos/${REPO}/releases?per_page=30`)
  const manifests = {}
  for (const r of api) {
    const m = (r.assets ?? []).find((a) => a.name === 'release.json')
    if (!m || r.draft) continue
    try { manifests[r.tag_name] = await getJson(m.browser_download_url) } catch (e) { console.warn(`no manifest for ${r.tag_name}: ${e.message}`) }
  }
  const releases = normalizeReleases(api, manifests)
  writeFileSync(OUT, JSON.stringify({ repo: REPO, generatedAt: new Date().toISOString(), releases }, null, 2) + '\n')
  console.log(`releases.json: ${releases.length} release(s), latest ${releases[0]?.version ?? 'none'}`)
} catch (e) {
  console.warn(`Could not refresh releases (${e.message}); keeping the existing src/data/releases.json`)
  try { readFileSync(OUT) } catch { process.exitCode = 1 }
}
