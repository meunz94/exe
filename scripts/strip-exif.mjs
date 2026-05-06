import sharp from "sharp";
import { stat, unlink, rename } from "fs/promises";

const files = process.argv.slice(2);
if (!files.length) process.exit(0);

for (const file of files) {
  try {
    const before = (await stat(file)).size;
    const buf = await sharp(file).rotate().toBuffer();
    const tmp = file + ".tmp";
    await sharp(buf).toFile(tmp);
    await unlink(file);
    await rename(tmp, file);
    const after = (await stat(file)).size;
    const diff = before - after;
    if (diff > 0) console.log(`  ✓ ${file} (${diff} bytes metadata removed)`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
    process.exit(1);
  }
}
