import { FeedItem, NewsItem, TableName } from '@/lib/types'

// Pure helpers for the multi-day news feeds — no React, no Supabase, so they're unit-testable

export const NEWS_COLUMNS = 'id, Rank, Topic, Title, Summary, Image, Link, Date'

// 15 days × ~10–15 ranks per table, well under PostgREST's 1000-row cap
export const FEED_ROW_LIMIT = 300

export const SOURCE_LABEL: Record<TableName, string> = {
  ai_news: 'AI',
  investment_news: 'Invest',
  job_hire_fire: 'Jobs',
  real_estate_news: 'Real Estate',
}

export function tagSource(rows: NewsItem[], source: TableName): FeedItem[] {
  return rows.map(r => ({ ...r, source }))
}

// Newest Date first (YYYY-MM-DD sorts lexically), then Rank ascending
export function sortNewest<T extends NewsItem>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.Date === b.Date ? a.Rank - b.Rank : a.Date < b.Date ? 1 : -1))
}

// Group already-sorted rows by Date, preserving order
export function groupByDate<T extends NewsItem>(rows: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.Date) last.items.push(row)
    else groups.push({ date: row.Date, items: [row] })
  }
  return groups
}

// Lowercase and drop everything but letters/digits, so "Chat GPT", "chat-gpt" and "ChatGPT" compare equal
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// Brand searches ("claude", "chat gpt", "Gemini", or a maker like "anthropic") are STRICT and look at the
// HEADLINE: it must name that brand and no rival lab (the summary only matters for China, see CHINA_PLACES). Summaries name rival models in passing
// ("…unlike Claude…"), and two-lab headlines ("OpenAI and Anthropic…") belong to neither filter.
// Aliases are whole words ("nano banana" = consecutive words); a trailing * is a prefix ("gpt*" → GPT-4o).
// Plain "google" is deliberately not a Gemini alias: most Google stories aren't about Gemini.
// "chineseai" is the CHINESE AI bucket (see CHINESE_AI); its aliases here are only what can be typed to open it.
export const BRAND_ALIASES: Record<string, string[]> = {
  claude: ['claude', 'anthropic'],
  chatgpt: ['chatgpt', 'openai', 'open ai', 'gpt*'],
  gemini: ['gemini', 'nano banana'],
  meta: ['meta', 'llama*'],
  nvidia: ['nvidia', 'nemotron'],
  chineseai: ['chinese ai', 'chinese', 'china', 'moonshot'],
}

// Any Chinese model, lab or China-wide headline goes to Chinese AI — even one that also names Claude or
// NVIDIA ("Chinese labs distilled Claude") — and never to any other brand.
const CHINESE_AI = [
  'moonshot', 'kimi', 'china', 'chinese', 'deepseek', 'qwen', 'alibaba', 'baidu', 'ernie',
  'minimax', 'zhipu', 'glm*', 'bytedance', 'doubao', 'tencent', 'hunyuan',
]
// A US-brand headline whose SUMMARY is about China ("…diverted Nvidia AI servers to China…") is China
// news too → Chinese AI only. Places, not lab names: a summary that just lists a Chinese model among
// test subjects ("…GLM and others…") doesn't make an Anthropic research story Chinese.
const CHINA_PLACES = ['china', 'chinese', 'beijing']
// Non-Chinese labs with no filter of their own — naming one makes a headline "not only <brand>"
const OTHER_LABS = ['grok', 'xai', 'mistral']

const US_BRAND_ALIASES = Object.entries(BRAND_ALIASES).filter(([b]) => b !== 'chineseai').flatMap(([, a]) => a)

const titleWords = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

function hasAlias(words: string[], alias: string): boolean {
  const prefix = alias.endsWith('*')
  const parts = titleWords(alias)
  return words.some((_, i) =>
    parts.every((p, j) => {
      const w = words[i + j]
      return w !== undefined && (prefix && j === parts.length - 1 ? w.startsWith(p) : w === p)
    })
  )
}

function brandFor(query: string): string | null {
  const q = compact(query)
  if (!q) return null
  return Object.keys(BRAND_ALIASES).find(b => BRAND_ALIASES[b].some(a => compact(a) === q)) ?? null
}

function matchesBrand(title: string, summary: string, brand: string): boolean {
  const words = titleWords(title)
  const summaryWords = titleWords(summary)
  const chinese =
    CHINESE_AI.some(a => hasAlias(words, a)) ||
    (US_BRAND_ALIASES.some(a => hasAlias(words, a)) && CHINA_PLACES.some(a => hasAlias(summaryWords, a)))
  if (brand === 'chineseai') return chinese
  if (chinese || !BRAND_ALIASES[brand].some(a => hasAlias(words, a))) return false
  const rivals = [
    ...Object.entries(BRAND_ALIASES).filter(([b]) => b !== brand && b !== 'chineseai').flatMap(([, aliases]) => aliases),
    ...OTHER_LABS,
  ]
  return !rivals.some(a => hasAlias(words, a))
}

