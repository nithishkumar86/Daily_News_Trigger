import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { Message } from '@/lib/types'

const ALLOWED_FORMATS = ['article', 'newsletter', 'linkedin'] as const
type Format = (typeof ALLOWED_FORMATS)[number]

// Newsletter is a 10-section, multi-item digest — it needs more items, tokens and time
const FORMAT_CONFIG: Record<Format, { maxItems: number; maxTokens: number; timeoutMs: number; maxHistoryChars: number }> = {
  article:    { maxItems: 20, maxTokens: 2048, timeoutMs: 30_000, maxHistoryChars: 10_000 },
  linkedin:   { maxItems: 20, maxTokens: 2048, timeoutMs: 30_000, maxHistoryChars: 10_000 },
  newsletter: { maxItems: 30, maxTokens: 4096, timeoutMs: 55_000, maxHistoryChars: 40_000 },
}
const MAX_REFINEMENT_LENGTH = 2000
const MAX_HISTORY_LENGTH = 20

// Vercel function limit — must exceed the longest per-format timeout
export const maxDuration = 60

// Cache static format files after first read — they never change at runtime
const formatCache = new Map<string, string>()

async function getFormatPrompt(format: string): Promise<string | null> {
  if (formatCache.has(format)) return formatCache.get(format)!
  try {
    const filePath = path.join(process.cwd(), 'formats', `${format}.md`)
    const content = await readFile(filePath, 'utf8')
    formatCache.set(format, content)
    return content
  } catch {
    return null
  }
}

// Strip newlines from item fields to prevent prompt delimiter injection, and cap length
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max)

export async function POST(req: NextRequest) {
  // API key guard first — before any I/O
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
  }

  try {
    // Parse body at runtime — req.json() returns unknown
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { format, selectedItems, refinement, history } = rawBody as Record<string, unknown>

    // Validate format against allowlist (also guards the path.join below)
    if (!format || !ALLOWED_FORMATS.includes(format as Format)) {
      return NextResponse.json({ error: `Invalid format. Must be one of: ${ALLOWED_FORMATS.join(', ')}` }, { status: 400 })
    }
    const config = FORMAT_CONFIG[format as Format]

    // Validate selectedItems
    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      return NextResponse.json({ error: 'selectedItems cannot be empty' }, { status: 400 })
    }
    if (selectedItems.length > config.maxItems) {
      return NextResponse.json({ error: `Too many items. Maximum is ${config.maxItems}.` }, { status: 400 })
    }

    // Cap refinement length
    const refinementStr = typeof refinement === 'string'
      ? refinement.slice(0, MAX_REFINEMENT_LENGTH)
      : undefined

    // Validate history — whitelist roles to user/assistant, validate content type, cap length
    const rawHistory = Array.isArray(history) ? history : []
    if (rawHistory.length > MAX_HISTORY_LENGTH) {
      return NextResponse.json({ error: `History too long. Maximum is ${MAX_HISTORY_LENGTH} messages.` }, { status: 400 })
    }
    const safeHistory: Message[] = rawHistory
      .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
        m !== null &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string'
      )
      .map(m => ({ role: m.role, content: m.content.slice(0, config.maxHistoryChars) }))

    // Load format prompt — async read, cached after first call
    const systemPrompt = await getFormatPrompt(format as string)
    if (!systemPrompt) {
      return NextResponse.json({ error: `Format file not found: ${format}.md` }, { status: 400 })
    }

    // Build user content — fields sanitized to strip newline-based prompt injection
    const userContent = selectedItems
      .map((item: unknown) => {
        const i = item as Record<string, unknown>
        const section = clean(i.Section, 60)
        const sectionLine = section ? `Section: ${section}\n` : ''
        return `Rank: ${clean(i.Rank, 10)}\nDate: ${clean(i.Date, 10)}\n${sectionLine}Title: ${clean(i.Title, 300)}\nTopic: ${clean(i.Topic, 50)}\nSummary: ${clean(i.Summary, 2000)}\nSource: ${clean(i.Link, 500)}`
      })
      .join('\n\n---\n\n')

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
      ...safeHistory,
    ]

    if (refinementStr) {
      messages.push({ role: 'user', content: refinementStr })
    }

    // OpenRouter fetch with hard timeout to prevent indefinite function lock-up
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

    let response: Response
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://daily-news-trigger.vercel.app',
          'X-Title': 'AI Digital Tamizah',
        },
        body: JSON.stringify({
          model: 'openai/gpt-6-luna',
          messages,
          temperature: 0.7,
          max_tokens: config.maxTokens,
        }),
        signal: controller.signal,
      })
    } catch (fetchErr) {
      if ((fetchErr as Error).name === 'AbortError') {
        return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
      }
      throw fetchErr
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenRouter error:', response.status, errText)
      return NextResponse.json({ error: 'Content generation failed. Please try again.' }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    // 'length' means the model hit max_tokens — the output is cut off mid-way
    const truncated = data.choices?.[0]?.finish_reason === 'length'

    if (!content || typeof content !== 'string') {
      console.error('OpenRouter returned no content:', JSON.stringify(data))
      return NextResponse.json({ error: 'No content returned from model. Please try again.' }, { status: 502 })
    }

    const updatedHistory: Message[] = [
      ...safeHistory,
      ...(refinementStr
        ? [{ role: 'user' as const, content: refinementStr }]
        : [{ role: 'user' as const, content: userContent }]),
      { role: 'assistant' as const, content },
    ]

    return NextResponse.json({ content, updatedHistory, ...(truncated ? { truncated: true } : {}) })
  } catch (err) {
    console.error('generate-content unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
