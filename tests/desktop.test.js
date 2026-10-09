import { describe, it, expect } from 'vitest'
import { normalizeDesktopReleases, INSTALLER } from '../src/lib/desktop.js'

const asset = (name, extra = {}) => ({ name, browser_download_url: `https://example.test/${name}`, size: 112_600_510, ...extra })
const rel = (tag, over = {}) => ({
  tag_name: tag, published_at: '2026-10-01T00:00:00Z', body: ' Fixed AP credit. ', html_url: `https://example.test/${tag}`,
  draft: false, prerelease: false,
  assets: [
    asset(`MyDegreePlan-Setup-${tag.slice(1)}.exe`),
    asset(`MyDegreePlan-Setup-${tag.slice(1)}.exe.blockmap`),
    asset(INSTALLER, { digest: 'sha256:abc123' }),
    asset('latest.yml'),
  ],
  ...over,
})

describe('normalizeDesktopReleases', () => {
  it('returns [] for empty or non-array input', () => {
    expect(normalizeDesktopReleases([])).toEqual([])
    expect(normalizeDesktopReleases(null)).toEqual([])
    expect(normalizeDesktopReleases(undefined)).toEqual([])
  })

  it('links the fixed-name installer, not the versioned one the updater reads', () => {
    const [r] = normalizeDesktopReleases([rel('v0.2.0')])
    expect(r.installer.name).toBe('MyDegreePlan-Setup.exe')
    expect(r.installer.url).toBe('https://example.test/MyDegreePlan-Setup.exe')
    expect(r.installer.size).toBe(112_600_510)
    expect(r.installer.sha256).toBe('abc123')
  })

  it('strips the v prefix, trims the notes and tolerates a missing digest or body', () => {
    const [r] = normalizeDesktopReleases([rel('v0.2.0')])
    expect(r.version).toBe('0.2.0')
    expect(r.notes).toBe('Fixed AP credit.')
    const [bare] = normalizeDesktopReleases([rel('v0.3.0', { body: null, assets: [asset(INSTALLER)] })])
    expect(bare.notes).toBe('')
    expect(bare.installer.sha256).toBeNull()
  })

  it('drops drafts, prereleases and releases without the installer', () => {
    const out = normalizeDesktopReleases([
      rel('v1.0.0'),
      rel('v1.1.0', { draft: true }),
      rel('v1.2.0', { prerelease: true }),
      rel('v1.3.0', { assets: [asset('MyDegreePlan-Setup-1.3.0.exe'), asset('latest.yml')] }),
    ])
    expect(out.map((r) => r.version)).toEqual(['1.0.0'])
  })

  it('sorts newest first', () => {
    const out = normalizeDesktopReleases([
      rel('v1.0.0', { published_at: '2026-01-01T00:00:00Z' }),
      rel('v1.1.0', { published_at: '2026-03-01T00:00:00Z' }),
    ])
    expect(out.map((r) => r.version)).toEqual(['1.1.0', '1.0.0'])
  })
})
