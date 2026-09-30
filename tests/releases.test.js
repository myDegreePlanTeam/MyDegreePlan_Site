import { describe, it, expect } from 'vitest'
import { normalizeReleases, humanSize } from '../src/lib/releases.js'

const asset = (name, extra = {}) => ({ name, browser_download_url: `https://example.test/${name}`, size: 2_500_000, ...extra })
const rel = (tag, over = {}) => ({
  tag_name: tag, published_at: '2026-09-01T00:00:00Z', body: ' notes ', html_url: `https://example.test/${tag}`,
  draft: false, prerelease: false,
  assets: [asset(`MyDegreePlan-${tag.slice(1)}.zip`, { digest: 'sha256:abc' }), asset('docker-compose.yml'), asset('release.json'), asset('release.json.sig')],
  ...over,
})

describe('normalizeReleases', () => {
  it('returns [] for empty or non-array input', () => {
    expect(normalizeReleases([])).toEqual([])
    expect(normalizeReleases(null)).toEqual([])
  })

  it('drops drafts, prereleases and releases without a fresh-install zip', () => {
    const out = normalizeReleases([
      rel('v1.0.0'),
      rel('v1.1.0', { draft: true }),
      rel('v1.2.0', { prerelease: true }),
      rel('v1.3.0', { assets: [asset('docker-compose.yml')] }),
    ])
    expect(out.map((r) => r.version)).toEqual(['1.0.0'])
  })

  it('sorts newest first and strips the v prefix', () => {
    const out = normalizeReleases([
      rel('v1.0.0', { published_at: '2026-01-01T00:00:00Z' }),
      rel('v1.1.0', { published_at: '2026-03-01T00:00:00Z' }),
    ])
    expect(out.map((r) => r.version)).toEqual(['1.1.0', '1.0.0'])
  })

  it('reads the zip sha256 from the asset digest and tolerates a missing one', () => {
    const [r] = normalizeReleases([rel('v1.0.0')])
    expect(r.zip.sha256).toBe('abc')
    const [noDigest] = normalizeReleases([rel('v1.0.0', { assets: [asset('MyDegreePlan-1.0.0.zip')] })])
    expect(noDigest.zip.sha256).toBeNull()
    expect(noDigest.compose).toBeNull()
  })

  it('takes compose hash and required flag from release.json', () => {
    const manifests = { 'v1.0.0': { sequence: 10, min_sequence: 10, compose: { sha256: 'deadbeef' } } }
    const [r] = normalizeReleases([rel('v1.0.0')], manifests)
    expect(r.required).toBe(true)
    expect(r.composeSha256).toBe('deadbeef')
  })

  it('does not call a release required when min_sequence is older or absent', () => {
    const older = { 'v1.0.0': { sequence: 10, min_sequence: 5, compose: { sha256: 'x' } } }
    expect(normalizeReleases([rel('v1.0.0')], older)[0].required).toBe(false)
    expect(normalizeReleases([rel('v1.0.0')], { 'v1.0.0': { sequence: 10, min_sequence: 0 } })[0].required).toBe(false)
    expect(normalizeReleases([rel('v1.0.0')])[0].required).toBe(false)
  })
})

describe('humanSize', () => {
  it('formats MB and KB', () => {
    expect(humanSize(2_500_000)).toBe('2.5 MB')
    expect(humanSize(1500)).toBe('2 KB')
    expect(humanSize(undefined)).toBe('')
  })
})
