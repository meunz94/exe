import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.resolve("public/data/posts");
const IMAGES_DIR = path.resolve("public/images/posts");
const OUTPUT_FILE = path.resolve("public/data/posts.json");

const IMAGE_EXTS = [".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif"];

function findImage(boardName, postId) {
  const dir = path.join(IMAGES_DIR, boardName);
  if (!fs.existsSync(dir)) return "";

  for (const ext of IMAGE_EXTS) {
    const candidate = path.join(dir, postId + ext);
    if (fs.existsSync(candidate)) {
      return `/images/posts/${boardName}/${postId}${ext}`;
    }
  }
  return "";
}

function scanPosts() {
  const posts = [];
  const boardSet = new Map();

  // No posts directory is a legitimate state, not an error: notion-sync's
  // `cleanTree` removes the tree entirely when every row in the Notion database
  // is unpublished. Crashing here used to take the whole deploy down with it.
  if (!fs.existsSync(POSTS_DIR)) {
    return { posts, boards: [] };
  }

  // 게시판 한 단계만 — 카테고리(VB/VS) 구분은 더 쓰지 않는다.
  const boards = fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const boardDir of boards) {
    const boardName = boardDir.name;
    const boardPath = path.join(POSTS_DIR, boardName);

    if (!boardSet.has(boardName)) {
      boardSet.set(boardName, { id: boardName, name: boardName });
    }

    for (const file of fs.readdirSync(boardPath).filter((f) => f.endsWith(".md"))) {
      const raw = fs.readFileSync(path.join(boardPath, file), "utf-8");
      const { data: meta } = matter(raw);
      const id = path.basename(file, ".md");
      const imageUrl = meta.imageUrl || findImage(boardName, id);

      posts.push({
        id,
        title: meta.title || id,
        date: meta.date || "",
        preview: meta.preview || "",
        imageUrl,
        boardId: boardName,
        contentPath: `posts/${boardName}/${file}`,
      });
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
