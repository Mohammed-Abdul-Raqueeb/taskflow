import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

/**
 * Development helper: captures the main screens in both themes and at three
 * widths. Not part of the test suite -- it exists so a change can be eyeballed
 * quickly without clicking through every page by hand.
 *
 * Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
 */

const BASE = process.argv[2] ?? 'http://localhost:3210'
const OUT = process.argv[3] ?? 'screenshots'

const PAGES = [
  ['dashboard', '/dashboard'],
  ['tasks', '/tasks'],
  ['projects', '/projects'],
  ['calendar', '/calendar'],
  ['settings', '/settings'],
  ['task-form', '/tasks/new'],
]

const VIEWPORTS = [
  ['desktop', { width: 1440, height: 1000 }],
  ['tablet', { width: 834, height: 1100 }],
]

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function shoot(context, label, theme) {
  const page = await context.newPage()

  // Sign in once per context.
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill('demo@taskflow.app')
  await page.getByLabel('Password', { exact: true }).fill('demo1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard')

  await context.addCookies([
    { name: 'taskflow_theme', value: theme, url: BASE },
    { name: 'taskflow_tz', value: 'UTC', url: BASE },
  ])

  for (const [name, path] of PAGES) {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('load')
    await page.waitForTimeout(400)
    const file = `${OUT}/${label}-${theme}-${name}.png`
    await page.screenshot({ path: file, fullPage: label !== 'mobile' })
    console.log(file)
  }

  await page.close()
}

for (const theme of ['light', 'dark']) {
  for (const [label, viewport] of VIEWPORTS) {
    const context = await browser.newContext({ viewport })
    await shoot(context, label, theme)
    await context.close()
  }

  const mobile = await browser.newContext({ ...devices['Pixel 7'] })
  await shoot(mobile, 'mobile', theme)
  await mobile.close()
}

await browser.close()
console.log('\nDone.')
