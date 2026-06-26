/**
 * Test 2: MCP tools/call send_news inserts a row into Supabase
 * Calls the MCP server, asserts success, then verifies the row in Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import * as assert from 'assert'

const BASE_URL = process.env.TEST_BASE_URL ?? 'https://daily-news-trigger.vercel.app'
const TABLE = process.env.SUPABASE_TABLE_NAME ?? 'Dialy_News_Trigger'

async function run() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const testTitle = `MCP Test ${Date.now()}`

  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'send_news',
        arguments: {
          Rank: '1',
          Title: testTitle,
          Summary: 'Test summary for MCP insert validation.',
          Link: 'https://example.com/mcp-test',
          Date: today,
        },
      },
    }),
  })

  const json = await res.json()
  assert.strictEqual(res.status, 200, 'MCP should return HTTP 200')
  assert.ok(!json.result?.isError, 'MCP result should not have isError')

  const parsed = JSON.parse(json.result.content[0].text)
  assert.strictEqual(parsed.success, true, 'send_news should return success:true')
  const insertedId = parsed.data.id

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', insertedId)
      .single()

    assert.ok(!error, `Supabase lookup should not error: ${error?.message}`)
    assert.strictEqual(data.Title, testTitle, 'Title in DB should match what was sent')
    assert.strictEqual(data.Rank, '1', 'Rank in DB should be "1"')

    console.log('✅ PASS: MCP send_news inserts correctly into Supabase')
  } finally {
    await supabase.from(TABLE).delete().eq('id', insertedId)
  }
}

run().catch((err) => {
  console.error('❌ FAIL:', err.message)
  process.exit(1)
})
