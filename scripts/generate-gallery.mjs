import fs from "fs";
import path from "path";
import sharp from "sharp";

const GALLERY_DIR = path.resolve("public/images/gallery");
const THUMB_DIR = path.resolve("public/images/thumbs");
const OUTPUT_GALLERY = path.resolve("public/data/gallery.json");
const OUTPUT_AU_GALLERY = path.resolve("public/data/au-gallery.json");

const IMAGE_EXTS = new Set([".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif", ".svg"]);

/* Source gallery images are multi-megabyte PNGs straight from KakaoTalk. The
   full-size files are fine inside the gallery window, where the user has opted
   in, but the landing page's showcase strip shows every image at once — so it
   gets webp thumbnails instead. Height matches the tallest the strip renders at
   (~72vh); width follows the source aspect ratio. */
const THUMB_HEIGHT = 720;
const THUMB_SKIP_EXT = new Set([".gif", ".svg"]);

function isImage(file) {
  return IMAGE_EXTS.has(path.extname(file).toLowerCase());
}

function readCaption(imgPath) {
  const txtPath = imgPath.replace(path.extname(imgPath), ".txt");
  if (fs.existsSync(txtPath)) {
    return fs.readFileSync(txtPath, "utf-8").trim() || undefined;
  }
  return undefined;
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function scanImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isImage)
    .sort();
}

/**
 * Writes a height-capped webp next to the source under `public/images/thumbs/`,
 * mirroring the gallery folder structure. Returns the public URL, or undefined
 * if the format is one we pass through untouched.
 *
 * Skips regeneration when the thumb is newer than its source, so repeat builds
 * cost nothing.
 */
async function makeThumb(absSource, relPath) {
  if (THUMB_SKIP_EXT.has(path.extname(absSource).toLowerCase())) return undefined;

  const relThumb = `${relPath.replace(/\.[^.]+$/, "")}.webp`;
  const absThumb = path.join(THUMB_DIR, relThumb);

  const srcStat = fs.statSync(absSource);
  if (fs.existsSync(absThumb) && fs.statSync(absThumb).mtimeMs >= srcStat.mtimeMs) {
    return `/images/thumbs/${relThumb}`;
  }

  fs.mkdirSync(path.dirname(absThumb), { recursive: true });
  try {
    await sharp(absSource)
      .rotate()
      .resize({ height: THUMB_HEIGHT, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(absThumb);
    return `/images/thumbs/${relThumb}`;
  } catch (err) {
    console.warn(`  ! thumb failed for ${relPath}: ${err.message}`);
    return undefined;
  }
}

async function generate() {
  if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
  }

  const galleryItems = [];
  const auGallery = {};

  const topDirs = scanDir(GALLERY_DIR);

  for (const dirName of topDirs) {
    const dirPath = path.join(GALLERY_DIR, dirName);

    if (dirName === "au") {
      const auDirs = scanDir(dirPath);
      for (const auId of auDirs) {
        const auPath = path.join(dirPath, auId);
        const images = scanImages(auPath);
        if (images.length === 0) continue;

        auGallery[auId] = images.map((file) => {
          const caption = readCaption(path.join(auPath, file));
          const entry = { url: `/images/gallery/au/${auId}/${file}` };
          if (caption) entry.caption = caption;
          return entry;
        });
      }
      continue;
    }

    const category = dirName;
    const images = scanImages(path.join(GALLERY_DIR, category));

    for (const file of images) {
      const id = `${category}-${path.basename(file, path.extname(file))}`;
      const absSource = path.join(GALLERY_DIR, category, file);
      const caption = readCaption(absSource);
      const item = {
        id,
        url: `/images/gallery/${category}/${file}`,
        category,
      };
      const thumbUrl = await makeThumb(absSource, `${category}/${file}`);
      if (thumbUrl) item.thumbUrl = thumbUrl;
      if (caption) item.caption = caption;
      galleryItems.push(item);
    }
  }

  fs.writeFileSync(OUTPUT_GALLERY, JSON.stringify(galleryItems, null, 2) + "\n", "utf-8");
  fs.writeFileSync(OUTPUT_AU_GALLERY, JSON.stringify(auGallery, null, 2) + "\n", "utf-8");

  const auCount = Object.values(auGallery).reduce((s, arr) => s + arr.length, 0);
  console.log(
    `Generated gallery: ${galleryItems.length} images (category), ${auCount} images (au)`
  );
}

await generate();
