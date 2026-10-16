import fs from 'fs'
import path from 'path'

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'))

describe('vercel.json', () => {
  // Supabase project nyvjnsndpbqjlzxfnajd is in AWS ap-southeast-1 (Singapore).
  // Functions in the default iad1 paid a US↔Singapore round trip per query.
  it('runs functions in sin1, next to the Supabase database', () => {
    expect(config.regions).toEqual(['sin1'])
  })

  // CLAUDE.md rule 1: all scheduling is external (ChatGPT agent)
  it('never defines cron jobs', () => {
    expect(config.crons).toBeUndefined()
  })
})
