// Checks the Markdown docs for dead relative links and for backticked repo paths that no longer exist.
//   node scripts/check-docs.mjs            (or: npm run check:docs)
// Looks at README.md, PRIVACY.md, CONTEXT.md, CONTRIBUTING.md, SECURITY.md and every .md under docs/.
// Skips URLs, anchors, and anything with a placeholder (<id>, *, {a,b}, ...). Exits 1 when something is missing.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOP = ['README.md', 'PRIVACY.md', 'CONTEXT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY.md']
const PATH_ROOTS = ['src/', 'android/', 'scripts/', 'docs/', 'website/', '.github/', 'native/', 'packaging/', 'fastlane/', 'fdroid/', 'build/', 'resources/']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

const files = [...TOP.map((f) => join(root, f)).filter(existsSync), ...walk(join(root, 'docs'))]
const problems = []
const placeholder = /[<>*{}$|]|\.\.\.|…|\bx\.y\.z\b|<.*>/

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/')
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' ')) // ignore fenced code
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    // [text](relative/link)
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1]
      if (/^(https?:|mailto:|#|data:)/.test(target)) continue
      const clean = decodeURIComponent(target.split('#')[0])
      if (!clean || placeholder.test(clean)) continue
      if (!existsSync(resolve(dirname(file), clean))) problems.push(`${rel}:${i + 1}: dead link ${target}`)
    }
    // `path/in/repo.ext` or `src/dir/`
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      let p = m[1].replace(/[.,;:)]+$/, '')
      if (!PATH_ROOTS.some((r) => p.startsWith(r))) continue
      if (placeholder.test(p) || p.includes('?') || p.includes('=')) continue
      p = p.replace(/:\d+(-\d+)?$/, '').replace(/#.*/, '')
      if (!existsSync(join(root, p))) problems.push(`${rel}:${i + 1}: missing path ${m[1]}`)
    }
  })
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} problem(s) in ${files.length} files`)
  process.exit(1)
}
console.log(`docs ok: ${files.length} files, no dead links or missing paths`)
