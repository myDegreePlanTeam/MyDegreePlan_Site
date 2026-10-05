// Records the landing-page demo videos and posters against a running MyDegreePlan stack.
//
//   BASE_URL=http://127.0.0.1:8080 OUT_DIR=out node capture.mjs
//
// Every demo signs up its own throwaway student on the stack it is pointed at, so run it against
// a disposable stack (CI does), never someone's real install. Two rules protect the public site:
//   1. config.js is rewritten so the app runs with brand: 'neutral' (no school named on screen).
//   2. After every step the visible page is scanned for school names; one match aborts the run
//      and nothing is published.
import { chromium } from 'playwright'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080'
const OUT = process.env.OUT_DIR || 'out'
const SIZE = { width: 1280, height: 720 }
const PASSWORD = 'DemoPass!2026'
const FORBIDDEN = /tennessee|tntech|\bTTU\b|texas tech/i
// Fixed, readable names show in the sidebar. DEMO_UNIQUE=1 adds a suffix for re-runs against a stack that
// already has them; CI always starts from an empty database, so it does not need it.
const suffix = process.env.DEMO_UNIQUE ? `.${Date.now().toString(36)}` : ''
const STUDENTS = { 'build-plan': 'alex.rivera', 'prior-credit': 'jordan.lee' }

mkdirSync(OUT, { recursive: true })

const heading = (page, name) => page.getByRole('heading', { name, exact: true })
const pause = (page, ms = 900) => page.waitForTimeout(ms)

async function assertClean(page, where) {
  const seen = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input,textarea')].map((e) => e.placeholder || '').join(' ')
    return `${document.body.innerText} ${inputs}`
  })
  const hit = seen.match(FORBIDDEN)
  if (hit) throw new Error(`Brand check failed at "${where}": found "${hit[0]}" on screen. Nothing was published.`)
}

async function newDemoPage(browser, id) {
  const dir = join(OUT, `_video-${id}`)
  rmSync(dir, { recursive: true, force: true })
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir, size: SIZE },
    reducedMotion: 'reduce',
    colorScheme: 'dark', // the app follows the system scheme when it has no saved choice
  })
  // Pin the app's own saved preference too, so the recording is dark even if that default changes.
  await context.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch { /* private mode */ } })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  await page.route('**/config.js', async (route) => {
    const res = await route.fetch()
    await route.fulfill({ response: res, body: `${await res.text()}\nwindow.__MDP_CONFIG__.brand = 'neutral';\n` })
  })
  return { page, context, dir }
}

async function finish({ page, context, dir }, id) {
  const video = page.video()
  await context.close() // flushes the recording
  renameSync(await video.path(), join(OUT, `${id}.webm`))
  rmSync(dir, { recursive: true, force: true })
}

async function poster(page, id) {
  await page.screenshot({ path: join(OUT, `${id}.jpg`), type: 'jpeg', quality: 82 })
}

// ── Steps ────────────────────────────────────────────────────────────────────

async function signUp(page, label) {
  await page.goto(`${BASE}/signup`)
  await page.waitForSelector('input[type=email]')
  await assertClean(page, `${label}: signup`)
  await pause(page)
  const email = `${STUDENTS[label]}${suffix}@example.com`
  await page.locator('input[type=email]').pressSequentially(email, { delay: 30 })
  const pw = page.locator('input[type=password]')
  await pw.nth(0).pressSequentially(PASSWORD, { delay: 20 })
  await pw.nth(1).pressSequentially(PASSWORD, { delay: 20 })
  await pause(page, 500)
  await page.click('button[type=submit]')
  await heading(page, 'What are you studying?').waitFor()
}

