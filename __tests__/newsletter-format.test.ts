import { readFileSync } from 'fs'
import path from 'path'

const md = readFileSync(path.join(__dirname, '..', 'formats', 'newsletter.md'), 'utf8')
const structure = md.slice(md.indexOf('STRUCTURE'), md.indexOf('SECTION:'))
const reference = md.slice(md.indexOf('REFERENCE'), md.indexOf('WRITING RULES'))

const SECTIONS = [
  'Top N AI World News',
  'Top N AI Tool Updates',
  'Top N AI Insights',
  'AI Trending Tool of the Week',
  'Closing',
]

describe('formats/newsletter.md', () => {
  it('defines the manager\'s sections in the required order', () => {
    const positions = SECTIONS.map(s => structure.indexOf(s))
    positions.forEach((pos, i) => expect({ section: SECTIONS[i], found: pos >= 0 }).toEqual({ section: SECTIONS[i], found: true }))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('maps every picker Section tag to its section', () => {
    for (const tag of ['AI World of this news', 'AI tools update of the week', 'AI Insights', 'AI Trending Tool of the week']) {
      expect(md).toContain(`Section is "${tag}"`)
    }
  })

  it('requires all five audience use cases under the trending tool', () => {
    for (const a of ['For students:', 'For freelancers:', 'For working professionals:', 'For business owners:', 'For real estate professionals:']) {
      expect(md).toContain(a)
    }
    expect(md).toMatch(/All five audience lines are required/)
  })

  it('keeps the footer and the writing rules', () => {
    expect(md).toContain('Learn AI. Apply AI. Grow with AI.')
    expect(md).toContain('Are You Ready to Dominate AI?')
    expect(md).toContain('No emojis.')
    expect(md).toMatch(/No hyphens or dashes/)
    expect(md).toMatch(/No asterisks/)
    expect(md).toMatch(/Never invent/)
  })

  it('reference edition itself follows the rules (no emoji, asterisks or dashes outside product names)', () => {
    expect(reference).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(reference).not.toContain('*')
    expect(reference).not.toMatch(/[–—]/)
    expect(reference.replace(/^-{3,}$/gm, '').replace(/GPT-5\.6/g, '')).not.toContain('-')
  })
})
