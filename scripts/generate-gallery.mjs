import fs from "fs";
import path from "path";

const GALLERY_DIR = path.resolve("public/images/gallery");
const OUTPUT_GALLERY = path.resolve("public/data/gallery.json");
const OUTPUT_AU_GALLERY = path.resolve("public/data/au-gallery.json");

const IMAGE_EXTS = new Set([".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif", ".svg"]);

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

function generate() {
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
      const caption = readCaption(path.join(GALLERY_DIR, category, file));
      const item = {
        id,
        url: `/images/gallery/${category}/${file}`,
        category,
      };
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

generate();
