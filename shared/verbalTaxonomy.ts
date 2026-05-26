/**
 * Canonical GMAT verbal taxonomy — single source of truth.
 *
 * Spine:
 *   RC official subtypes (5):  Main Idea, Supporting Idea, Inference,
 *                              Application, Evaluation.
 *   CR official subtypes (4):  Analysis, Construction, Critique, Plan.
 *
 * The existing generator enums (RcQuestionType in shared/rcTypes.ts and
 * CrQuestionType in shared/crTypes.ts) are referenced from here under
 * their official subtype, NOT replaced. The diagnostic's four verbal
 * fundamental skills (shared/diagnosticTypes.ts → VERBAL_FUNDAMENTAL_SKILLS)
 * are mapped onto the same spine.
 *
 * This module is pure data + pure functions. No Firestore, no network,
 * no React. Nothing in this commit changes generator behavior, diagnostic
 * parsing, or any runtime contract — consumers can opt in to using these
 * mappings; existing consumers are unaffected.
 *
 * Every official CR subtype is now served: cr_analysis maps to the
 * 'analysis' generator type and cr_plan maps to 'plan'. UNSERVED_SUBTYPES
 * stays as the queryable list of coverage gaps; it should currently be
 * empty for CR (and empty overall, since every RC subtype is also served).
 *
 * Naming convention:
 *   - Internal keys:  namespaced snake_case (rc_main_idea, cr_weaken-…)
 *   - Display labels: human Title Case
 * Existing generator enum values (e.g. 'main_idea', 'weaken') are
 * preserved as-is; this module references them, it does not rename them.
 */

import type { CrQuestionType } from './crTypes'
import type { RcQuestionType } from './rcTypes'
import { VERBAL_FUNDAMENTAL_SKILLS } from './diagnosticTypes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerbalSection = 'rc' | 'cr'

export type RcSubtypeKey =
  | 'rc_main_idea'
  | 'rc_supporting_idea'
  | 'rc_inference'
  | 'rc_application'
  | 'rc_evaluation'

export type CrSubtypeKey =
  | 'cr_analysis'
  | 'cr_construction'
  | 'cr_critique'
  | 'cr_plan'

export type VerbalSubtypeKey = RcSubtypeKey | CrSubtypeKey

/** RC subtypes are coarsely categorized by the diagnostic as either
 *  "stated" (Identify Stated Idea) or "inferred" (Identify Inferred Idea).
 *  CR subtypes have no analogous tag — their diagnostic skill mapping is
 *  direct (Plan/Construct / Analysis/Critique). */
export type DiagnosticRcOperation = 'stated' | 'inferred'

/** Derived from the diagnostic's existing constant so this module can't
 *  drift from shared/diagnosticTypes.ts. */
export type VerbalFundamentalSkill = (typeof VERBAL_FUNDAMENTAL_SKILLS)[number]

/** One canonical subtype, with the generator types nested under it,
 *  diagnostic operation tag (RC only), and verbatim official stems. */
