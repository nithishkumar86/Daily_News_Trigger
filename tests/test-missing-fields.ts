/**
 * Test 3: MCP send_news with missing Title returns isError
 * Also validates Rank range and URL format rejections (security checks).
 */
import * as assert from 'assert'

const BASE_URL = process.env.TEST_BASE_URL ?? 'https://daily-news-trigger.vercel.app'

async function callMcp(args: Record<string, string>) {
  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'send_news', arguments: args },
    }),
  })
  return res.json()
}

async function run() {
  // Case 1: missing Title
  const r1 = await callMcp({ Rank: '1', Summary: 'test', Link: 'https://example.com' })
  assert.strictEqual(r1.result?.isError, true, 'Missing Title should return isError:true')

  // Case 2: invalid Rank (out of range)
  const r2 = await callMcp({ Rank: '9', Title: 'T', Summary: 'S', Link: 'https://example.com' })
  assert.strictEqual(r2.result?.isError, true, 'Rank "9" should return isError:true')

  // Case 3: invalid URL (no https://)
  const r3 = await callMcp({ Rank: '1', Title: 'T', Summary: 'S', Link: 'not-a-url' })
  assert.strictEqual(r3.result?.isError, true, 'Bad URL should return isError:true')

  console.log('✅ PASS: MCP validation rejects missing fields, bad Rank, bad URL')
}

run().catch((err) => {
  console.error('❌ FAIL:', err.message)
  process.exit(1)
})
