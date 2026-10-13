import { readFileSync } from 'fs'
import path from 'path'

const read = (name: string) => readFileSync(path.join(__dirname, '..', 'formats', `${name}.md`), 'utf8')

describe('formats/image-prompt.md', () => {
  const md = read('image-prompt')

  it('defines one prompt per newsletter section plus the article hero', () => {
    for (const key of ['world', 'tools', 'insights', 'trending']) expect(md).toMatch(new RegExp(`\\|\\s*${key}\\s*\\|`))
    expect(md).toContain('TOP 5 AI WORLD NEWS')
    expect(md).toContain('TOP 5 AI TOOL UPDATES')
    expect(md).toContain('TOP 5 AI INSIGHTS')
    expect(md).toContain('AI TRENDING TOOL OF THE WEEK')
    expect(md).toMatch(/exactly 4 prompts/)
    expect(md).toMatch(/exactly 1 prompt with section_key `hero`/)
  })

  it('encodes the reference infographic layout', () => {
    expect(md).toContain('16:9')
    expect(md).toContain('1536x1024')
    expect(md).toContain('WHY IT MATTERS:')
    expect(md).toContain('BEST USE CASE:')
    expect(md).toMatch(/teal[\s\S]*purple[\s\S]*green[\s\S]*blue[\s\S]*orange/)
  })

  it('article hero is the "Unknown Facts of <tool>" cover from the manager reference', () => {
    const layoutC = md.slice(md.indexOf('## Layout C'), md.indexOf('## Output shape'))
    for (const t of ['"UNKNOWN FACTS OF"', '[COMPANY]', '[TOOL]', '"Hidden Features," / "Powerful Upgrades &" / "What You Didn\'t Know"',
      '"Smarter. Faster." / "More Powerful."', 'lens shaped orb', 'magnifying glass', 'light bulb', 'padlock', '16:9']) {
      expect(layoutC).toContain(t)
    }
    expect(layoutC).toMatch(/ONE AI tool the article is about/)
    expect(layoutC).toMatch(/only if the items name it/)
    expect(layoutC).toMatch(/Never write facts, numbers, scores/)
    expect(layoutC).not.toContain('AI METER')
    expect(layoutC).not.toContain('Students')
    expect(md).toContain('titled "UNKNOWN FACTS OF <COMPANY> <TOOL>"')
  })

  it('Top N images: heading, intro line, one vertical column per story with its why-it-matters explanation (no body paragraph)', () => {
    const layoutA = md.slice(md.indexOf('## Layout A'), md.indexOf('## Layout B'))
    expect(layoutA).toMatch(/stand on its own/)
    expect(layoutA).toMatch(/readable on a phone screen/)
    expect(layoutA).toContain('[INTRO LINE')
    expect(layoutA).toMatch(/\[N\] tall vertical/)
    expect(layoutA).toContain('[LABEL A]: "[TEXT 1A]", [LABEL B]: "[TEXT 1B]"')
    expect(layoutA).not.toMatch(/sentence 1|sentence 2|\[SENTENCE/)
    expect(layoutA).toMatch(/copy word for word/)
    expect(md).toContain('never "TOP 1"')
  })

  it('world, tools and insights share Layout A, each with its own look from the reference images', () => {
    const layoutA = md.slice(md.indexOf('## Layout A'), md.indexOf('## Layout B'))
    for (const key of ['tools', 'insights', 'world']) expect(layoutA).toMatch(new RegExp(`^\\|\\s*${key}\\s*\\|\\s*(bright|gold)`, 'm'))
    expect(layoutA).toMatch(/\|\s*insights\s*\|\s*gold to bright yellow/)
    expect(layoutA).not.toContain('FOR STUDENTS')
  })

  it('trending image is the only one with the five audience use cases, copied word for word', () => {
    const layoutB = md.slice(md.indexOf('## Layout B'), md.indexOf('## Layout C'))
    expect(layoutB).toMatch(/only image with the five audience use cases/)
    for (const t of ['FOR STUDENTS', 'FOR FREELANCERS', 'FOR WORKING PROFESSIONALS', 'FOR BUSINESS OWNERS', 'FOR REAL ESTATE PROFESSIONALS']) expect(layoutB).toContain(t)
    for (const t of ['BEST USE CASES', 'WHY THIS TOOL IS TRENDING', 'AI DOMINATORS TAKEAWAY', 'TRENDING NOW', 'OF THE WEEK']) expect(layoutB).toContain(t)
    expect(layoutB).toMatch(/word for word,\s+all five, never shortened/)
    expect(layoutB).toMatch(/Never invent a feature/)
  })

  it('insight boxes use only fields the newsletter insight has (no invented Why it matters)', () => {
    const row = md.split('\n').find(l => /^\|\s*insights\s*\|\s*WHAT IT MEANS:/.test(l))
    expect(row).toBeDefined()
    expect(row).toContain('AI DOMINATORS TAKEAWAY:')
    expect(row).not.toContain('WHY IT MATTERS')
  })

  it('forbids invented facts and asks for the output shape the MCP expects', () => {
    expect(md).toMatch(/Never invent/)
    expect(md).toContain('"section_key"')
    expect(md).toContain('"title"')
    expect(md).toContain('"prompt"')
  })
})

describe('formats/routine-claude.md', () => {
  const md = read('routine-claude')
  it('drives the writer through every content-mcp tool in order', () => {
    const steps = ['list_pending_content_jobs', 'claim_content_job', 'get_format', 'submit_content', 'fail_content_job']
    const pos = steps.map(s => md.indexOf(s))
    pos.forEach(p => expect(p).toBeGreaterThan(-1))
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1])
    expect(md).toMatch(/not instructions/)
  })
})

describe('formats/routine-codex.md', () => {
  const md = read('routine-codex')
  it('drives the image generator through claim → generate → upload → fail', () => {
    const steps = ['list_pending_image_jobs', 'claim_image_job', '/api/content-mcp/upload?id=', 'fail_image_job']
    const pos = steps.map(s => md.indexOf(s))
    pos.forEach(p => expect(p).toBeGreaterThan(-1))
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThan(pos[i - 1])
    expect(md).toMatch(/Never generate an image for a job that is done/)
  })
})
