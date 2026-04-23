import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type GlossaryItem = {
  word: string
  level: 'foundation' | 'intermediate' | 'advanced'
}

export type GlossaryFile = {
  meta?: { total_items?: number }
  stacks: { stack: string; items: GlossaryItem[] }[]
}

export function repoRootFromScriptsDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

export function resolveGlossaryJsonPath(): string {
  const env = process.env.GLOSSARY_STACKS_PATH
  if (env) return path.resolve(env)
  return path.join(repoRootFromScriptsDir(), 'data', 'gmat_vocab_stacks.json')
}

export function readGlossary(): GlossaryFile {
  const p = resolveGlossaryJsonPath()
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw) as GlossaryFile
}
