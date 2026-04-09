import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.resolve("public/data/posts");
const IMAGES_DIR = path.resolve("public/images/posts");
const OUTPUT_FILE = path.resolve("public/data/posts.json");

const IMAGE_EXTS = [".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif"];

function findImage(category, boardName, postId) {
  const dir = path.join(IMAGES_DIR, category, boardName);
  if (!fs.existsSync(dir)) return "";

  for (const ext of IMAGE_EXTS) {
    const candidate = path.join(dir, postId + ext);
    if (fs.existsSync(candidate)) {
      return `/images/posts/${category}/${boardName}/${postId}${ext}`;
    }
  }
  return "";
}

function scanPosts() {
  const posts = [];
  const boardSet = new Map();

  const categories = fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const catDir of categories) {
    const category = catDir.name;
    const catPath = path.join(POSTS_DIR, category);

    const boards = fs
      .readdirSync(catPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const boardDir of boards) {
      const boardName = boardDir.name;
      const boardId = `${category}-${boardName}`;
      const boardPath = path.join(catPath, boardName);

      if (!boardSet.has(boardId)) {
        boardSet.set(boardId, { id: boardId, name: boardName, category });
      }

      const files = fs
        .readdirSync(boardPath)
        .filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const filePath = path.join(boardPath, file);
        const raw = fs.readFileSync(filePath, "utf-8");
        const { data: meta } = matter(raw);
        const id = path.basename(file, ".md");

        const autoImage = findImage(category, boardName, id);
        const imageUrl = meta.imageUrl || autoImage;

        posts.push({
          id,
          title: meta.title || id,
          date: meta.date || "",
          preview: meta.preview || "",
          imageUrl,
          category,
          boardId,
          contentPath: `posts/${category}/${boardName}/${file}`,
        });
      }
    }
  }

  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return {
    posts,
    boards: Array.from(boardSet.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
  };
}

const result = scanPosts();
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + "\n", "utf-8");
console.log(
  `Generated ${OUTPUT_FILE}: ${result.posts.length} posts, ${result.boards.length} boards`
);
