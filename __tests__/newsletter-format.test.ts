import { readFileSync } from 'fs'
import path from 'path'

const md = readFileSync(path.join(__dirname, '..', 'formats', 'newsletter.md'), 'utf8')

const SECTIONS = [
  '**1. AI World of this news**',
  '**2. AI tools update of the week**',
  '**3. AI Insights**',
  '**4. AI Trending Tool of the week**',
  '**5. My point of view**',
  '**6. Students**',
  '**7. Business**',
  '**8. Freelancers**',
  '**9. Working professionals**',
  '**10. Real estate**',
]

describe('formats/newsletter.md', () => {
  it('defines all 10 sections in the required order', () => {
    const positions = SECTIONS.map(s => md.indexOf(s))
    positions.forEach((pos, i) => expect({ section: SECTIONS[i], found: pos >= 0 }).toEqual({ section: SECTIONS[i], found: true }))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('keeps header, footer and tone rules', () => {
    expect(md).toContain('AI Digital Tamizha — Weekly Digest')
    expect(md).toContain('Learn AI. Apply AI. Grow with AI.')
    expect(md).toContain("Don't include Emoji's")
    expect(md).toContain("Don't use hypens")
    expect(md).toMatch(/never invent/i)
  })
})
