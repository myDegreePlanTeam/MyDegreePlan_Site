// One-off: renders public/og.png (the 1200x630 social preview). Re-run after changing the copy:
//   cd demo && node make-og.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0 }
  body { width: 1200px; height: 630px; background: #0f766e; color: #fff; font-family: 'Segoe UI', system-ui, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 0 90px; position: relative; overflow: hidden }
  .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 26px; font-weight: 700; color: #b7ece6; margin-bottom: 22px }
  h1 { font-size: 84px; line-height: 1.05; letter-spacing: -0.02em; max-width: 800px }
  p { font-size: 32px; margin-top: 28px; color: #d8f3ef; max-width: 720px; line-height: 1.35 }
  .grid { position: absolute; right: -40px; top: 70px; display: grid; grid-template-columns: repeat(2, 150px); gap: 22px; transform: rotate(-6deg) }
  .grid div { height: 150px; border-radius: 22px; background: rgba(255,255,255,.14); border: 2px solid rgba(255,255,255,.3) }
  .grid div:nth-child(2), .grid div:nth-child(3) { background: rgba(255,255,255,.26) }
</style>
<div class="grid"><div></div><div></div><div></div><div></div></div>
<div class="eyebrow">MyDegreePlan</div>
<h1>Map your whole degree.</h1>
<p>Private by design. Runs entirely on your own computer.</p>`

const out = fileURLToPath(new URL('../public/og.png', import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: out })
await browser.close()
console.log('wrote', out)
