// Regenerates the site's release data from GitHub Releases. Runs before every build. In CI GITHUB_TOKEN raises
// the rate limit; locally it is optional.
//   src/data/releases.json  the Docker install (MyDegreePlan_Deploy)
//   src/data/desktop.json   the Windows desktop app (MyDegreePlan_Desktop)
// Each is refreshed on its own: if GitHub is unreachable the existing file is kept, so a build never fails on a network blip.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizeReleases } from '../src/lib/releases.js'
import { normalizeDesktopReleases } from '../src/lib/desktop.js'

const REPO = process.env.DEPLOY_REPO || 'myDegreePlanTeam/MyDegreePlan_Deploy'
const DESKTOP_REPO = process.env.DESKTOP_REPO || 'myDegreePlanTeam/MyDegreePlan_Desktop'
const out = (name) => fileURLToPath(new URL(`../src/data/${name}`, import.meta.url))
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'mydegreeplan-site' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

async function getJson(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

function keepExisting(file, e) {
  console.warn(`Could not refresh ${file} (${e.message}); keeping the existing file`)
  try { readFileSync(out(file)) } catch { process.exitCode = 1 }
}

async function refreshDocker() {
  const api = await getJson(`https://api.github.com/repos/${REPO}/releases?per_page=30`)
  const manifests = {}
  for (const r of api) {
    const m = (r.assets ?? []).find((a) => a.name === 'release.json')
    if (!m || r.draft) continue
    try { manifests[r.tag_name] = await getJson(m.browser_download_url) } catch (e) { console.warn(`no manifest for ${r.tag_name}: ${e.message}`) }
  }
  const releases = normalizeReleases(api, manifests)
  writeFileSync(out('releases.json'), JSON.stringify({ repo: REPO, generatedAt: new Date().toISOString(), releases }, null, 2) + '\n')
  console.log(`releases.json: ${releases.length} release(s), latest ${releases[0]?.version ?? 'none'}`)
}

async function refreshDesktop() {
  const api = await getJson(`https://api.github.com/repos/${DESKTOP_REPO}/releases?per_page=30`)
  const releases = normalizeDesktopReleases(api)
  writeFileSync(out('desktop.json'), JSON.stringify({ repo: DESKTOP_REPO, generatedAt: new Date().toISOString(), releases }, null, 2) + '\n')
  console.log(`desktop.json: ${releases.length} release(s), latest ${releases[0]?.version ?? 'none'}`)
}

try { await refreshDocker() } catch (e) { keepExisting('releases.json', e) }
try { await refreshDesktop() } catch (e) { keepExisting('desktop.json', e) }
