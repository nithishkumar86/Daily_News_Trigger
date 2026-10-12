import { readFileSync } from 'fs'
import path from 'path'

const read = (name: string) => readFileSync(path.join(__dirname, '..', 'formats', `${name}.md`), 'utf8')

describe('formats/image-prompt.md', () => {
  const md = read('image-prompt')

  it('defines one prompt per newsletter section plus the article hero', () => {
    for (const key of ['world', 'tools', 'insights', 'trending']) expect(md).toMatch(new RegExp(`\\|\\s*${key}\\s*\\|`))
    expect(md).toContain('TOP 5 AI NEWS OF THE WORLD')
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
    expect(md).toContain('AI METER')
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
