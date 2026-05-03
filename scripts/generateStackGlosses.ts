/**
 * Generate native-language glosses for an existing staging stack file.
 *
 * Reads `data/stacks/staging/<stackId>.json`, asks OpenAI for a short gloss
 * per word in the target language, and writes the result back into
 * `entry.translations[lang]`. Idempotent by default; --force re-generates
 * everything (after taking a verbatim backup of the staging file).
 *
 * Usage:
 *   npx tsx scripts/generateStackGlosses.ts --stack=stack_arg_architecture --lang=tr --dry-run
 *   npx tsx scripts/generateStackGlosses.ts --stack=stack_arg_architecture --lang=tr
 *   npx tsx scripts/generateStackGlosses.ts --stack=stack_arg_architecture --lang=tr --limit=5
 *   npx tsx scripts/generateStackGlosses.ts --stack=stack_arg_architecture --lang=tr --force --yes
 *
 * Env: OPENAI_API_KEY (required for non-dry-run),
 *      OPENAI_GLOSS_MODEL (preferred) or OPENAI_GENERATE_MODEL (default gpt-4.1),
 *      OPENAI_PRICE_INPUT_PER_MILLION (default 2),
 *      OPENAI_PRICE_OUTPUT_PER_MILLION (default 8),
 *      GLOSS_AVG_INPUT_TOKENS (default 160),
 *      GLOSS_AVG_OUTPUT_TOKENS (default 12),
 *      STACK_GENERATE_DELAY_MS (default 2500),
 *      STACK_GENERATE_LATENCY_MS_EST (default 3500).
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import OpenAI from 'openai'
import type { GeneratedResult } from '../shared/types.ts'
import {
  CANONICAL_STACK_ORDER,
  isCanonicalStackId,
} from '../shared/canonicalStacks.ts'
import {
  MAIN_LANGUAGE_OPTIONS,
  getMainLanguageLabel,
} from '../shared/languages.ts'
import type { StackLevelBand } from '../shared/stackPackTypes.ts'
import { repoRootFromScriptsDir } from './lib/glossary.ts'

type StagingRecord = {
  text: string
  stackId: string
  stackPosition: number
  level: StackLevelBand
  generatedAt?: string
  result: GeneratedResult
  translations?: Record<string, string>
}

type ParsedArgs = {
  stack: string
  lang: string
  dryRun: boolean
  force: boolean
  yes: boolean
  limit: number | null
}

function parseArgs(argv: string[]): ParsedArgs {
  let stack = ''
  let lang = ''
  let dryRun = false
  let force = false
  let yes = false
  let limit: number | null = null
  for (const a of argv) {
    if (a.startsWith('--stack=')) stack = a.slice('--stack='.length).trim()
    else if (a.startsWith('--lang=')) lang = a.slice('--lang='.length).trim()
    else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length).trim())
      limit = Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
    } else if (a === '--dry-run') dryRun = true
    else if (a === '--force') force = true
    else if (a === '--yes' || a === '-y') yes = true
  }
  return { stack, lang, dryRun, force, yes, limit }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function stagingPath(root: string, stackId: string) {
  return path.join(root, 'data', 'stacks', 'staging', `${stackId}.json`)
}

function backupDir(root: string) {
  return path.join(root, 'data', 'stacks', 'staging', '.backups')
}

function safeIsoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function formatUsd(n: number) {
  return n < 0.01 ? '< $0.01' : `$${n.toFixed(2)}`
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Strip a single layer of surrounding quote characters that the model often adds
 * despite the "no quotes" instruction in the prompt.
 */
function stripSurroundingQuotes(s: string): string {
  if (s.length < 2) return s
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['\u201C', '\u201D'],
    ['\u2018', '\u2019'],
  ]
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close)) return s.slice(1, -1).trim()
  }
  return s
}

type ValidationOk = { ok: true; gloss: string }
type ValidationErr = { ok: false; reason: string }
type ValidationResult = ValidationOk | ValidationErr

