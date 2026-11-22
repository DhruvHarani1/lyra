// Per-pixel diff of two shot-all.mjs output dirs. Writes red-overlay diffs for anything over the threshold.
//   node scripts/ui-test/diff-shots.mjs ui-test-out/base ui-test-out/after [--pct=0.2]
import { PNG } from 'pngjs'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'))
const partial = process.argv.includes('--partial') // only compare what exists in both dirs
const pct = Number((process.argv.find((x) => x.startsWith('--pct=')) ?? '--pct=0.2').split('=')[1])
const diffDir = join(b, '..', 'diff')
mkdirSync(diffDir, { recursive: true })
const bad = []
let n = 0
for (const f of readdirSync(a).filter((x) => x.endsWith('.png'))) {
  if (!existsSync(join(b, f))) { if (partial) continue; bad.push(`${f}  MISSING in after`); continue }
  const A = PNG.sync.read(readFileSync(join(a, f))), B = PNG.sync.read(readFileSync(join(b, f)))
  n++
  if (A.width !== B.width || A.height !== B.height) { bad.push(`${f}  SIZE ${A.width}x${A.height} vs ${B.width}x${B.height}`); continue }
  const D = new PNG({ width: A.width, height: A.height })
  let diff = 0
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]))
    if (d > 12) { diff++; D.data[i] = 255; D.data[i + 1] = 0; D.data[i + 2] = 0; D.data[i + 3] = 255 }
    else { D.data[i] = D.data[i + 1] = D.data[i + 2] = A.data[i] >> 2; D.data[i + 3] = 255 }
  }
  const p = (diff / (A.width * A.height)) * 100
  if (p > 0) { if (p > pct) { bad.push(`${f}  ${p.toFixed(2)}%`); writeFileSync(join(diffDir, f), PNG.sync.write(D)) } }
}
console.log(`compared ${n}; over ${pct}%: ${bad.length}`)
for (const l of bad) console.log('  ' + l)
process.exitCode = bad.length ? 1 : 0