// Topic-tab search. A brand name → strict headline-only brand match (above). Anything else → every
// whitespace-separated term must appear in the Title, Summary or Topic. Plain string checks —
// no regex is ever built from the user's text. Empty query matches all.
export function matchesQuery(item: Pick<NewsItem, 'Title' | 'Summary' | 'Topic'>, query: string): boolean {
  const brand = brandFor(query)
  if (brand) return matchesBrand(item.Title ?? '', item.Summary ?? '', brand)
  const terms = query.split(/\s+/).map(compact).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = compact(`${item.Title ?? ''} ${item.Summary ?? ''} ${item.Topic ?? ''}`)
  return terms.every(t => haystack.includes(t))
}

const dateFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// Dates are calendar dates — format in UTC so no viewer timezone shifts them a day.
// The newest group is labelled "Latest" (never "Today": the newest batch may be from yesterday).
export function formatDateLabel(date: string, latestDate: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const label = Number.isNaN(d.getTime()) ? date : dateFmt.format(d)
  return date === latestDate ? `Latest · ${label}` : label
}

// Only the fields the generator reads — never send images or ids to the API.
// Section is optional: the newsletter wizard tags each of its 4 picks with the
// exact heading it was picked for, so the model doesn't have to re-guess the mapping.
export function toGenerationPayload(items: Array<NewsItem & { Section?: string }>) {
  return items.map(({ Rank, Topic, Title, Summary, Link, Date, Section }) =>
    Section ? { Rank, Topic, Title, Summary, Link, Date, Section } : { Rank, Topic, Title, Summary, Link, Date }
  )
}

// Canonical newsletter section order — the newsletter wizard's 4 picks and the
// content modal's multi-image rendering both key off this exact order/labels.
export const NEWSLETTER_SECTIONS = [
  'AI World of this news',
  'AI tools update of the week',
  'AI Insights',
  'AI Trending Tool of the week',
] as const

