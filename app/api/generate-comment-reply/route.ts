import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { Message, ReplyMode } from '@/lib/types'

// Same Groq endpoint and model already used for LinkedIn/newsletter generation in
// /api/generate-content — kept as a local constant here too, matching that route's style.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'openai/gpt-oss-120b'
const TIMEOUT_MS = 20_000
const MAX_TOKENS = 200

// Matches lib/contentPipeline.ts MAX_CONTENT_CHARS — the real ceiling on stored
// newsletter job content, so a full persisted newsletter edition always fits.
const MAX_POST_CHARS = 60_000
const MAX_COMMENT_CHARS = 2_000
const MAX_NAME_CHARS = 100
const DEFAULT_MODE: ReplyMode = 'friendly'
const VALID_MODES: ReplyMode[] = ['professional', 'friendly']

export const maxDuration = 30

let formatPromptCache: string | null = null

async function getFormatPrompt(): Promise<string | null> {
  if (formatPromptCache) return formatPromptCache
  try {
    const filePath = path.join(process.cwd(), 'formats', 'comment-reply.md')
    const content = await readFile(filePath, 'utf8')
    formatPromptCache = content
    return content
  } catch {
    return null
  }
}

// The pasted comment is a single remark, not a multi-field record — strip newlines
// (prompt delimiter injection) and cap length. Mirrors generate-content's clean().
const cleanComment = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max)

// Post/edition text keeps its newlines (a newsletter's structure depends on them) —
// only trimmed and length capped.
const cleanPost = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

// Dash-like characters (en dash, em dash, minus sign, horizontal bar) — always stripped.
const DASH_CHARS = /[‐‑‒–—―−]/g
// An ASCII hyphen used as punctuation: surrounded by whitespace or at a line boundary.
// A hyphen inside a word (GPT-4o, gpt-oss-120b) has no whitespace on either side and is
// left untouched.
const SPACED_HYPHEN = /(?<=^|\s)-(?=\s|$)/gm
// Emoji pictographs plus the variation-selector and ZWJ used in emoji sequences.
const EMOJI = /[\p{Extended_Pictographic}️‍]/gu

// Defense in depth: guarantees the no-emoji/no-dash rule holds even if the model slips.
function sanitizeReply(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(DASH_CHARS, ' ')
    .replace(SPACED_HYPHEN, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim()
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Verified live: the "no dashes" instruction makes the model drop the hyphen from real
// product/model names too (GPT-4o -> GPT 4o), even when the prompt explicitly says not
// to. Restore it deterministically from names that actually appear in the post itself —
// never a fixed or invented name list, so this can't introduce a hyphen that isn't real.
function restoreHyphenatedNames(reply: string, post: string): string {
  const names = post.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g) ?? []
  let out = reply
  for (const name of new Set(names)) {
    const spaced = name.replace(/-/g, ' ')
    if (spaced === name) continue
    out = out.replace(new RegExp(`\\b${escapeRegExp(spaced)}\\b`, 'gi'), name)
  }
  return out
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
  }

  try {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { postContent, comment, name, mode } = rawBody as Record<string, unknown>

    if (typeof postContent !== 'string' || !postContent.trim()) {
      return NextResponse.json({ error: 'postContent is required' }, { status: 400 })
    }
    if (postContent.length > MAX_POST_CHARS) {
      return NextResponse.json({ error: `postContent too long. Maximum is ${MAX_POST_CHARS} characters.` }, { status: 400 })
    }
    if (typeof comment !== 'string' || !comment.trim()) {
      return NextResponse.json({ error: 'comment is required' }, { status: 400 })
    }
    if (name !== undefined && typeof name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
    }
    if (mode !== undefined && !VALID_MODES.includes(mode as ReplyMode)) {
      return NextResponse.json({ error: `mode must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 })
    }

    const cleanedPost = cleanPost(postContent, MAX_POST_CHARS)
    const cleanedComment = cleanComment(comment, MAX_COMMENT_CHARS)
    // Optional — an empty/whitespace-only name is treated the same as no name.
    const cleanedName = cleanComment(name, MAX_NAME_CHARS)
    const cleanedMode: ReplyMode = (mode as ReplyMode) ?? DEFAULT_MODE

    const systemPrompt = await getFormatPrompt()
    if (!systemPrompt) {
      return NextResponse.json({ error: 'Format file not found: comment-reply.md' }, { status: 500 })
    }

    const userContent =
      `=== POST START ===\n${cleanedPost}\n=== POST END ===\n\n` +
      `=== NAME START ===\n${cleanedName}\n=== NAME END ===\n\n` +
      `=== MODE START ===\n${cleanedMode}\n=== MODE END ===\n\n` +
      `=== COMMENT START ===\n${cleanedComment}\n=== COMMENT END ===`

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.6,
          max_tokens: MAX_TOKENS,
          reasoning_effort: 'low',
          include_reasoning: false,
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
      console.error('Groq error:', response.status, errText)
      return NextResponse.json({ error: 'Reply generation failed. Please try again.' }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content || typeof content !== 'string') {
      console.error('Groq returned no content:', JSON.stringify(data))
      return NextResponse.json({ error: 'No reply returned from model. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ reply: restoreHyphenatedNames(sanitizeReply(content), cleanedPost) })
  } catch (err) {
    console.error('generate-comment-reply unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
