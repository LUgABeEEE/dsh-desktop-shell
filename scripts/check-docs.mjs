// Guard against a markdown corruption class that has already shipped once:
// the first character of a token silently replaced by a control code
// (a -> BEL, ` -> TAB, f -> FF). Normal diffs hide it because the line still
// "looks" right, and the damage only shows up as a garbled word.
//
// Usage: node scripts/check-docs.mjs [files...]
// Exits 1 when any file has stray control characters, unbalanced code fences,
// or a missing trailing newline.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const files = process.argv.length > 2 ? process.argv.slice(2) : ['README.md', 'PLAN.md', 'DEVLOG.md', 'CHANGELOG.md']

let failures = 0

for (const file of files) {
  let text
  try {
    text = readFileSync(resolve(file), 'utf8')
  } catch {
    console.error(`SKIP  ${file} (not found)`)
    continue
  }

  const control = new Set()
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 32 && ch !== '\n' && ch !== '\t') control.add(`0x${code.toString(16)}`)
    else if (code === 0x7f) control.add('0x7f')
  }
  const fences = (text.match(/^```/gm) ?? []).length
  const lines = text.split(/\r?\n/)

  const problems = []
  if (control.size) problems.push(`stray control char(s): ${[...control].join(' ')}`)
  if (fences % 2 !== 0) problems.push('unbalanced code fence')
  if (!text.endsWith('\n')) problems.push('missing trailing newline')
  lines.forEach((line, i) => {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(line)) problems.push(`line ${i + 1} contains a control char`)
  })

  if (problems.length) {
    failures++
    console.error(`FAIL  ${file}: ${problems.join('; ')}`)
  } else {
    console.log(`ok    ${file} (${lines.length} lines, ${fences / 2} code block(s))`)
  }
}

if (failures) {
  console.error(`\n${failures} file(s) failed the documentation check`)
  process.exit(1)
}
console.log('\ndocumentation check passed')
