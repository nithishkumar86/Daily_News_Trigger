import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { GenerateContentBody, Message } from '@/lib/types'

const ALLOWED_FORMATS = ['article', 'newsletter', 'linkedin'] as const

export async function POST(req: NextRequest) {
  try {
    const body: GenerateContentBody = await req.json()
    const { format, selectedItems, refinement, history = [] } = body

    if (!format || !ALLOWED_FORMATS.includes(format as (typeof ALLOWED_FORMATS)[number])) {
      return NextResponse.json({ error: `Invalid format. Must be one of: ${ALLOWED_FORMATS.join(', ')}` }, { status: 400 })
    }

    if (!selectedItems || selectedItems.length === 0) {
      return NextResponse.json({ error: 'selectedItems cannot be empty' }, { status: 400 })
    }

    const formatFilePath = path.join(process.cwd(), 'formats', `${format}.md`)
    if (!fs.existsSync(formatFilePath)) {
      return NextResponse.json({ error: `Format file not found: ${format}.md` }, { status: 400 })
    }
    const systemPrompt = fs.readFileSync(formatFilePath, 'utf8')

    const userContent = selectedItems
      .map(item => `Rank: ${item.rank}\nTitle: ${item.title}\nTopic: ${item.topic}\nSummary: ${item.summary}\nSource: ${item.link}`)
      .join('\n\n---\n\n')

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
      ...history,
    ]

    if (refinement) {
      messages.push({ role: 'user', content: refinement })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://daily-news-trigger.vercel.app',
        'X-Title': 'AI Digital Tamizah',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `OpenRouter error: ${err}` }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const updatedHistory: Message[] = [
      ...history,
      ...(refinement ? [{ role: 'user' as const, content: refinement }] : [{ role: 'user' as const, content: userContent }]),
      { role: 'assistant' as const, content },
    ]

    return NextResponse.json({ content, updatedHistory })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
