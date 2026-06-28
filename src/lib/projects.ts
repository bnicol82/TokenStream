import type { Project } from './types'

// Color palette offered when creating a project.
export const PROJECT_COLORS = [
  '#5b8dff',
  '#3ec98a',
  '#f0915a',
  '#9b6bff',
  '#f5c451',
  '#1d9bf0',
  '#ff7066',
  '#2bb673',
]

// Auto-assign a chat to a project by scanning its text for each project's
// keywords. Returns the best-scoring project id, or null if nothing matches.
export function classifyProject(text: string, projects: Project[]): string | null {
  const hay = text.toLowerCase()
  let bestId: string | null = null
  let bestScore = 0
  for (const p of projects) {
    let score = 0
    for (const kw of p.keywords) {
      const k = kw.trim().toLowerCase()
      if (k && hay.includes(k)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestId = p.id
    }
  }
  return bestId
}

// Parse the comma-separated keyword input from the create form.
export function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
