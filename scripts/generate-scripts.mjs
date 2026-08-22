import fs from "fs";
import path from "path";
import matter from "gray-matter";

/**
 * Builds the PAPERS index. Drop markdown files with frontmatter into
 * public/data/scripts/ and this emits public/data/scripts.json holding only
 * the light metadata — bodies stay in the .md files and are fetched when a
 * script is opened.
 *
 * Frontmatter: title (required), date (YYYY-MM-DD), category (ORG | AU)
 */

const SCRIPTS_DIR = path.resolve("public/data/scripts");
const OUTPUT_FILE = path.resolve("public/data/scripts.json");

function scanScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];

  const items = [];
  for (const file of fs.readdirSync(SCRIPTS_DIR)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const raw = fs.readFileSync(path.join(SCRIPTS_DIR, file), "utf-8");
    const { data: meta } = matter(raw);
    if (!meta.title) {
      console.warn(`[scripts] ${file}: no title in frontmatter, skipped`);
      continue;
    }
    // gray-matter parses bare YYYY-MM-DD dates into Date objects
    const date =
      meta.date instanceof Date
        ? meta.date.toISOString().slice(0, 10)
        : meta.date
          ? String(meta.date).slice(0, 10)
          : "";
    items.push({
      id: path.basename(file, ".md"),
      title: String(meta.title),
      date,
      category: meta.category === "AU" ? "AU" : "ORG",
    });
  }

  // newest first is the page default; keep the file in that order too
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return items;
}

const items = scanScripts();
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2) + "\n");
console.log(`[scripts] ${items.length} scripts indexed`);