function validateGloss(rawOutput: string, englishWord: string): ValidationResult {
  let gloss = rawOutput.trim()
  gloss = stripSurroundingQuotes(gloss).trim()
  if (!gloss) return { ok: false, reason: 'empty after trim/quote-strip' }
  if (gloss.length > 100) return { ok: false, reason: `length ${gloss.length} > 100` }
  if (gloss.includes('\n')) return { ok: false, reason: 'contains newline' }
  if (gloss.toLowerCase() === englishWord.trim().toLowerCase()) {
    return { ok: false, reason: 'identical to English word' }
  }
  return { ok: true, gloss }
}

function buildPrompt(
  entry: StagingRecord,
  languageLabel: string,
): { prompt: string; ok: true } | { ok: false; reason: string } {
  if (!isNonEmptyString(entry.result?.simpleDefinition)) {
    return { ok: false, reason: 'missing simpleDefinition' }
  }
  const text = entry.text.trim()
  const pos = isNonEmptyString(entry.result.partOfSpeech)
    ? entry.result.partOfSpeech.trim()
    : null
  const example =
    Array.isArray(entry.result.examples) && isNonEmptyString(entry.result.examples[0])
      ? entry.result.examples[0].trim()
      : null

  const lines: string[] = [
    `You are translating English vocabulary words into ${languageLabel} for a study app.`,
    `The user knows English well but uses ${languageLabel} as a memory anchor when`,
    `learning new words.`,
    ``,
    `Word: ${text}`,
  ]
  if (pos) lines.push(`Part of speech: ${pos}`)
  lines.push(`Simple English meaning: ${entry.result.simpleDefinition.trim()}`)
  if (example) lines.push(`Example sentence: ${example}`)
  lines.push(
    ``,
    `Provide a 2-8 word ${languageLabel} gloss that captures the main sense of this`,
    `word as used on the GMAT (a graduate-level English exam). Use natural`,
    `${languageLabel}, not a word-for-word translation. If the word has multiple`,
    `senses, focus on the academic/formal sense most likely to appear on a`,
    `graduate-level English reading comprehension test.`,
    ``,
    `Return ONLY the ${languageLabel} gloss. No quotes, no explanation, no English,`,
    `no extra punctuation.`,
  )
  return { ok: true, prompt: lines.join('\n') }
}

async function confirmProceed(): Promise<boolean> {
  const rl = readline.createInterface({ input, output })
  try {
    const ans = await rl.question('Proceed with OpenAI generation? [y/N] ')
    return /^y(es)?$/i.test(ans.trim())
  } finally {
    rl.close()
  }
}

function loadStaging(spath: string): StagingRecord[] {
  if (!fs.existsSync(spath)) {
    console.error(`Staging file not found: ${path.relative(process.cwd(), spath)}`)
    process.exit(1)
  }
  const raw = fs.readFileSync(spath, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.error(`Invalid JSON in staging file ${spath}:`, e)
    process.exit(1)
  }
  if (!Array.isArray(parsed)) {
    console.error(`Expected JSON array at top level of ${spath}`)
    process.exit(1)
  }
  return parsed as StagingRecord[]
}

function writeStaging(spath: string, rows: StagingRecord[]) {
  fs.writeFileSync(spath, JSON.stringify(rows, null, 2) + '\n', 'utf8')
}

