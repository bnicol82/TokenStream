import { describe, expect, it } from 'vitest'
import { classifyProject, parseKeywords } from '../projects'
import type { Project } from '../types'

const project = (id: string, keywords: string[]): Project => ({
  id,
  name: id,
  color: '#5b8dff',
  keywords,
  budget: 0,
  createdAt: 0,
})

describe('classifyProject', () => {
  const projects = [project('tax', ['tax', 'deduction']), project('code', ['refactor', 'bug', 'typescript'])]

  it('returns the project with the most keyword hits', () => {
    expect(classifyProject('Fix this TypeScript bug and refactor the module', projects)).toBe('code')
    expect(classifyProject('What deductions can I claim on my tax return?', projects)).toBe('tax')
  })

  it('is case-insensitive and returns null with no match', () => {
    expect(classifyProject('TAX season is here', projects)).toBe('tax')
    expect(classifyProject('completely unrelated text', projects)).toBeNull()
  })

  it('ignores empty keyword lists', () => {
    expect(classifyProject('anything', [project('empty', [])])).toBeNull()
  })
})

describe('parseKeywords', () => {
  it('splits on commas, trims, and drops empties', () => {
    expect(parseKeywords(' tax, deduction , ,vat')).toEqual(['tax', 'deduction', 'vat'])
    expect(parseKeywords('')).toEqual([])
  })
})
