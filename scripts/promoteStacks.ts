/**
 * Promote reviewed staging JSON → production TypeScript modules under `shared/stacks/{id}.ts`.
 * No JSON imports in app code.
 *
 * Usage: npx tsx scripts/promoteStacks.ts
 * Optional: npx tsx scripts/promoteStacks.ts --stack=stack_arg_architecture
 */
import fs from 'node:fs'
import path from 'node:path'
import type { GeneratedResult } from '../shared/types.ts'
import { CANONICAL_STACK_ORDER } from '../shared/canonicalStacks.ts'
import { validateGeneratedResult } from '../shared/wordGeneration.ts'
import { readGlossary, repoRootFromScriptsDir } from './lib/glossary.ts'
import type { StackLevelBand, StackPackRow } from '../shared/stackPackTypes.ts'

type StagingRecord = {
  text: string
  stackId: string
  stackPosition: number
  level: StackLevelBand
  generatedAt?: string
  result: GeneratedResult
}

function parseArgs(argv: string[]) {
  let stack = ''
  for (const a of argv) {
    if (a.startsWith('--stack=')) stack = a.slice('--stack='.length).trim()
  }
  return { stack }
}

function stagingPath(root: string, stackId: string) {
  return path.join(root, 'data', 'stacks', 'staging', `${stackId}.json`)
}

function main() {
  const root = repoRootFromScriptsDir()
  const { stack } = parseArgs(process.argv.slice(2))
  const glossary = readGlossary()
  const targets =
    stack === ''
      ? [...CANONICAL_STACK_ORDER]
      : CANONICAL_STACK_ORDER.filter((s) => s.id === stack)

  if (stack && targets.length === 0) {
    console.error(`Unknown stack id: ${stack}`)
    process.exit(1)
  }

  for (let t = 0; t < targets.length; t++) {
    const spec = targets[t]!
    const spath = stagingPath(root, spec.id)
    if (!fs.existsSync(spath)) {
      console.warn(`Skip (no staging file): ${spath}`)
      continue
    }

    const raw = fs.readFileSync(spath, 'utf8')
    const rows = JSON.parse(raw) as StagingRecord[]
    if (!Array.isArray(rows)) {
      console.error(`Invalid JSON array: ${spath}`)
      process.exit(1)
    }

    const loreIdx = CANONICAL_STACK_ORDER.findIndex((s) => s.id === spec.id)
    const loreCount =
      loreIdx >= 0 ? glossary.stacks[loreIdx]?.items.length : undefined
    if (loreCount !== undefined && rows.length !== loreCount) {
      console.warn(
        `Warning: ${spec.id} staging has ${rows.length} rows; glossary expects ${loreCount}.`,
      )
    }

    const pack: StackPackRow[] = []
    for (const r of rows) {
      if (!validateGeneratedResult(r.result)) {
        console.error(`Invalid result in staging for ${spec.id} position ${r.stackPosition}`)
        process.exit(1)
      }
      pack.push({
        text: r.text,
        stackPosition: r.stackPosition,
        level: r.level,
        result: r.result,
      })
    }
    pack.sort((a, b) => a.stackPosition - b.stackPosition)

    const relTypes = `import type { StackPackRow } from '../stackPackTypes'`
    const header = `/** Promoted from staging JSON — do not edit by hand. */\n${relTypes}\n\n`
    const body = `export const STACK_PACK: readonly StackPackRow[] = ${JSON.stringify(pack, null, 2)}\n`

    const outPath = path.join(root, 'shared', 'stacks', `${spec.id}.ts`)
    fs.writeFileSync(outPath, header + body, 'utf8')
    console.log('Wrote', path.relative(root, outPath), `(${pack.length} cards)`)
  }

  console.log('Promotion complete.')
}

main()