export type VerbalSubtypeDef = {
  key: VerbalSubtypeKey
  section: VerbalSection
  /** Human Title Case label for UI. */
  label: string
  /** Existing generator enum values that land under this subtype. Empty
   *  array marks a known coverage gap (currently cr_analysis, cr_plan). */
  generatorTypes: ReadonlyArray<RcQuestionType | CrQuestionType>
  /** RC only. CR subtypes are null. */
  diagnosticOperation: DiagnosticRcOperation | null
  /** Verbatim example stems from the official GMAT guide. Data only —
   *  NOT yet wired into the RC or CR generator prompts. A later build
   *  may inject these; today they're just stored here. */
  stems: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// RC subtype constants
// ---------------------------------------------------------------------------

export const RC_SUBTYPES: Record<RcSubtypeKey, VerbalSubtypeDef> = {
  rc_main_idea: {
    key: 'rc_main_idea',
    section: 'rc',
    label: 'Main Idea',
    generatorTypes: ['main_idea'],
    diagnosticOperation: 'stated',
    stems: [
      'most accurately expresses the main idea',
      'the primary purpose of the passage as a whole is to',
    ],
  },
  rc_supporting_idea: {
    key: 'rc_supporting_idea',
    section: 'rc',
    label: 'Supporting Idea',
    generatorTypes: ['detail'],
    diagnosticOperation: 'stated',
    stems: [
      'according to the passage',
      'which of the following does the author cite as',
    ],
  },
  rc_inference: {
    key: 'rc_inference',
    section: 'rc',
    label: 'Inference',
    generatorTypes: ['inference'],
    diagnosticOperation: 'inferred',
    stems: [
      'it can be inferred from the passage that',
      'the passage implies that',
      'most strongly supported by',
    ],
  },
  rc_application: {
    key: 'rc_application',
    section: 'rc',
    label: 'Application',
    generatorTypes: ['application'],
    diagnosticOperation: 'inferred',
    stems: [
      'most clearly exemplifies',
      'most similar to',
      'most likely ruled out by',
    ],
  },
  rc_evaluation: {
    key: 'rc_evaluation',
    section: 'rc',
    label: 'Evaluation',
    generatorTypes: ['function', 'tone'],
    diagnosticOperation: 'inferred',
    stems: [
      'most accurately describes the structure of',
      'the purpose of',
      'is most vulnerable to the objection that',
    ],
  },
}

// ---------------------------------------------------------------------------
// CR subtype constants
// ---------------------------------------------------------------------------

export const CR_SUBTYPES: Record<CrSubtypeKey, VerbalSubtypeDef> = {
  cr_analysis: {
    key: 'cr_analysis',
    section: 'cr',
    label: 'Analysis',
    generatorTypes: ['analysis'],
    diagnosticOperation: null,
    stems: [
      'the two portions in boldface play which of the following roles',
      'the argument proceeds by',
      'a technique used in the argument is to',
      'the main point of disagreement between',
    ],
  },
  cr_construction: {
    key: 'cr_construction',
    section: 'cr',
    label: 'Construction',
    generatorTypes: ['assumption', 'inference', 'explain'],
    diagnosticOperation: null,
    stems: [
      'most logically completes',
      'best explains the discrepancy',
      'depends on the assumption that',
      'enables the conclusion to be properly drawn',
    ],
  },
  cr_critique: {
    key: 'cr_critique',
    section: 'cr',
    label: 'Critique',
    generatorTypes: ['weaken', 'strengthen', 'evaluate'],
    diagnosticOperation: null,
    stems: [
      'most vulnerable to the criticism that',
      'most seriously weakens',
      'casts the most serious doubt on',
      'would be most useful to know in order to evaluate',
    ],
  },
  cr_plan: {
    key: 'cr_plan',
    section: 'cr',
    label: 'Plan',
    generatorTypes: ['plan'],
    diagnosticOperation: null,
    stems: [
      'what must be true for a plan to succeed',
      'what conditions would make a plan more or less likely to succeed',
      'what strategy would most help overcome a problem',
    ],
  },
}

// ---------------------------------------------------------------------------
// Combined record + iteration helpers
// ---------------------------------------------------------------------------

export const ALL_VERBAL_SUBTYPES: Record<VerbalSubtypeKey, VerbalSubtypeDef> = {
  ...RC_SUBTYPES,
  ...CR_SUBTYPES,
}

export const ALL_RC_SUBTYPE_KEYS: ReadonlyArray<RcSubtypeKey> = Object.keys(
  RC_SUBTYPES,
) as RcSubtypeKey[]

export const ALL_CR_SUBTYPE_KEYS: ReadonlyArray<CrSubtypeKey> = Object.keys(
  CR_SUBTYPES,
) as CrSubtypeKey[]

export const ALL_VERBAL_SUBTYPE_KEYS: ReadonlyArray<VerbalSubtypeKey> = [
  ...ALL_RC_SUBTYPE_KEYS,
  ...ALL_CR_SUBTYPE_KEYS,
]

/** Subtypes with NO generator types nested under them — known coverage
 *  gaps. Currently empty: every official subtype has at least one
 *  generator type. Computed once at module load. */
export const UNSERVED_SUBTYPES: ReadonlyArray<VerbalSubtypeKey> =
  ALL_VERBAL_SUBTYPE_KEYS.filter(
    (k) => ALL_VERBAL_SUBTYPES[k].generatorTypes.length === 0,
  )

// ---------------------------------------------------------------------------
// Diagnostic skill → canonical subtype mapping
// ---------------------------------------------------------------------------
//
// CR-direct: the diagnostic's two CR-side skills name two subtypes apiece.
// RC-via-tag: the diagnostic's two RC-side skills resolve through each
// RC subtype's `diagnosticOperation` ('stated' | 'inferred') tag.

const DIAGNOSTIC_SKILL_TO_CR_SUBTYPES: Record<
  'Analysis/Critique' | 'Plan/Construct',
  ReadonlyArray<CrSubtypeKey>
> = {
  'Analysis/Critique': ['cr_analysis', 'cr_critique'],
  'Plan/Construct': ['cr_plan', 'cr_construction'],
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Forward lookup: given a section and a generator enum value (e.g. RC
 *  'main_idea' or CR 'weaken'), return the official subtype key it lands
 *  under. Returns null if the value isn't recognized. Section is required
 *  to disambiguate the 'inference' collision (RC and CR both have it). */
export function officialSubtypeForGeneratorType(
  section: VerbalSection,
  generatorType: string,
): VerbalSubtypeKey | null {
  const pool = section === 'rc' ? RC_SUBTYPES : CR_SUBTYPES
  for (const def of Object.values(pool)) {
    if ((def.generatorTypes as ReadonlyArray<string>).includes(generatorType)) {
      return def.key
    }
  }
  return null
}

/** Reverse lookup: given an official subtype key, return the generator
 *  enum values that fall under it. Returns an empty array for any
 *  currently-unserved subtype (see UNSERVED_SUBTYPES). */
export function generatorTypesForOfficialSubtype(
  subtypeKey: VerbalSubtypeKey,
): ReadonlyArray<string> {
  return ALL_VERBAL_SUBTYPES[subtypeKey].generatorTypes
}

/** Maps a diagnostic fundamental skill to the canonical subtypes it
 *  covers. The two CR skills are direct; the two RC skills resolve via
 *  the diagnosticOperation tag on each RC subtype. */
export function canonicalSubtypesForDiagnosticSkill(
  skill: VerbalFundamentalSkill,
): ReadonlyArray<VerbalSubtypeKey> {
  if (skill === 'Analysis/Critique') {
    return DIAGNOSTIC_SKILL_TO_CR_SUBTYPES['Analysis/Critique']
  }
  if (skill === 'Plan/Construct') {
    return DIAGNOSTIC_SKILL_TO_CR_SUBTYPES['Plan/Construct']
  }
  const op: DiagnosticRcOperation =
    skill === 'Identify Stated Idea' ? 'stated' : 'inferred'
  return ALL_RC_SUBTYPE_KEYS.filter(
    (k) => RC_SUBTYPES[k].diagnosticOperation === op,
  )
}

/** Human Title Case label for any subtype key. */
export function displayLabel(key: VerbalSubtypeKey): string {
  return ALL_VERBAL_SUBTYPES[key].label
}

/** Verbatim official-guide stems for a subtype. Data only — not yet
 *  wired into the generator prompts. */
export function stemsForSubtype(key: VerbalSubtypeKey): ReadonlyArray<string> {
  return ALL_VERBAL_SUBTYPES[key].stems
}

/** True if a subtype currently has no generator types under it (a known
 *  coverage gap). */
export function isUnservedSubtype(key: VerbalSubtypeKey): boolean {
  return ALL_VERBAL_SUBTYPES[key].generatorTypes.length === 0
}
