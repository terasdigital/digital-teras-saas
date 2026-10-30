/**
 * Ukur total byte JS yang benar-benar dimuat halaman etalase publik.
 * Jalankan setelah `pnpm build`:
 *   node scripts/bundle-size.mjs [slug]
 * (memakai server produksi yang sudah jalan di PORT di env/argumen ke-2)
 */
const base = process.argv[2] || "http://localhost:3299";
const slug = process.argv[3] || "digiloka";

const html = await (await fetch(`${base}/${slug}`)).text();
const chunks = [...new Set([...html.matchAll(/src="(\/_next\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
let total = 0;
const rows = [];
for (const c of chunks) {
  const r = await fetch(base + c);
  const len = (await r.arrayBuffer()).byteLength; // byte terurai (yang di-parse mesin JS)
  total += len;
  rows.push([len, c]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [len, c] of rows) console.log((len / 1024).toFixed(1).padStart(7) + " KB  " + c.split("/").pop().slice(0, 70));
const css = [...new Set([...html.matchAll(/href="(\/_next\/[^"]+\.css)"/g)].map((m) => m[1]))];
let cssTotal = 0;
for (const c of css) {
  const r = await fetch(base + c);
  cssTotal += (await r.arrayBuffer()).byteLength;
}
console.log("────");
console.log(`JS  chunks : ${chunks.length} file, ${(total / 1024).toFixed(1)} KB`);
console.log(`CSS chunks : ${css.length} file, ${(cssTotal / 1024).toFixed(1)} KB`);
console.log(`HTML       : ${(new TextEncoder().encode(html).length / 1024).toFixed(1)} KB`);
