// The website names no institution. MyDegreePlan is not a university's product page, and the site's own rule is "no university names, logos
// or school colors". This keeps the pages, scripts and docs of this repo free of them. The patterns are assembled from pieces so that
// this file does not contain the words it forbids.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const FORBIDDEN = [
  new RegExp(['tenn', 'essee\\s+tech'].join(''), 'i'),
  new RegExp(['\\b', 'tt', 'u\\b'].join(''), 'i'),
  new RegExp(['tn', 'tech'].join(''), 'i'),
]

const SCAN = ['src', 'public', 'scripts', 'tests', 'demo', 'README.md', 'astro.config.mjs', 'package.json', '.github']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.astro'])
const SKIP_FILES = new Set(['package-lock.json'])
const TEXT = /\.(js|mjs|astro|css|html|json|md|yml|yaml|svg|txt)$/

function files(path, out = []) {
  const full = join(ROOT, path)
  if (!existsSync(full)) return out
  if (statSync(full).isFile()) { if (TEXT.test(path) && !SKIP_FILES.has(path)) out.push(full); return out }
  for (const name of readdirSync(full)) {
    const child = join(path, name)
    if (statSync(join(ROOT, child)).isDirectory()) { if (!SKIP_DIRS.has(name)) files(child, out) }
    else if (TEXT.test(name) && !SKIP_FILES.has(name)) out.push(join(ROOT, child))
  }
  return out
}

describe('the website names no institution', () => {
  it('no page, script, test or doc mentions a school', () => {
    const hits = []
    for (const file of SCAN.flatMap(path => files(path))) {
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (FORBIDDEN.some(pattern => pattern.test(line))) hits.push(`${relative(ROOT, file).split(sep).join('/')}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('the scan really covers the pages', () => {
    const scanned = SCAN.flatMap(path => files(path)).map(file => relative(ROOT, file).split(sep).join('/'))
    expect(scanned).toContain('src/pages/index.astro')
    expect(scanned).toContain('demo/capture.mjs')
  })

  it('the demo scanner still catches a school name on screen (it exists to stop one being published)', () => {
    const source = readFileSync(join(ROOT, 'demo', 'capture.mjs'), 'utf8')
    const line = source.split(/\r?\n/).find(l => l.startsWith('const FORBIDDEN'))
    const scanner = new Function(`${line}; return FORBIDDEN`)()
    expect(scanner.test('Welcome to ' + ['Tenn', 'essee Tech'].join(''))).toBe(true)
    expect(scanner.test('see the ' + ['TT', 'U'].join('') + ' catalog')).toBe(true)
    expect(scanner.test('Welcome to MyDegreePlan')).toBe(false)
  })
})