// Decode a stored Image value into a renderable <img src>. Consolidates the
// base64/data-uri/http(s) decode logic previously duplicated in ContentModal,
// NewsCard and NewsPickRow.
export function imageSrcOf(image: string | null): string | null {
  if (!image) return null
  if (image.startsWith('data:') || image.startsWith('http://') || image.startsWith('https://')) return image
  const stripped = image.replace(/=+$/, '')
  const pad = stripped.length % 4
  return `data:image/jpeg;base64,${pad === 0 ? stripped : stripped + '='.repeat(4 - pad)}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

export type SectionImage = { item: { Section: string; Title?: string }; src: string }

// The fixed "Thanks for Reading & Sharing!" image every pipeline newsletter ends with.
// Served from /public; the caller passes an absolute URL so it survives a paste.
export const NEWSLETTER_CTA_PATH = '/newsletter-cta.jpg'
export const NEWSLETTER_CTA_SECTION = 'Thanks for Reading & Sharing!'
export type CtaImage = { src: string; alt: string }

const normLine = (line: string) => line.replace(/[#>*_]/g, '').trim().toLowerCase()

// Line the CTA image goes above: the closing "Learn AI. Apply AI. Grow with AI."
// (the LAST one, since the intro ends with the same line), else "Are You Ready to
// Dominate AI?", else -1 (end of the post).
function ctaAnchor(lines: string[]): number {
  for (const target of ['learn ai. apply ai. grow with ai.', 'are you ready to dominate ai?']) {
    for (let j = lines.length - 1; j >= 0; j--) if (normLine(lines[j]) === target) return j
  }
  return -1
}

export type PostingBlock =
  | { kind: 'text'; text: string }
  // label: true when the section's heading wasn't found in the text, so the
  // section name must be shown above the image instead
  | { kind: 'image'; section: string; src: string; alt: string; label: boolean }

// The headings formats/newsletter.md now asks for ("Top 5 AI Tool Updates", or
// "AI Tool Update" for a single item), mapped to the canonical section they head.
const SECTION_HEADING_ALIASES: Record<string, RegExp> = {
  'ai world of this news': /^(top \d+ )?ai world news$/,
  'ai tools update of the week': /^(top \d+ )?ai tool updates?$/,
  'ai insights': /^(top \d+ )?ai insights?$/,
}

// A line is a section heading only if, once markdown (#, **, numbering like "1.")
// is stripped, it IS the section name (or starts with it and is short) or one of
// its aliases. A body or header-bullet line that merely mentions "AI Insights" never matches.
function isSectionHeading(line: string, section: string): boolean {
  const norm = line
    .replace(/^[\s#>*_]+/, '')
    .replace(/^\d+\s*[.)]\s*/, '')
    .replace(/^[\s*_]+/, '')
    .replace(/[\s*_:]+$/, '')
    .toLowerCase()
  const s = section.toLowerCase()
  return norm === s || (norm.startsWith(s) && norm.length <= s.length + 20) || !!SECTION_HEADING_ALIASES[s]?.test(norm)
}

// Splits the generated newsletter into ordered blocks: heading 1 → image(s) 1 →
// body 1 → heading 2 → image(s) 2 → … → the rest. A section can carry more than
// one picked item (the manager may add up to 5 per category), so images are
// grouped by Section first — one heading match per section, all of that
// section's images inserted together, in pick order. Groups are matched to
// headings in canonical order, forward-only. A group whose heading is missing
// (e.g. reworded by a refinement) goes just before the next matched heading so
// the order is kept; if no later heading matched, before "My point of view" or
// at the end. No picked image is ever dropped. Drives both the modal view and the copy.
// cta (pipeline newsletters only) goes just above the closing tagline, see ctaAnchor.
export function buildPostingBlocks(content: string, sectionImages: SectionImage[], cta?: CtaImage): PostingBlock[] {
  const lines = content.split('\n')

  const groups: { section: string; images: SectionImage[] }[] = []
  for (const si of sectionImages) {
    const existing = groups.find(g => g.section === si.item.Section)
    if (existing) existing.images.push(si)
    else groups.push({ section: si.item.Section, images: [si] })
  }

  const headingIdx: number[] = []
  let cursor = 0
  for (const g of groups) {
    let found = -1
    for (let j = cursor; j < lines.length; j++) {
      if (isSectionHeading(lines[j], g.section)) { found = j; break }
    }
    headingIdx.push(found)
    if (found !== -1) cursor = found + 1
  }

  const after = new Map<number, PostingBlock[]>()
  const before = new Map<number, PostingBlock[]>()
  const atEnd: PostingBlock[] = []
  const push = (map: Map<number, PostingBlock[]>, k: number, b: PostingBlock) =>
    map.set(k, [...(map.get(k) ?? []), b])

  groups.forEach((g, i) => {
    const blocks = g.images.map(({ item, src }) => ({
      kind: 'image' as const,
      section: item.Section,
      src,
      alt: item.Title ?? item.Section,
    }))
    if (headingIdx[i] !== -1) {
      blocks.forEach(b => push(after, headingIdx[i], { ...b, label: false }))
      return
    }
    const nextMatched = headingIdx.slice(i + 1).find(h => h !== -1)
    const prevMatched = Math.max(-1, ...headingIdx.slice(0, i))
    const pov = lines.findIndex((l, j) => j > prevMatched && isSectionHeading(l, 'My point of view'))
    const anchor = nextMatched ?? (pov !== -1 ? pov : -1)
    if (anchor === -1) atEnd.push(...blocks.map(b => ({ ...b, label: true })))
    else blocks.forEach(b => push(before, anchor, { ...b, label: true }))
  })

  if (cta) {
    const b: PostingBlock = { kind: 'image', section: NEWSLETTER_CTA_SECTION, src: cta.src, alt: cta.alt, label: false }
    const anchor = ctaAnchor(lines)
    if (anchor === -1) atEnd.push(b)
    else push(before, anchor, b)
  }

  const blocks: PostingBlock[] = []
  let buf: string[] = []
  const flush = () => {
    if (buf.join('').trim()) blocks.push({ kind: 'text', text: buf.join('\n').replace(/^\n+|\n+$/g, '') })
    buf = []
  }
  lines.forEach((line, j) => {
    if (before.has(j)) { flush(); blocks.push(...before.get(j)!) }
    buf.push(line)
    if (after.has(j)) { flush(); blocks.push(...after.get(j)!) }
  })
  flush()
  blocks.push(...atEnd)
  return blocks
}

// Escape first, then bold + bare links — so no model output can inject markup
function inlineHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/https?:\/\/[^\s<"]+/g, url => `<a href="${url}">${url}</a>`)
}

// Minimal markdown → email-safe HTML (headings, whole-line bold headings,
// bullets, rules, paragraphs) so the paste doesn't show literal ** and #
export function markdownToHtml(text: string): string {
  const out: string[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => { if (para.length) out.push(`<p>${para.join('<br>')}</p>`); para = [] }
  const flushList = () => { if (list.length) out.push(`<ul>${list.join('')}</ul>`); list = [] }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    const boldLine = line.match(/^\*\*([^*]+)\*\*:?$/)
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    if (line === '') { flushPara(); flushList() }
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); flushList(); out.push('<hr>') }
    else if (heading || boldLine) {
      flushPara(); flushList()
      out.push(`<h3>${inlineHtml((heading?.[1] ?? boldLine![1]).replace(/\*\*/g, ''))}</h3>`)
    }
    else if (bullet) { flushPara(); list.push(`<li>${inlineHtml(bullet[1])}</li>`) }
    else { flushList(); para.push(inlineHtml(line)) }
  }
  flushPara(); flushList()
  return out.join('\n')
}

// One clipboard-ready HTML blob in the exact order the modal shows.
// Pure/testable — the clipboard write itself stays in the UI layer.
export function buildPostingHtml(content: string, sectionImages: SectionImage[], cta?: CtaImage): string {
  return buildPostingBlocks(content, sectionImages, cta)
    .map(b =>
      b.kind === 'text'
        ? markdownToHtml(b.text)
        : `${b.label ? `<h3>${escapeHtml(b.section)}</h3>\n` : ''}<img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.alt)}" width="100%" style="width:100%;max-width:600px;height:auto;display:block;margin:12px 0" />`
    )
    .join('\n')
}
