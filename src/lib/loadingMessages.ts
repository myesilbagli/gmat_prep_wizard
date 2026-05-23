/**
 * Rotating status lines for the long generation waits. The component that
 * uses these (src/components/GenerationLoader.tsx) shows the first message
 * for the full interval (so users see an honest "what's happening" line
 * before the personality kicks in), then cycles through. If a generation
 * outlasts the list the cycle loops; the tail messages are written to
 * survive looping without feeling like it restarted.
 *
 * Keep lines short. Dry GMAT humor. No emoji.
 */

export const RC_LOADING_MESSAGES: string[] = [
  'Generating your passage...',
  'Summoning a plausible-sounding scholar...',
  'Giving them a book title...',
  'Making the argument needlessly nuanced...',
  'Adding a sentence you\'ll read twice...',
  'Hiding the main idea in plain sight...',
  'Planting four tempting wrong answers...',
  'Making sure exactly one answer is defensible...',
  'Channeling the Official Guide...',
  'Almost there, just being thorough...',
]

export const CR_LOADING_MESSAGES: string[] = [
  'Generating your CR set...',
  'Constructing five questionable arguments...',
  'Finding the logical gaps...',
  'Building traps that look right...',
  'Making the wrong answers almost work...',
  'Hiding the assumptions...',
  'Checking the logic actually holds...',
  'Letting "evaluate" show up only rarely, as nature intended...',
  'Negotiating with the model about sentence length...',
  'Making it just unfair enough to be realistic...',
  'Five in parallel — still faster than the real exam...',
]
