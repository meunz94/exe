import fs from "fs";
import path from "path";
import matter from "gray-matter";

const AU_POSTS_DIR = path.resolve("public/data/au-posts");
const OUTPUT_FILE = path.resolve("public/data/au-posts.json");

function scanAuPosts() {
  const posts = [];

  if (!fs.existsSync(AU_POSTS_DIR)) {
    return { posts };
  }

  const auDirs = fs
    .readdirSync(AU_POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const auDir of auDirs) {
    const auId = auDir.name;
    const auPath = path.join(AU_POSTS_DIR, auId);

    const files = fs
      .readdirSync(auPath)
      .filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(auPath, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data: meta } = matter(raw);
      const id = path.basename(file, ".md");

      posts.push({
        id,
        auId,
        title: meta.title || id,
        date: meta.date || "",
        preview: meta.preview || "",
        contentPath: `au-posts/${auId}/${file}`,
      });
    }
  }

  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return { posts };
}

const result = scanAuPosts();
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + "\n", "utf-8");
console.log(
  `Generated ${OUTPUT_FILE}: ${result.posts.length} au-posts`
);