async function onboardingUpToCredits(page, label) {
  // Step 1 is the program: college, then major, then concentration (a one-college list starts at the majors).
  await heading(page, 'What are you studying?').waitFor()
  await assertClean(page, `${label}: program`)
  await pause(page, 1200)
  const colleges = page.locator('.program-college')
  if (await colleges.count()) {
    await colleges.filter({ hasText: 'Engineering' }).first().click()
    await pause(page, 700)
  }
  await page.locator('.program-major', { hasText: 'Computer Science' }).first().click()
  await pause(page, 700)
  await page.locator('.concentration-card', { hasText: 'CSC Core' }).click()
  await assertClean(page, `${label}: concentration`)
  await pause(page, 900)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Step 2: the start term, limited to the terms the program has a plan for
  await heading(page, 'Tell us about yourself').waitFor()
  await assertClean(page, `${label}: start term`)
  await page.getByText('Incoming Freshman').click()
  await pause(page, 500)
  // The year must be chosen first: it decides which seasons are offered.
  await page.locator('select').nth(1).selectOption('2027')
  await page.locator('select').nth(0).selectOption('Fall')
  await pause(page)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await heading(page, 'Test Scores').waitFor()
  // the fields run Math, English, Science, Reading, Composite (then an optional SAT Math)
  const scores = ['25', '28', '27', '27', '26']
  for (const [i, s] of scores.entries()) await page.locator('input.onboarding-input').nth(i).pressSequentially(s, { delay: 60 })
  await pause(page, 600)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await heading(page, "Your Math Sequence").waitFor()
  await page.locator('.math-chain-node').first().waitFor()
  await assertClean(page, `${label}: math sequence`)
  await pause(page, 1800)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await heading(page, "Any prior credits?").waitFor()
}

async function addApCalculus(page, label) {
  await page.getByRole('button', { name: '+ Add prior credit' }).click()
  await heading(page, "What kind of credit do you have?").waitFor()
  await assertClean(page, `${label}: wizard 1`)
  await pause(page, 1000)
  await page.getByRole('button', { name: 'AP Exam' }).click()
  await page.getByRole('button', { name: 'Calculus AB', exact: true }).first().click()
  await heading(page, "What score did you receive?").waitFor()
  await pause(page, 800)
  await page.getByRole('button', { name: /Score 4\+/ }).click()
  await heading(page, "Confirm what you'll receive").waitFor()
  await page.locator('.wizard-award-card').first().waitFor()
  await assertClean(page, `${label}: wizard confirm`)
  await pause(page, 2200)
  await page.getByRole('button', { name: 'Confirm & Apply' }).click()
  await page.getByText('No prior credits added yet.').waitFor({ state: 'detached' })
  await pause(page, 1500)
}

async function buildPlan(page, label) {
  await page.getByRole('button', { name: 'Build my degree plan' }).click()
  await page.locator('.ds-grid').waitFor({ timeout: 60000 })
  await page.locator('.ds-row').first().waitFor()
  await pause(page, 1500)
  await assertClean(page, `${label}: plan`)
}

// Optional flourish: open the first course-choice row and show what appears. If the app's
// markup changes this is skipped rather than failing the whole release's demo run.
async function tryOpenPoolRow(page, label) {
  try {
    const row = page.locator('.ds-row', { has: page.locator('.ds-row-code-pool') }).first()
    await row.scrollIntoViewIfNeeded({ timeout: 4000 })
    await row.click({ timeout: 4000 })
    await pause(page, 1600)
    await assertClean(page, `${label}: pool row`)
    return true
  } catch (e) {
    if (/Brand check failed/.test(e.message)) throw e
    console.warn(`(skipped pool-row step: ${e.message.split('\n')[0]})`)
    return false
  }
}

// ── Demos ────────────────────────────────────────────────────────────────────

async function demoBuildPlan(browser) {
  const id = 'build-plan'
  const ctx = await newDemoPage(browser, id)
  const { page } = ctx
  await signUp(page, id)
  await onboardingUpToCredits(page, id)
  await page.getByRole('button', { name: "I'll add these later" }).hover()
  await pause(page, 900)
  await page.getByRole('button', { name: 'Build my degree plan' }).click()
  await page.locator('.ds-grid').waitFor({ timeout: 60000 })
  await page.locator('.ds-row').first().waitFor()
  await pause(page, 1500)
  await assertClean(page, `${id}: plan`)
  await poster(page, id)
  await page.locator('.ds-grid').evaluate((el) => el.scrollBy({ top: 500, behavior: 'instant' })).catch(() => {})
  await pause(page, 1500)
  await tryOpenPoolRow(page, id)
  await pause(page, 1500)
  await finish(ctx, id)
}

async function demoPriorCredit(browser) {
  const id = 'prior-credit'
  const ctx = await newDemoPage(browser, id)
  const { page } = ctx
  await signUp(page, id)
  await onboardingUpToCredits(page, id)
  await addApCalculus(page, id)
  await assertClean(page, `${id}: credits added`)
  await pause(page, 1200)
  await buildPlan(page, id)
  await poster(page, id)
  await pause(page, 2500)
  await finish(ctx, id)
}

const browser = await chromium.launch()
try {
  await demoBuildPlan(browser)
  await demoPriorCredit(browser)
  console.log(`Captured build-plan and prior-credit into ${OUT}/`)
} finally {
  await browser.close()
}