function writeBackup(root: string, stackId: string, sourcePath: string): string {
  const dir = backupDir(root)
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${stackId}.${safeIsoStamp()}.json`)
  fs.copyFileSync(sourcePath, dest)
  return dest
}

async function main() {
  const root = repoRootFromScriptsDir()
  const args = parseArgs(process.argv.slice(2))

  if (!args.stack) {
    console.error(
      'Usage: npx tsx scripts/generateStackGlosses.ts --stack=<canonical_id> --lang=<langCode> [--dry-run] [--limit=<n>] [--force] [--yes]',
    )
    process.exit(1)
  }
  if (!isCanonicalStackId(args.stack)) {
    console.error(
      `Unknown stack id "${args.stack}". Valid: ${CANONICAL_STACK_ORDER.map((s) => s.id).join(', ')}`,
    )
    process.exit(1)
  }
  if (!args.lang) {
    console.error('Missing required --lang=<code>')
    process.exit(1)
  }
  if (args.lang === 'en') {
    console.error('Refusing to generate English glosses. English content already exists.')
    process.exit(1)
  }
  const knownLang = MAIN_LANGUAGE_OPTIONS.some((o) => o.code === args.lang)
  if (!knownLang) {
    console.error(
      `Unknown language code "${args.lang}". Valid: ${MAIN_LANGUAGE_OPTIONS.map((o) => o.code).join(', ')}`,
    )
    process.exit(1)
  }
  if (args.limit === 0) {
    console.log('Limit is 0; nothing to do.')
    process.exit(0)
  }

  const lang = args.lang
  const languageLabel = getMainLanguageLabel(lang)
  const spath = stagingPath(root, args.stack)
  const staging = loadStaging(spath)
  const totalRows = staging.length

  type Pending = {
    index: number
    record: StagingRecord
    overwriting: boolean
    previousValue: string | null
  }
  const pending: Pending[] = []
  let alreadyGlossedCount = 0

  for (let i = 0; i < staging.length; i++) {
    const r = staging[i]!
    const existing = r.translations?.[lang]
    const hasExisting = isNonEmptyString(existing)
    if (hasExisting) alreadyGlossedCount++
    if (hasExisting && !args.force) continue
    pending.push({
      index: i,
      record: r,
      overwriting: hasExisting,
      previousValue: hasExisting ? existing!.trim() : null,
    })
  }

  let toProcess = pending
  if (args.limit !== null && args.limit < toProcess.length) {
    toProcess = toProcess.slice(0, args.limit)
  }

  const inPerM = Number(process.env.OPENAI_PRICE_INPUT_PER_MILLION ?? '2')
  const outPerM = Number(process.env.OPENAI_PRICE_OUTPUT_PER_MILLION ?? '8')
  const avgInTok = Number(process.env.GLOSS_AVG_INPUT_TOKENS ?? '160')
  const avgOutTok = Number(process.env.GLOSS_AVG_OUTPUT_TOKENS ?? '12')
  const delayMs = Number(process.env.STACK_GENERATE_DELAY_MS ?? '2500')
  const latencyEst = Number(process.env.STACK_GENERATE_LATENCY_MS_EST ?? '3500')
  const model =
    process.env.OPENAI_GLOSS_MODEL ?? process.env.OPENAI_GENERATE_MODEL ?? 'gpt-4.1'

  const wordCount = toProcess.length
  const inputCost = ((wordCount * avgInTok) / 1e6) * inPerM
  const outputCost = ((wordCount * avgOutTok) / 1e6) * outPerM
  const totalUsd = inputCost + outputCost
  const wallSec = wordCount * ((delayMs + latencyEst) / 1000)

  const overwriteCount = toProcess.filter((p) => p.overwriting).length

  console.log('')
  console.log('Stack gloss generation')
  console.log('─'.repeat(45))
  console.log(`Stack:           ${args.stack} (${totalRows} rows)`)
  console.log(`Language:        ${lang} — ${languageLabel}`)
  console.log(`Model:           ${model}`)
  console.log(
    `Already glossed: ${alreadyGlossedCount}  ${args.force ? '(--force will overwrite)' : '(skipping)'}`,
  )
  console.log(`To translate:    ${wordCount}${overwriteCount > 0 ? ` (overwriting ${overwriteCount})` : ''}`)
  console.log(`Pricing (est.):  $${inPerM}/1M input, $${outPerM}/1M output tokens`)
  console.log(`Avg tokens est.: ${avgInTok} in / ${avgOutTok} out per word`)
  console.log(`Cost (approx.):  ${formatUsd(totalUsd)}`)
  if (wordCount > 0) {
    console.log(
      `Wall time (est.): ~${Math.ceil(wallSec / 60)} min (${wallSec.toFixed(0)} s; ${delayMs} ms delay/word + ~${latencyEst} ms latency est.)`,
    )
  }
  console.log('')

  if (args.dryRun) {
    console.log('--dry-run: no API calls.')
    process.exit(0)
  }

  if (wordCount === 0) {
    if (alreadyGlossedCount === totalRows && totalRows > 0) {
      console.log(
        `Nothing to do. All ${totalRows} words already have ${languageLabel} glosses. Use --force to regenerate.`,
      )
    } else {
      console.log('Nothing to do.')
    }
    process.exit(0)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in environment.')
    process.exit(1)
  }

  if (!args.yes && !(await confirmProceed())) {
    console.log('Aborted.')
    process.exit(0)
  }

  /**
   * Take a verbatim backup before any mutation, but only when --force is set
   * AND at least one row will actually be overwritten. Default-mode runs and
   * --force runs that don't overwrite anything need no backup.
   */
  let backupPath: string | null = null
  if (args.force && overwriteCount > 0) {
    backupPath = writeBackup(root, args.stack, spath)
    console.log(`Backup written: ${path.relative(root, backupPath)}`)
    console.log('')
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  let okCount = 0
  let skippedCount = 0
  let failCount = 0
  const failedWords: { position: number; text: string; reason: string }[] = []

  async function callOnce(prompt: string): Promise<string> {
    const completion = await openai.responses.create({
      model,
      input: prompt,
      temperature: 0.3,
      max_output_tokens: 30,
    })
    return completion.output_text?.trim() ?? ''
  }

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i]!
    const englishWord = p.record.text.trim()
    const tag = `[${i + 1}/${toProcess.length}]`

    const built = buildPrompt(p.record, languageLabel)
    if (!built.ok) {
      console.warn(`${tag} SKIP ${englishWord} (#${p.record.stackPosition}): ${built.reason}`)
      skippedCount++
      continue
    }

    if (p.overwriting && p.previousValue) {
      console.log(`${tag} ${englishWord} → ${languageLabel}  (re-generating, was: "${p.previousValue}")`)
    }

    let raw = ''
    let apiError: unknown = null
    try {
      raw = await callOnce(built.prompt)
    } catch (e) {
      apiError = e
      try {
        raw = await callOnce(built.prompt)
        apiError = null
      } catch (e2) {
        apiError = e2
      }
    }

    if (apiError) {
      console.error(`${tag} FAIL ${englishWord} (#${p.record.stackPosition}): API error`, apiError)
      failCount++
      failedWords.push({
        position: p.record.stackPosition,
        text: englishWord,
        reason: 'API error',
      })
      await delay(delayMs)
      continue
    }

    const v = validateGloss(raw, englishWord)
    if (!v.ok) {
      console.error(
        `${tag} FAIL ${englishWord} (#${p.record.stackPosition}): ${v.reason} — raw: ${JSON.stringify(raw)}`,
      )
      failCount++
      failedWords.push({
        position: p.record.stackPosition,
        text: englishWord,
        reason: v.reason,
      })
      await delay(delayMs)
      continue
    }

    const target = staging[p.index]!
    target.translations = { ...(target.translations ?? {}), [lang]: v.gloss }
    writeStaging(spath, staging)
    okCount++
    console.log(`${tag} ${englishWord} → ${languageLabel}: "${v.gloss}"`)
    await delay(delayMs)
  }

  const realizedCost =
    ((okCount * avgInTok) / 1e6) * inPerM + ((okCount * avgOutTok) / 1e6) * outPerM
  const idempotentSkips = alreadyGlossedCount - (args.force ? overwriteCount : 0)
  const deferredByLimit = pending.length - toProcess.length

  console.log('')
  console.log('Done.')
  console.log(`  Words generated:                              ${okCount}`)
  console.log(`  Words skipped (already had ${languageLabel} gloss): ${idempotentSkips}`)
  if (skippedCount > 0) {
    console.log(`  Words skipped (missing context):              ${skippedCount}`)
  }
  if (deferredByLimit > 0) {
    console.log(`  Words deferred by --limit:                    ${deferredByLimit}`)
  }
  console.log(`  Words failed:                                 ${failCount}`)
  console.log(`  Cost (approx.):                               ${formatUsd(realizedCost)}`)
  if (failedWords.length > 0) {
    console.log(
      `  Failed words:    [${failedWords.map((f) => `position ${f.position} "${f.text}" (${f.reason})`).join(', ')}]`,
    )
  }
  if (backupPath) {
    console.log(`  Backup written:  ${path.relative(root, backupPath)}`)
  }
  console.log('')
  console.log('Next step: review staging diff, then')
  console.log(`  npx tsx scripts/promoteStacks.ts --stack=${args.stack}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
