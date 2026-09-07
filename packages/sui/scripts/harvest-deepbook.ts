/**
 * Harvest DeepBook v3's error constants from Mysten's own published source.
 *
 *   npx tsx packages/sui/scripts/harvest-deepbook.ts > packages/sui/scripts/deepbook-errors.json
 *
 * WHY THIS EXISTS AT ALL. Sui gives a bare integer on abort: no constant name
 * in the status, and no constants field on sui_getNormalizedMoveModule, so
 * there is no on-chain route to the meaning of a code (unlike Aptos, whose
 * PackageRegistry stores the source). Every Sui error map therefore comes from
 * a protocol's published source, and the only defensible way to build one is to
 * READ that source mechanically rather than transcribe it by hand.
 *
 * The output is checked in as evidence. `errmap.ts` carries our English for
 * each code; `errmap.test.ts` fails if a name or number in it disagrees with
 * this file, so a DeepBook release that renumbers an error is caught rather
 * than silently mistranslated.
 */
const REPO = "MystenLabs/deepbookv3"
const PREFIX = "packages/deepbook/sources"

interface HarvestedError { name: string; code: number; doc: string }

/** A `// === Errors ===` divider is a section header, not documentation of a code. */
const isDivider = (s: string) => /^=+\s*[A-Za-z ]*\s*=+$/.test(s.trim())

async function main() {
  const treeRes = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`)
  if (!treeRes.ok) throw new Error(`could not list ${REPO}: HTTP ${treeRes.status}`)
  const tree = (await treeRes.json()) as { tree?: { path: string }[] }
  const files = (tree.tree ?? [])
    .map(f => f.path)
    .filter(p => p.startsWith(PREFIX) && p.endsWith(".move"))
    .sort()
  if (files.length === 0) throw new Error(`no Move sources under ${PREFIX}; the repo layout moved`)

  const out: Record<string, HarvestedError[]> = {}
  for (const path of files) {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${path}`)
    if (!res.ok) throw new Error(`could not read ${path}: HTTP ${res.status}`)
    const src = await res.text()
    const moduleName =
      /^\s*module\s+[a-z0-9_]+::([a-z0-9_]+)/im.exec(src)?.[1] ??
      path.split("/").pop()!.replace(/\.move$/, "")

    const lines = src.split("\n")
    const found: HarvestedError[] = []
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*const\s+(E[A-Za-z0-9_]*)\s*:\s*u64\s*=\s*(\d+)\s*;/.exec(lines[i] ?? "")
      if (!m) continue
      const doc: string[] = []
      for (let j = i - 1; j >= 0 && /^\s*\/\//.test(lines[j] ?? ""); j--) {
        const text = (lines[j] ?? "").replace(/^\s*\/\/\/?\s?/, "").trim()
        if (!isDivider(text) && text) doc.unshift(text)
      }
      found.push({ name: m[1]!, code: Number(m[2]), doc: doc.join(" ") })
    }
    if (found.length > 0) out[moduleName] = found
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n")
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
