import { ContentJob, ImageJob, jobStage, toSectionImages } from '@/lib/pipelineView'
import { buildPostingBlocks, NEWSLETTER_SECTIONS } from '@/lib/newsFeed'

const job = (over: Partial<ContentJob> = {}): ContentJob => ({
  id: 'j1', kind: 'newsletter', items: [], status: 'written', content: 'text', error: null, created_at: '2026-10-12T05:00:00Z', ...over,
})
const img = (section_key: string, over: Partial<ImageJob> = {}): ImageJob => ({
  id: `i-${section_key}`, job_id: 'j1', section_key, title: `TOP 5 ${section_key}`, status: 'done',
  image_url: `https://cdn/x/${section_key}.png`, error: null, ...over,
})
const all4 = ['world', 'tools', 'insights', 'trending'].map(k => img(k))

describe('jobStage', () => {
  it.each([
    ['pending', { status: 'pending' as const }, [], 'Waiting for Claude', 'waiting', false],
    ['writing', { status: 'writing' as const }, [], 'Claude is writing', 'working', false],
    ['failed', { status: 'failed' as const, error: 'bad items' }, [], 'Failed: bad items', 'failed', false],
  ])('%s job', (_l, over, images, label, tone, canOpen) => {
    expect(jobStage(job(over), images)).toMatchObject({ label, tone, canOpen })
  })

  it('written newsletter progresses from waiting → drawing → ready', () => {
    expect(jobStage(job(), [])).toMatchObject({ label: 'Waiting for images 0/4', tone: 'waiting', canOpen: true })
    const some = [img('world'), img('tools', { status: 'generating', image_url: null })]
    expect(jobStage(job(), some)).toMatchObject({ label: 'Codex is drawing 1/4', tone: 'working' })
    expect(jobStage(job(), all4)).toMatchObject({ label: 'Ready', tone: 'ready', imagesDone: 4, imagesTotal: 4 })
  })

  it('article is ready with its single hero image', () => {
    expect(jobStage(job({ kind: 'article' }), [img('hero')])).toMatchObject({ label: 'Ready', imagesTotal: 1 })
  })

  it('surfaces a failed image but still lets the text open', () => {
    const s = jobStage(job(), [img('world'), img('tools', { status: 'failed', image_url: null, error: 'model refused' })])
    expect(s).toMatchObject({ tone: 'failed', canOpen: true })
    expect(s.label).toBe('Image failed (1/4): model refused')
  })

  it('ignores images that belong to another job', () => {
    expect(jobStage(job(), all4.map(i => ({ ...i, job_id: 'other' }))).imagesDone).toBe(0)
  })
})

describe('toSectionImages', () => {
  it('returns finished images in canonical section order under their newsletter headings', () => {
    const shuffled = [all4[3], all4[1], all4[0], all4[2], img('hero')]
    expect(toSectionImages(job(), shuffled).map(s => s.item.Section)).toEqual([...NEWSLETTER_SECTIONS])
  })

  it('skips images that are not done yet', () => {
    const r = toSectionImages(job(), [img('world'), img('tools', { status: 'pending', image_url: null })])
    expect(r).toEqual([{ item: { Section: NEWSLETTER_SECTIONS[0], Title: 'TOP 5 world' }, src: 'https://cdn/x/world.png' }])
  })

  it('places each infographic right under its heading in the posted copy', () => {
    const content = [
      'AI Digital Tamizha — Weekly Digest', '',
      '**1. AI World of this news**', 'world body', '',
      '**2. AI tools update of the week**', 'tools body', '',
      '**3. AI Insights**', 'insights body', '',
      '**4. AI Trending Tool of the week**', 'trending body', '',
      '**5. My point of view**', 'pov',
    ].join('\n')
    const blocks = buildPostingBlocks(content, toSectionImages(job(), all4))
    const order = blocks.map(b => (b.kind === 'image' ? `IMG:${b.src.split('/').pop()}` : b.text.split('\n').pop()))
    expect(order).toEqual([
      '**1. AI World of this news**', 'IMG:world.png',
      '**2. AI tools update of the week**', 'IMG:tools.png',
      '**3. AI Insights**', 'IMG:insights.png',
      '**4. AI Trending Tool of the week**', 'IMG:trending.png',
      'pov',
    ])
  })
})
