/**
 * Prepares the boot screen's desk photo.
 *
 *   node scripts/boot-scene.mjs [source-image]
 *
 * Does two things:
 *   1. Encodes a web-sized webp to src/assets/boot-desk.webp (the PNG source is
 *      multi-MB; the webp is ~100KB and is what the app imports).
 *   2. Locates the monitor's dark glass and prints the CSS custom properties
 *      that position the login chrome over it.
 *
 * Run this whenever the photo is replaced, then paste the printed values into
 * the `.stage` block of src/components/Boot/BootScreen.module.css.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const SOURCE = path.resolve(process.argv[2] ?? "src/assets/image.png");
const OUT_WEBP = path.resolve("src/assets/boot-desk.webp");
const QUALITY = 82;

/** Anything below this luminance counts as "screen off". */
const DARK = 30;
/** …and the case around it has to be at least this bright. */
const BRIGHT = 70;
/** How far past the run's ends to sample for that bright case. */
const PAD = 6;

async function detectGlass(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const lum = (x, y) => {
    const i = (y * W + x) * C;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };

  // A screen row is a long dark run with bright case on BOTH sides. The "both
  // sides" test is what separates the glass from the dark room behind the
  // machine, which is equally dark but unbounded.
  const rows = [];
  const xStart = Math.floor(W * 0.2);
  const xEnd = Math.floor(W * 0.8);

  for (let y = Math.floor(H * 0.2); y < Math.floor(H * 0.8); y++) {
    let run = null;
    for (let x = xStart; x <= xEnd; x++) {
      const dark = x < xEnd && lum(x, y) < DARK;
      if (dark) {
        run = run ? { s: run.s, e: x } : { s: x, e: x };
        continue;
      }
      if (run) {
        const l = run.s - PAD;
        const r = run.e + PAD;
        if (l > 0 && r < W && lum(l, y) > BRIGHT && lum(r, y) > BRIGHT && run.e - run.s > W * 0.08) {
          rows.push({ y, s: run.s, e: run.e, len: run.e - run.s });
        }
        run = null;
      }
    }
  }

  if (!rows.length) return null;

  // Keep the rows forming the main body; the rounded corners are narrower.
  const maxLen = Math.max(...rows.map((r) => r.len));
  const body = rows.filter((r) => r.len > maxLen * 0.85);
  const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  return {
    W,
    H,
    left: median(body.map((r) => r.s)),
    right: median(body.map((r) => r.e)),
    top: body[0].y,
    bottom: body[body.length - 1].y,
  };
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`source not found: ${SOURCE}`);
    process.exit(1);
  }

  const webp = await sharp(SOURCE).webp({ quality: QUALITY }).toBuffer();
  fs.writeFileSync(OUT_WEBP, webp);
  const srcKb = (fs.statSync(SOURCE).size / 1024).toFixed(0);
  console.log(`${path.relative(process.cwd(), OUT_WEBP)}  ${(webp.length / 1024).toFixed(0)}KB  (from ${srcKb}KB)`);

  const g = await detectGlass(SOURCE);
  if (!g) {
    console.error("\ncould not find a dark screen bounded by bright case.");
    console.error("check that the monitor is roughly centred and its screen is unlit.");
    process.exit(1);
  }

  const w = g.right - g.left + 1;
  const h = g.bottom - g.top + 1;
  const pct = (v, t) => ((v / t) * 100).toFixed(3);

  console.log(`\nglass: x ${g.left}..${g.right}  y ${g.top}..${g.bottom}  (${w}x${h}, aspect ${(w / h).toFixed(3)})`);
  console.log(`\npaste into .stage in src/components/Boot/BootScreen.module.css:\n`);
  console.log(`  --scene-w: ${g.W};`);
  console.log(`  --scene-h: ${g.H};`);
  console.log(`  --glass-left: ${pct(g.left, g.W)}%;`);
  console.log(`  --glass-top: ${pct(g.top, g.H)}%;`);
  console.log(`  --glass-width: ${pct(w, g.W)}%;`);
  console.log(`  --glass-height: ${pct(h, g.H)}%;`);
  console.log(`\nand update GLASS_FRACTION in BootScreen.tsx to ${(w / g.W).toFixed(5)}`);
}

await main();
