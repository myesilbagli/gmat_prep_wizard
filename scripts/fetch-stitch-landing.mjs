/**
 * Downloads HTML + screenshot for a Stitch screen using @google/stitch-sdk.
 * Requires STITCH_API_KEY in environment or .env.local (same line format).
 *
 * Usage:
 *   STITCH_API_KEY=your_key node scripts/fetch-stitch-landing.mjs
 *
 * Project: Test Page — GMAT Lexicon - Premium Landing Page
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { stitch } from '@google/stitch-sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const STITCH_PROJECT_ID = '4820344346457111791'
const STITCH_SCREEN_ID = '8fb46089527c41dcae6075d13b4c0644'

function loadEnvLocal() {
  const p = join(root, '.env.local')
  if (!existsSync(p)) return
  const raw = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    // export STITCH_API_KEY=value
    line = line.replace(/^export\s+/i, '')
    const m = line.match(/^(STITCH_API_KEY|VITE_STITCH_API_KEY)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1)
    process.env.STITCH_API_KEY = v
    break
  }
}

loadEnvLocal()

if (!process.env.STITCH_API_KEY?.trim()) {
  const p = join(root, '.env.local')
  const hint = existsSync(p)
    ? 'Found .env.local but no usable key line. Use exactly:\n  STITCH_API_KEY=your_key\n(no spaces around =; one line; not commented with #). Alias: VITE_STITCH_API_KEY.'
    : 'No .env.local in project root. Create it or run:\n  STITCH_API_KEY=your_key npm run stitch:fetch'
  console.error(`Missing STITCH_API_KEY.\n${hint}`)
  process.exit(1)
}

const outDir = join(root, '.stitch', 'designs')
mkdirSync(outDir, { recursive: true })

const project = stitch.project(STITCH_PROJECT_ID)
const screen = await project.getScreen(STITCH_SCREEN_ID)

const htmlUrl = await screen.getHtml()
const imageUrl = await screen.getImage()

console.log('Fetching HTML…', htmlUrl)
const htmlRes = await fetch(htmlUrl)
if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`)
const html = await htmlRes.text()
writeFileSync(join(outDir, 'landing.html'), html, 'utf8')
console.log('Wrote', join(outDir, 'landing.html'))

console.log('Fetching screenshot…', imageUrl)
const imgRes = await fetch(imageUrl)
if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)
const buf = Buffer.from(await imgRes.arrayBuffer())
writeFileSync(join(outDir, 'landing.png'), buf)
console.log('Wrote', join(outDir, 'landing.png'))

writeFileSync(
  join(root, '.stitch', 'metadata.json'),
  JSON.stringify(
    {
      projectId: STITCH_PROJECT_ID,
      screenId: STITCH_SCREEN_ID,
      title: 'GMAT Lexicon - Premium Landing Page',
      fetchedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  'utf8',
)
console.log('Done.')
