/**
 * Wrap the built single-file game as an artifact page.
 *
 * The artifact host supplies its own <!doctype>/<html>/<head>/<body>, so this
 * strips ours and hands back the inlined stylesheet, the markup and the inline
 * module script. The game is a single committed visual world — a dark river at
 * night — so the page paints its own ground explicitly instead of following the
 * viewer's theme.
 *
 *   npm run build && node tools/make-artifact.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const src = await readFile('dist/index.html', 'utf8');

const pick = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`could not find ${what} in dist/index.html`);
  return m[1];
};

const style = pick(/<style[^>]*>([\s\S]*?)<\/style>/, 'the inlined stylesheet');
const script = pick(/<script type="module"[^>]*>([\s\S]*?)<\/script>/, 'the inlined module');
const body = pick(/<body>([\s\S]*?)<\/body>/, 'the body')
  .replace(/<script type="module"[\s\S]*?<\/script>/g, '')
  .trim();

const page = `<title>鵜飼のよる — Ukai no Yoru</title>
<style>
/*
 * One committed visual world: a dark river at night. The page paints its own
 * ground rather than inheriting the viewer's theme, so it holds either way.
 */
:root {
  --night: #05070f;
  --river: #081227;
  --ember: #ff8a30;
}
html,
body {
  background: var(--night);
  color: #e8dfd2;
}
${style}
</style>
${body}
<script type="module">
${script}
</script>
`;

await writeFile('artifact.html', page, 'utf8');
console.log(`artifact.html — ${Math.round(page.length / 1024)} KB`);
