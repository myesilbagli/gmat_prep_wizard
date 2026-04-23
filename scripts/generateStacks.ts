/**
 * Generate validated `GeneratedResult` JSON per glossary word (staging review).
 *
 * Usage:
 *   npx tsx scripts/generateStacks.ts --stack=stack_discriminator
 *   npx tsx scripts/generateStacks.ts --stack=all --yes
 *   npx tsx scripts/generateStacks.ts --stack=all --dry-run
 *
 * Env: OPENAI_API_KEY, OPENAI_GENERATE_MODEL (default gpt-4.1), GLOSSARY_STACKS_PATH (optional),
 *      OPENAI_PRICE_INPUT_PER_MILLION, OPENAI_PRICE_OUTPUT_PER_MILLION,
 *      GENERATE_AVG_INPUT_TOKENS, GENERATE_AVG_OUTPUT_TOKENS,
 *      STACK_GENERATE_DELAY_MS (default 2500), STACK_GENERATE_LATENCY_MS_EST (default 3500).
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import OpenAI from 'openai'
import type { GeneratedResult } from '../shared/types.ts'
import { CANONICAL_STACK_ORDER } from '../shared/canonicalStacks.ts'
import { parseJsonFromOutputText } from '../shared/parseOpenAiJson.ts'
import { validateGeneratedResult } from '../shared/wordGeneration.ts'
import {
  buildEnglishGeneratePrompt,
  normalizeGenerateText,
} from './lib/buildEnglishPrompt.ts'
import { readGlossary, repoRootFromScriptsDir } from './lib/glossary.ts'
import type { StackLevelBand } from '../shared/stackPackTypes.ts'

type StagingRecord = {
  text: string
  stackId: string
  stackPosition: number
  level: StackLevelBand
  generatedAt: string
  result: GeneratedResult
}

type Job = {
  stackId: string
  text: string
  stackPosition: number
  level: StackLevelBand
}

function parseArgs(argv: string[]) {
  let stack = ''
  let wordFilter = ''
  let yes = false
  let dryRun = false
  for (const a of argv) {
    if (a.startsWith('--stack=')) stack = a.slice('--stack='.length).trim()
    else if (a.startsWith('--word=')) wordFilter = a.slice('--word='.length).trim().toLowerCase()
    else if (a === '--yes' || a === '-y') yes = true
    else if (a === '--dry-run') dryRun = true
  }
  return { stack, wordFilter, yes, dryRun }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function estimateRun(wordCount: number) {
  const inPerM = Number(process.env.OPENAI_PRICE_INPUT_PER_MILLION ?? '2')
  const outPerM = Number(process.env.OPENAI_PRICE_OUTPUT_PER_MILLION ?? '8')
  const avgInTok = Number(process.env.GENERATE_AVG_INPUT_TOKENS ?? '320')
  const avgOutTok = Number(process.env.GENERATE_AVG_OUTPUT_TOKENS ?? '420')
  const delayMs = Number(process.env.STACK_GENERATE_DELAY_MS ?? '2500')
  const latencyEst = Number(process.env.STACK_GENERATE_LATENCY_MS_EST ?? '3500')

  const inputCost = ((wordCount * avgInTok) / 1e6) * inPerM
  const outputCost = ((wordCount * avgOutTok) / 1e6) * outPerM
  const totalUsd = inputCost + outputCost
  const secPerWord = (delayMs + latencyEst) / 1000
  const wallSec = wordCount * secPerWord

  return {
    totalUsd,
    wallSec,
    delayMs,
    model: process.env.OPENAI_GENERATE_MODEL ?? 'gpt-4.1',
    inPerM,
    outPerM,
    avgInTok,
    avgOutTok,
  }
}

function formatUsd(n: number) {
  return n < 0.01 ? '< $0.01' : `$${n.toFixed(2)}`
}

function collectJobs(stackArg: string, wordFilter: string): Job[] {
  const data = readGlossary()
  const jobs: Job[] = []
  const wantAll = stackArg === 'all'

  for (let i = 0; i < CANONICAL_STACK_ORDER.length; i++) {
    const { id } = CANONICAL_STACK_ORDER[i]!
    if (!wantAll && stackArg !== id) continue

    const lore = data.stacks[i]
    if (!lore) throw new Error(`Missing glossary stack index ${i}`)

    lore.items.forEach((item, pos) => {
      const text = item.word
      if (wordFilter && text.trim().toLowerCase() !== wordFilter) return
      jobs.push({
        stackId: id,
        text,
        stackPosition: pos,
        level: item.level,
      })
    })
  }

  if (!wantAll && jobs.length === 0) {
    throw new Error(`Unknown or empty --stack=${stackArg}. Use a canonical id or "all".`)
  }

  return jobs
}

function stagingPath(root: string, stackId: string) {
  return path.join(root, 'data', 'stacks', 'staging', `${stackId}.json`)
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

async function main() {
  const root = repoRootFromScriptsDir()
  const { stack, wordFilter, yes, dryRun } = parseArgs(process.argv.slice(2))

  if (!stack) {
    console.error(
      'Usage: npx tsx scripts/generateStacks.ts --stack=<canonical_id|all> [--word=text] [--yes] [--dry-run]',
    )
    process.exit(1)
  }

  const jobs = collectJobs(stack, wordFilter)
  const wordCount = jobs.length
  const est = estimateRun(wordCount)

  console.log('')
  console.log('Stack generation (staging JSON)')
  console.log('─'.repeat(44))
  console.log(`Model:           ${est.model}`)
  console.log(`Words to run:    ${wordCount}`)
  console.log(`Pricing (est.):  $${est.inPerM}/1M input, $${est.outPerM}/1M output tokens`)
  console.log(`Avg tokens est.: ${est.avgInTok} in / ${est.avgOutTok} out per word`)
  console.log(`Cost (approx.):  ${formatUsd(est.totalUsd)}`)
  console.log(
    `Wall time (est.): ~${Math.ceil(est.wallSec / 60)} min (${est.wallSec.toFixed(0)} s; ${est.delayMs} ms delay/word + ~${Number(process.env.STACK_GENERATE_LATENCY_MS_EST ?? '3500')} ms latency est.)`,
  )
  console.log('')

  if (dryRun) {
    console.log('--dry-run: no API calls.')
    process.exit(0)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY in environment.')
    process.exit(1)
  }

  if (!yes && !(await confirmProceed())) {
    console.log('Aborted.')
    process.exit(0)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = est.model

  /** Per-stack accumulated records (merge with existing staging when resuming same stack file). */
  const byStack = new Map<string, StagingRecord[]>()

  function loadExisting(stackId: string): StagingRecord[] {
    const p = stagingPath(root, stackId)
    if (!fs.existsSync(p)) return []
    try {
      const raw = fs.readFileSync(p, 'utf8')
      const parsed = JSON.parse(raw) as StagingRecord[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  for (const id of new Set(jobs.map((j) => j.stackId))) {
    byStack.set(id, loadExisting(id))
  }

  let ok = 0
  let fail = 0

  for (const job of jobs) {
    const existing = byStack.get(job.stackId) ?? []
    const already = existing.find(
      (r) =>
        r.stackPosition === job.stackPosition &&
        r.text.trim().toLowerCase() === job.text.trim().toLowerCase() &&
        r.result,
    )
    if (already) {
      console.log(`Skip (already in staging): ${job.stackId} #${job.stackPosition} ${job.text}`)
      continue
    }

    let textNorm: string
    try {
      textNorm = normalizeGenerateText(job.text)
    } catch (e) {
      console.error(`Skip invalid text "${job.text}":`, e)
      fail++
      continue
    }

    const prompt = buildEnglishGeneratePrompt(textNorm, { curriculumLevel: job.level })

    async function runOnce(): Promise<GeneratedResult | null> {
      const completion = await openai.responses.create({
        model,
        input: prompt,
        temperature: 0.4,
        max_output_tokens: 1500,
      })
      const outputText = completion.output_text?.trim() ?? ''
      const raw = parseJsonFromOutputText<unknown>(outputText)
      if (raw && validateGeneratedResult(raw)) return raw
      return null
    }

    let parsed: GeneratedResult | null = null
    try {
      parsed = await runOnce()
      if (!parsed) parsed = await runOnce()
    } catch (e) {
      console.error(`API error ${job.stackId} ${job.text}:`, e)
      fail++
      continue
    }

    if (!parsed) {
      console.error(`Validation failed twice: ${job.stackId} ${job.text}`)
      fail++
      continue
    }

    const record: StagingRecord = {
      text: job.text.trim(),
      stackId: job.stackId,
      stackPosition: job.stackPosition,
      level: job.level,
      generatedAt: new Date().toISOString(),
      result: parsed,
    }

    const list = byStack.get(job.stackId) ?? []
    const idx = list.findIndex(
      (r) =>
        r.stackPosition === job.stackPosition &&
        r.text.trim().toLowerCase() === job.text.trim().toLowerCase(),
    )
    if (idx >= 0) list[idx] = record
    else list.push(record)
    list.sort((a, b) => a.stackPosition - b.stackPosition)
    byStack.set(job.stackId, list)

    fs.mkdirSync(path.dirname(stagingPath(root, job.stackId)), { recursive: true })
    fs.writeFileSync(stagingPath(root, job.stackId), JSON.stringify(list, null, 2) + '\n', 'utf8')

    ok++
    console.log(`OK ${job.stackId} #${job.stackPosition} ${job.text}`)
    await delay(est.delayMs)
  }

  console.log('')
  console.log(`Done. Success: ${ok}, failed/skipped errors: ${fail}`)
  console.log(`Staging dir: ${path.join(root, 'data', 'stacks', 'staging')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
