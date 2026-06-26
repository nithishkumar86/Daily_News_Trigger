/**
 * Test 1: GET /api/news returns only today's articles
 * Inserts a row dated yesterday directly into Supabase,
 * then asserts the news API does not return it.
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

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Insert a yesterday row
  const { data: inserted, error: insertErr } = await supabase
    .from(TABLE)
    .insert({ Rank: '9', Title: 'Test Old News', Summary: 'Should not appear', Link: 'https://example.com', Date: yesterdayStr })
    .select()
    .single()

  if (insertErr) throw new Error(`Setup insert failed: ${insertErr.message}`)

  try {
    const res = await fetch(`${BASE_URL}/api/news`)
    const json = await res.json()

    assert.strictEqual(json.success, true, 'API should return success:true')

    const hasYesterday = json.data.some(
      (row: { Date: string }) => row.Date === yesterdayStr
    )
    assert.strictEqual(hasYesterday, false, 'API must not return yesterday\'s articles')

    console.log('✅ PASS: /api/news filters to today only')
  } finally {
    // Cleanup: remove the test row
    await supabase.from(TABLE).delete().eq('id', inserted.id)
  }
}

run().catch((err) => {
  console.error('❌ FAIL:', err.message)
  process.exit(1)
})
