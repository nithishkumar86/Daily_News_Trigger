import fs from 'fs'
import path from 'path'

const root = path.join(__dirname, '..')
const dirs = ['app', 'components']

function allSourceFiles(): string[] {
  const files: string[] = []
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) files.push(full)
    }
  }
  for (const d of dirs) walk(path.join(root, d))
  return files
}

describe('theming', () => {
  it('has no leftover hardcoded hex Tailwind color utilities outside globals.css', () => {
    const hexClassRe = /\b(bg|text|border|from|via|to|ring|shadow|divide|placeholder)-\[#[0-9a-fA-F]{3,8}\]/
    const offenders: string[] = []
    for (const file of allSourceFiles()) {
      const content = fs.readFileSync(file, 'utf8')
      if (hexClassRe.test(content)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('defines light and dark CSS variable blocks in globals.css', () => {
    const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8')
    expect(css).toMatch(/:root\s*{[^}]*--bg-primary:\s*#ffffff/)
    expect(css).toMatch(/\.dark\s*{[^}]*--bg-primary:\s*#0d0d1a/)
  })

  it('tailwind darkMode is set to class strategy', () => {
    const config = fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8')
    expect(config).toMatch(/darkMode:\s*['"]class['"]/)
  })

  it('theme init script only ever adds the dark class, never an arbitrary stored value', () => {
    const layout = fs.readFileSync(path.join(root, 'app', 'layout.tsx'), 'utf8')
    expect(layout).toMatch(/stored === 'dark'/)
    expect(layout).not.toMatch(/classList\.add\(stored\)/)
  })
})

describe('comment reply', () => {
  const modal = fs.readFileSync(path.join(root, 'components', 'ContentModal.tsx'), 'utf8')

  it('ContentModal enables the reply box for linkedin, newsletter, and article drafts', () => {
    expect(modal).toMatch(/canReply = format === 'linkedin' \|\| format === 'newsletter' \|\| format === 'article'/)
  })

  it('offers a Professional/Friendly reply mode dropdown and sends it with the request', () => {
    expect(modal).toMatch(/<option value="professional">Professional<\/option>/)
    expect(modal).toMatch(/<option value="friendly">Friendly<\/option>/)
    expect(modal).toMatch(/mode:\s*replyMode/)
  })
})
