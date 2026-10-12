import {
  buildPostingBlocks,
  buildPostingHtml,
  formatDateLabel,
  groupByDate,
  imageSrcOf,
  sortNewest,
  tagSource,
  toGenerationPayload,
} from '@/lib/newsFeed'
import { NewsItem } from '@/lib/types'

// Dates derived at runtime — never hardcoded
const daysAgo = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const row = (id: string, Date: string, Rank: number): NewsItem => ({
  id, Date, Rank, Topic: 'ai', Title: `t-${id}`, Summary: 's', Image: 'https://img/x.png', Link: 'https://x', created_at: 'c',
})

describe('lib/newsFeed', () => {
  it('sortNewest: Date desc, then Rank asc', () => {
    const rows = [row('a', daysAgo(2), 1), row('b', daysAgo(0), 3), row('c', daysAgo(0), 1), row('d', daysAgo(1), 2)]
    expect(sortNewest(rows).map(r => r.id)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('sortNewest does not mutate input', () => {
    const rows = [row('a', daysAgo(1), 1), row('b', daysAgo(0), 1)]
    sortNewest(rows)
    expect(rows.map(r => r.id)).toEqual(['a', 'b'])
  })

  it('groupByDate keeps sorted order and groups consecutive dates', () => {
    const rows = sortNewest([row('a', daysAgo(1), 1), row('b', daysAgo(0), 2), row('c', daysAgo(0), 1)])
    const groups = groupByDate(rows)
    expect(groups.map(g => g.date)).toEqual([daysAgo(0), daysAgo(1)])
    expect(groups[0].items.map(r => r.id)).toEqual(['c', 'b'])
  })

  it('groupByDate handles empty input', () => {
    expect(groupByDate([])).toEqual([])
  })

  it('formatDateLabel marks the newest date as Latest and keeps the UTC calendar day', () => {
    const latest = daysAgo(0)
    const [, , dd] = latest.split('-')
    expect(formatDateLabel(latest, latest)).toMatch(/^Latest · /)
    expect(formatDateLabel(latest, latest)).toContain(String(Number(dd)))
    expect(formatDateLabel(daysAgo(1), latest)).not.toMatch(/Latest/)
  })

  it('tagSource adds the table name', () => {
    expect(tagSource([row('a', daysAgo(0), 1)], 'job_hire_fire')[0].source).toBe('job_hire_fire')
  })

  it('toGenerationPayload strips Image, id and created_at', () => {
    const [p] = toGenerationPayload([row('a', daysAgo(0), 1)])
    expect(p).toEqual({ Rank: 1, Topic: 'ai', Title: 't-a', Summary: 's', Link: 'https://x', Date: daysAgo(0) })
  })
})

describe('imageSrcOf', () => {
  it('returns http(s) urls unchanged', () => {
    expect(imageSrcOf('http://img/x.png')).toBe('http://img/x.png')
    expect(imageSrcOf('https://img/x.png')).toBe('https://img/x.png')
  })

  it('returns data uris unchanged', () => {
    expect(imageSrcOf('data:image/png;base64,abc123')).toBe('data:image/png;base64,abc123')
  })

  it('pads raw base64 missing padding and adds the data uri prefix', () => {
    // 'abc' is 3 chars (not a multiple of 4), needs one '=' pad char
    expect(imageSrcOf('abc')).toBe('data:image/jpeg;base64,abc=')
  })

  it('returns null for null input', () => {
    expect(imageSrcOf(null)).toBeNull()
  })
})

describe('buildPostingHtml', () => {
  const pick = (section: string, src: string) => ({ item: { Section: section }, src })

  it('inlines each image right after the line matching its section, in order', () => {
    const content = '**AI World of this news**\nbody one\n\n**AI Insights**\nbody two'
    const html = buildPostingHtml(content, [
      pick('AI World of this news', 'https://img/world.png'),
      pick('AI Insights', 'https://img/insights.png'),
    ])
    const worldIdx = html.indexOf('<img src="https://img/world.png"')
    const insightsIdx = html.indexOf('<img src="https://img/insights.png"')
    expect(worldIdx).toBeGreaterThan(-1)
    expect(insightsIdx).toBeGreaterThan(worldIdx)
    expect(html.indexOf('AI World of this news')).toBeLessThan(worldIdx)
  })

  it('escapes HTML-significant characters in the content', () => {
    const html = buildPostingHtml('<script>alert(1)</script> & more', [])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; more')
  })

  it('converts markdown so the paste has no literal ** or #', () => {
    const html = buildPostingHtml('# Title\n**1. AI Insights**\nSome **bold** text\n- one\n- two\n---', [])
    expect(html).toContain('<h3>Title</h3>')
    expect(html).toContain('<h3>1. AI Insights</h3>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(html).toContain('<hr>')
    expect(html).not.toContain('**')
  })
})

describe('buildPostingBlocks', () => {
  const pick = (section: string, src: string) => ({ item: { Section: section, Title: section }, src })
  const four = [
    pick('AI World of this news', 'w'),
    pick('AI tools update of the week', 't'),
    pick('AI Insights', 'i'),
    pick('AI Trending Tool of the week', 'r'),
  ]
  const order = (blocks: ReturnType<typeof buildPostingBlocks>) =>
    blocks.map(b => (b.kind === 'image' ? `IMG:${b.src}` : b.text.split('\n')[0]))

  it('orders heading → image → body for all 4 sections, then the rest', () => {
    const content = [
      'AI Digital Tamizha — Weekly Digest',
      '**1. AI World of this news**', 'world body',
      '**2. AI tools update of the week**', 'tools body',
      '### 3. AI Insights', 'insights body',
      '4. AI Trending Tool of the week:', 'trend body',
      '**5. My point of view**', 'pov body',
    ].join('\n')
    expect(order(buildPostingBlocks(content, four))).toEqual([
      'AI Digital Tamizha — Weekly Digest',
      'IMG:w', 'world body',
      'IMG:t', 'tools body',
      'IMG:i', 'insights body',
      'IMG:r', 'trend body',
    ])
    const blocks = buildPostingBlocks(content, four)
    expect(blocks.filter(b => b.kind === 'image').every(b => b.kind === 'image' && !b.label)).toBe(true)
  })

  it('ignores header lines that merely mention a section name', () => {
    const content = [
      '- Big money is flowing into AI Insights and AI tools update of the week stories',
      '**AI World of this news**', 'w body',
      '**AI tools update of the week**', 't body',
    ].join('\n')
    const blocks = buildPostingBlocks(content, four.slice(0, 2))
    expect(blocks[0].kind === 'text' && blocks[0].text.endsWith('**AI World of this news**')).toBe(true)
    expect(order(blocks).slice(1)).toEqual(['IMG:w', 'w body', 'IMG:t', 't body'])
  })

  it('puts an image with a missing heading just before the next matched heading, labelled', () => {
    const content = ['**AI World of this news**', 'w', 'reworded tools heading', 'tb', '**AI Insights**', 'ib'].join('\n')
    const blocks = buildPostingBlocks(content, four.slice(0, 3))
    const o = order(blocks)
    expect(o.indexOf('IMG:t')).toBe(o.indexOf('**AI Insights**') - 1)
    const t = blocks.find(b => b.kind === 'image' && b.src === 't')
    expect(t && t.kind === 'image' && t.label).toBe(true)
  })

  it('never drops an image when no heading matches at all', () => {
    const blocks = buildPostingBlocks('nothing matches here', four)
    expect(blocks.filter(b => b.kind === 'image')).toHaveLength(4)
  })

  it('groups multiple picked items in the same category under one heading match, in pick order', () => {
    const content = [
      '**3. AI Insights**', 'insights body',
      '**4. AI Trending Tool of the week**', 'trend body',
    ].join('\n')
    const items = [
      pick('AI Insights', 'i1'),
      pick('AI Insights', 'i2'),
      pick('AI Insights', 'i3'),
      pick('AI Trending Tool of the week', 'r1'),
    ]
    const blocks = buildPostingBlocks(content, items)
    expect(order(blocks)).toEqual([
      '**3. AI Insights**',
      'IMG:i1', 'IMG:i2', 'IMG:i3', 'insights body',
      'IMG:r1', 'trend body',
    ])
    expect(blocks.filter(b => b.kind === 'image').every(b => b.kind === 'image' && !b.label)).toBe(true)
  })

  it('keeps a whole multi-item group together when its heading is missing', () => {
    const content = ['**AI World of this news**', 'w', 'reworded insights heading', 'ib', '**AI Trending Tool of the week**', 'rb'].join('\n')
    const items = [pick('AI World of this news', 'w'), pick('AI Insights', 'i1'), pick('AI Insights', 'i2'), pick('AI Trending Tool of the week', 'r')]
    const blocks = buildPostingBlocks(content, items)
    const o = order(blocks)
    expect(o.indexOf('IMG:i1')).toBe(o.indexOf('**AI Trending Tool of the week**') - 2)
    expect(o.indexOf('IMG:i2')).toBe(o.indexOf('**AI Trending Tool of the week**') - 1)
  })
})
