/**
 * public/data/<pair>/{logs,stories,diary}/*.md 의 frontmatter 를 훑어 목록 JSON 을 만든다.
 *   logs.json     번호 내림차순. excerpt(첫 서술 문단) · quote(첫 대사) 자동 추출
 *   stories.json  날짜 내림차순
 *   diary.json    날짜 내림차순
 * 노션 동기화든 손으로 쓴 md 든 같은 경로에 두면 된다. (npm run dev / build 가 먼저 실행)
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOT = path.resolve("public/data");
const DIALOGUE = /^\s*(?:\*\*)?([A-Za-z가-힣.·'? ]{1,20}?)(?:\*\*)?\s*[:：]\s+(.+)$/s;

/** "12–34" 쪽 표기의 시작값 (없으면 뒤로) */
const pageStart = (p) => { const m = String(p ?? "").match(/\d+/); return m ? Number(m[0]) : Infinity; };

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const { data, content } = matter(raw);
      return { id: path.basename(f, ".md"), file: f, data, content };
    });
}

function plain(md, max = 160) {
  const t = md
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

function firstBlocks(content) {
  const paras = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const narr = paras.find((p) => !DIALOGUE.test(p) || p.includes("\n"));
  const dia = paras.map((p) => p.match(DIALOGUE)).find((m) => m);
  return { excerpt: narr ? plain(narr) : plain(paras[0] ?? ""), quote: dia ? { who: dia[1].trim(), text: plain(dia[2], 80) } : undefined };
}

const str = (v, d = "") => (v == null ? d : String(v));
const arr = (v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(/[,\s]+/).filter(Boolean) : []);

for (const pairDir of fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const pair = pairDir.name;
  const base = path.join(ROOT, pair);

  const logs = readDir(path.join(base, "logs"))
    .map((e) => {
      const { excerpt, quote } = firstBlocks(e.content);
      return {
        id: e.id,
        no: String(e.data.no ?? e.id).padStart(3, "0"),
        date: str(e.data.date),
        kind: String(e.data.kind ?? "").toUpperCase() === "AU" ? "AU" : "ORIGINAL",
        title: str(e.data.title, e.id),
        subtitle: str(e.data.subtitle),
        tags: arr(e.data.tags),
        photo: e.data.photo === true ? "placeholder" : str(e.data.photo),
        caption: str(e.data.caption),
        excerpt: str(e.data.excerpt) || excerpt,
        ...(quote ? { quote } : {}),
        path: `logs/${e.file}`,
        ...(e.data.locked ? { locked: true, cipher: str(e.data.cipher), excerpt: "", quote: undefined } : {}),
      };
    })
    .sort((a, b) => Number(b.no) - Number(a.no) || b.date.localeCompare(a.date));

  const stories = readDir(path.join(base, "stories"))
    .map((e) => ({
      id: e.id,
      vol: Number(e.data.vol) || 0,
      title: str(e.data.title, e.id),
      abstract: str(e.data.abstract),
      affiliations: arr(e.data.affiliations),
      pages: str(e.data.pages),
      chapter: str(e.data.chapter),
      path: `stories/${e.file}`,
    }))
    .sort((a, b) => a.vol - b.vol || pageStart(a.pages) - pageStart(b.pages));

  const diary = readDir(path.join(base, "diary"))
    .map((e) => ({
      id: e.id,
      no: Number(e.data.no ?? e.id) || 0,
      date: str(e.data.date),
      author: str(e.data.author),
      title: str(e.data.title, e.id),
      path: `diary/${e.file}`,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);

  if (logs.length || fs.existsSync(path.join(base, "logs"))) fs.writeFileSync(path.join(base, "logs.json"), JSON.stringify(logs, null, 2) + "\n");
  if (stories.length || fs.existsSync(path.join(base, "stories"))) fs.writeFileSync(path.join(base, "stories.json"), JSON.stringify(stories, null, 2) + "\n");
  if (diary.length || fs.existsSync(path.join(base, "diary"))) fs.writeFileSync(path.join(base, "diary.json"), JSON.stringify(diary, null, 2) + "\n");
  console.log(`[content] ${pair}: logs ${logs.length} · stories ${stories.length} · diary ${diary.length}`);
}
