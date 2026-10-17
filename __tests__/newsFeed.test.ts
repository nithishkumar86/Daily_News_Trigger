import {
  buildPostingBlocks,
  buildPostingHtml,
  formatDateLabel,
  groupByDate,
  imageSrcOf,
  matchesQuery,
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

  it('matches the plain "Top N" headings from formats/newsletter.md', () => {
    const content = [
      'Top 5 AI World News', 'world body',
      'Top 3 AI Tool Updates', 'tools body',
      'AI Insight', 'insights body',
      'AI Trending Tool of the Week', 'trend body',
      'Learn AI. Apply AI. Grow with AI.',
    ].join('\n')
    const blocks = buildPostingBlocks(content, four)
    expect(order(blocks)).toEqual([
      'Top 5 AI World News', 'IMG:w', 'world body',
      'IMG:t', 'tools body',
      'IMG:i', 'insights body',
      'IMG:r', 'trend body',
    ])
    expect(blocks.filter(b => b.kind === 'image').every(b => b.kind === 'image' && !b.label)).toBe(true)
  })

  it('does not treat a body line about top AI tool updates as a heading', () => {
    const content = ['These are the top 5 AI tool updates this week', 'Top 5 AI Tool Updates', 'tools body'].join('\n')
    expect(order(buildPostingBlocks(content, [four[1]]))).toEqual(['These are the top 5 AI tool updates this week', 'IMG:t', 'tools body'])
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

  describe('closing CTA image', () => {
    const cta = { src: 'https://site/newsletter-cta.jpg', alt: 'Thanks for Reading & Sharing!' }
    const tagline = 'Learn AI. Apply AI. Grow with AI.'

    it('goes above the closing tagline, not the identical one that ends the intro', () => {
      const content = ['Intro title', 'intro body', tagline, 'Top 5 AI World News', 'world body', 'closing line', tagline, '', 'Are You Ready to Dominate AI?'].join('\n')
      const blocks = buildPostingBlocks(content, [four[0]], cta)
      const o = order(blocks)
      expect(o).toEqual(['Intro title', 'IMG:w', 'world body', 'IMG:https://site/newsletter-cta.jpg', tagline])
      const ctaBlock = blocks.find(b => b.kind === 'image' && b.src === cta.src)
      expect(ctaBlock && ctaBlock.kind === 'image' && ctaBlock.label).toBe(false)
      expect(buildPostingHtml(content, [four[0]], cta)).toContain('<img src="https://site/newsletter-cta.jpg"')
    })

    it('falls back to "Are You Ready to Dominate AI?", then to the end', () => {
      const ready = buildPostingBlocks(['body', '**Are You Ready to Dominate AI?**'].join('\n'), [], cta)
      expect(order(ready)).toEqual(['body', 'IMG:https://site/newsletter-cta.jpg', '**Are You Ready to Dominate AI?**'])
      expect(order(buildPostingBlocks('just body', [], cta))).toEqual(['just body', 'IMG:https://site/newsletter-cta.jpg'])
    })

    it('is never added unless asked for', () => {
      const content = ['body', tagline].join('\n')
      expect(buildPostingBlocks(content, four).some(b => b.kind === 'image' && b.src === cta.src)).toBe(false)
    })
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

describe('matchesQuery (topic-tab search)', () => {
  const item = (Title: string, Summary = '', Topic = 'ai') => ({ Title, Summary, Topic })

  it('empty or whitespace query matches everything', () => {
    expect(matchesQuery(item('anything'), '')).toBe(true)
    expect(matchesQuery(item('anything'), '   ')).toBe(true)
  })

  it('is case-insensitive on Title', () => {
    expect(matchesQuery(item('Anthropic ships CLAUDE 5'), 'claude')).toBe(true)
    expect(matchesQuery(item('Anthropic ships Claude 5'), 'CLAUDE')).toBe(true)
  })

  it('non-brand searches match Summary-only and Topic-only hits', () => {
    expect(matchesQuery(item('Startup raises Series B', 'The round was led by Sequoia funding'), 'sequoia')).toBe(true)
    expect(matchesQuery(item('x', 'y', 'models'), 'models')).toBe(true)
  })

  describe('brand filters (Claude / ChatGPT / Gemini) — headline only, no other models', () => {
    // Real headlines + summaries from ai_news
    it('Claude: Claude or Anthropic in the headline', () => {
      expect(matchesQuery(item('Claude Helps Explain Long-Mysterious ECDSA Curve Seeds'), 'claude')).toBe(true)
      expect(matchesQuery(item('Anthropic Replaces Git Internally for AI-Scale Coding'), 'Claude')).toBe(true)
      expect(matchesQuery(item('X Bundles Cursor With Grok and Premium', 'Cursor also offers Claude models'), 'claude')).toBe(false)
      expect(matchesQuery(item('Exabeam Expands Nova AI', 'Works with Claude, OpenAI and Codex'), 'claude')).toBe(false)
      expect(matchesQuery(item('Google Debuts Gemini 4 Argon'), 'claude')).toBe(false)
    })

    it('ChatGPT: ChatGPT, OpenAI or GPT in the headline', () => {
      expect(matchesQuery(item('ChatGPT Launches Virtual Clothing Try-On', 'OpenAI vs Google'), 'chatgpt')).toBe(true)
      expect(matchesQuery(item('OpenAI Shortens GPT-4o API Retirement Notice'), 'chat gpt')).toBe(true)
      expect(matchesQuery(item('OpenAI Safety Employee Resigns'), 'ChatGPT')).toBe(true)
      expect(matchesQuery(item('Floqer Automates Sales Research With AI Agents', 'Built on ChatGPT'), 'chatgpt')).toBe(false)
      expect(matchesQuery(item('Mistral Previews Large 4', 'Rivals GPT-6'), 'chatgpt')).toBe(false)
    })

    it('Gemini: Gemini or Nano Banana in the headline — plain Google is not Gemini', () => {
      expect(matchesQuery(item('Four Gemini Agents Beat Minecraft'), 'gemini')).toBe(true)
      expect(matchesQuery(item('Google Nano Banana 2.1 targets product image editing'), 'Gemini')).toBe(true)
      expect(matchesQuery(item('Google opens SynthID media verification site', 'Covers Gemini and Nano Banana'), 'gemini')).toBe(false)
      expect(matchesQuery(item('Lawmakers challenge Google deal for Spirit Airlines'), 'gemini')).toBe(false)
      expect(matchesQuery(item('Anthropic Commits $100 Million', 'Claude, not Gemini'), 'gemini')).toBe(false)
    })

    it('strict: a headline naming a rival lab belongs to neither brand', () => {
      const both = item('FTC Subpoenas OpenAI and Anthropic Over AI Safety Incidents')
      expect(matchesQuery(both, 'claude')).toBe(false)
      expect(matchesQuery(both, 'chatgpt')).toBe(false)
      expect(matchesQuery(item('Claude beats DeepSeek on coding benchmark'), 'claude')).toBe(false)
      expect(matchesQuery(item('Cursor bundles Claude with Grok'), 'claude')).toBe(false)
    })

    it('strict: China-wide headlines never show under Claude / ChatGPT / Gemini / Meta / NVIDIA', () => {
      const cn = item('Chinese labs accused of distilling Claude')
      expect(matchesQuery(cn, 'claude')).toBe(false)
      expect(matchesQuery(item('China blocks NVIDIA H20 sales'), 'nvidia')).toBe(false)
      expect(matchesQuery(item('Meta opens Llama to Chinese developers'), 'meta')).toBe(false)
    })

    it('Meta: Meta or Llama as whole words — not "metadata" / "metabolic"', () => {
      expect(matchesQuery(item('Meta Opens Muse Spark for Local AI Agents'), 'meta')).toBe(true)
      expect(matchesQuery(item("Meta's Llama 5 tops open-weight charts"), 'Meta')).toBe(true)
      expect(matchesQuery(item('Llama4 fine-tunes ship'), 'llama')).toBe(true)
      expect(matchesQuery(item('Startup ships metadata search for AI'), 'meta')).toBe(false)
      expect(matchesQuery(item('AI maps metabolic pathways'), 'meta')).toBe(false)
      expect(matchesQuery(item('Apple tightens disk access', 'Meta and others affected'), 'meta')).toBe(false)
    })

    it('NVIDIA: NVIDIA or Nemotron in the headline', () => {
      expect(matchesQuery(item('NVIDIA Releases Compact Dory 1.0 Looped Language Model'), 'nvidia')).toBe(true)
      expect(matchesQuery(item('New Nemotron agent fits in laptop memory'), 'NVIDIA')).toBe(true)
      expect(matchesQuery(item('CoreWeave Launches Forge', 'Runs on NVIDIA GPUs'), 'nvidia')).toBe(false)
    })

    it('Moonshot = ALL Chinese AI news: any Chinese model, lab or China headline', () => {
      expect(matchesQuery(item('Moonshot AI releases Kimi K3'), 'moonshot')).toBe(true)
      expect(matchesQuery(item('DeepSeek V4 tops open-weight charts'), 'Moonshot')).toBe(true)
      expect(matchesQuery(item('Alibaba Qwen 4 adds agent mode'), 'moonshot')).toBe(true)
      expect(matchesQuery(item('Zhipu GLM-5 launches'), 'moonshot')).toBe(true)
      expect(matchesQuery(item('China Proposes Export Controls on 23 AI Technologies'), 'moonshot')).toBe(true)
      expect(matchesQuery(item('Chinese AI Labs Disclose Few Model Safety Tests'), 'moonshot')).toBe(true)
      expect(matchesQuery(item('Moonshot and DeepSeek trade benchmark wins'), 'moonshot')).toBe(true)
    })

    it('Chinese headlines go to Moonshot even when they name a US brand — and never to that brand', () => {
      const r = item('Chinese labs accused of distilling Claude')
      expect(matchesQuery(r, 'moonshot')).toBe(true)
      expect(matchesQuery(r, 'claude')).toBe(false)
      expect(matchesQuery(item('Moonshot beats Claude on coding'), 'claude')).toBe(false)
      expect(matchesQuery(item('China blocks NVIDIA H20 sales'), 'moonshot')).toBe(true)
    })

    it('a US-brand headline whose summary is about China is China news → Moonshot only', () => {
      const r = item('Contractor Pleads Guilty in Nvidia AI Server Diversion', 'diverted advanced servers containing Nvidia AI chips to China in violation of U.S. export controls')
      expect(matchesQuery(r, 'nvidia')).toBe(false)
      expect(matchesQuery(r, 'moonshot')).toBe(true)
      expect(matchesQuery(item('OpenAI opens office', 'expanding beyond Beijing rivals'), 'chatgpt')).toBe(false)
    })

    it('a Chinese model named only as a test subject in a summary does not make a brand story Chinese', () => {
      const r = item('Anthropic Warns Small AI Models May Soon Self-Replicate', 'Models tested included Qwen and GLM variants')
      expect(matchesQuery(r, 'claude')).toBe(true)
      expect(matchesQuery(r, 'moonshot')).toBe(false)
    })

    it('Moonshot excludes non-brand stories that mention China only in passing', () => {
      expect(matchesQuery(item('Mistral launches Large 4 as Europe’s open-weight frontier contender', 'a European alternative to leading American and Chinese systems'), 'moonshot')).toBe(false)
      expect(matchesQuery(item('State of AI Report 2026 Maps a Global Technology Shift', 'outside the United States and China'), 'moonshot')).toBe(false)
      expect(matchesQuery(item('UK Regulator Secures Privacy Changes From Ten AI Labs', 'Amazon, Anthropic, DeepSeek, Google'), 'moonshot')).toBe(false)
      expect(matchesQuery(item('Anthropic Replaces Git Internally'), 'moonshot')).toBe(false)
    })

    it('typing "chinese" or "china" opens the Moonshot bucket; a lab name stays a normal search', () => {
      expect(matchesQuery(item('DeepSeek V4 tops open-weight charts'), 'chinese')).toBe(true)
      expect(matchesQuery(item('Alibaba Qwen 4 adds agent mode'), 'China')).toBe(true)
      expect(matchesQuery(item('Alibaba Qwen 4 adds agent mode'), 'deepseek')).toBe(false)
    })

    it('typing the maker name gives the same brand filter', () => {
      expect(matchesQuery(item('Anthropic Warns Small AI Models May Self-Replicate'), 'anthropic')).toBe(true)
      expect(matchesQuery(item('OpenAI Dots Pushes AI Beyond the Chatbot'), 'Open AI')).toBe(true)
    })
  })

  it('treats spacing/hyphen variants as the same word', () => {
    const chatgpt = item('OpenAI updates ChatGPT voice')
    expect(matchesQuery(chatgpt, 'chatgpt')).toBe(true)
    expect(matchesQuery(chatgpt, 'chat gpt')).toBe(true)
    expect(matchesQuery(chatgpt, 'chat-gpt')).toBe(true)
    expect(matchesQuery(item('GPT-5 benchmark'), 'gpt5')).toBe(true)
  })

  it('requires every term (AND) and rejects non-matches', () => {
    const r = item('Claude beats Gemini on coding')
    expect(matchesQuery(r, 'claude gemini')).toBe(true)
    expect(matchesQuery(r, 'claude chatgpt')).toBe(false)
    expect(matchesQuery(item('Gemini update'), 'claude')).toBe(false)
  })

  it('tolerates null fields from the DB', () => {
    const r = { Title: 'Claude', Summary: null as unknown as string, Topic: null as unknown as string }
    expect(matchesQuery(r, 'claude')).toBe(true)
    expect(matchesQuery(r, 'gemini')).toBe(false)
  })

  it('regex metacharacters in the query are literal, never a pattern', () => {
    expect(matchesQuery(item('Claude'), '.*')).toBe(true) // strips to empty term set → match all
    expect(matchesQuery(item('Claude'), '(claude')).toBe(true)
    expect(() => matchesQuery(item('x'), '[')).not.toThrow()
  })

  it('combined with a topic filter, keeps newest-first date grouping', () => {
    const rows = sortNewest([
      { ...row('a', daysAgo(1), 1), Title: 'Claude Code update' },
      { ...row('b', daysAgo(0), 2), Title: 'Gemini news' },
      { ...row('c', daysAgo(0), 1), Title: 'Claude 5 launch' },
      { ...row('d', daysAgo(2), 1), Title: 'Claude pricing', Topic: 'tools' },
    ])
    const hits = rows.filter(r => r.Topic === 'ai' && matchesQuery(r, 'claude'))
    const groups = groupByDate(hits)
    expect(groups.map(g => g.date)).toEqual([daysAgo(0), daysAgo(1)])
    expect(groups.flatMap(g => g.items.map(i => i.id))).toEqual(['c', 'a'])
  })
})
