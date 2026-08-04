/**
 * 노션 API 공용 헬퍼.
 *
 * sync(노션 → 사이트 파일)와 bootstrap(기존 파일 → 노션)이 함께 쓴다.
 * 외부 의존성 없이 Node 18+ 내장 fetch/FormData만 사용한다.
 */
import fs from "fs";
import path from "path";

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export const CONFIG_FILE = path.resolve("notion.config.json");
export const MANIFEST_FILE = path.resolve(".notion-manifest.json");

export function requireToken() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("NOTION_TOKEN 환경변수가 필요합니다. (노션 내부 통합의 시크릿)");
    process.exit(1);
  }
  return token;
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("notion.config.json 이 없습니다. docs/NOTION.md 를 참고해 먼저 만들어 주세요.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

/* ---------------------------------------------------------------- API 호출 */

/**
 * 노션 API 호출. 429/5xx 는 Retry-After 를 존중하며 재시도한다.
 * body 가 FormData 면 그대로, 아니면 JSON 으로 보낸다.
 */
export async function notion(method, pathname, body) {
  const token = requireToken();
  for (let attempt = 0; ; attempt++) {
    const headers = {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    };
    let payload;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${API}${pathname}`, { method, headers, body: payload });

    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API ${method} ${pathname} → ${res.status}: ${text}`);
    }
    return res.json();
  }
}

/** 데이터베이스 전체 조회 (페이지네이션 처리). */
export async function queryAll(databaseId, body = {}) {
  const results = [];
  let cursor;
  do {
    const page = await notion("POST", `/databases/${databaseId}/query`, {
      ...body,
      ...(cursor ? { start_cursor: cursor } : {}),
      page_size: 100,
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return results;
}

/** 블록 자식들을 (중첩 포함) 전부 가져온다. */
export async function listBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const page = await notion(
      "GET",
      `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`
    );
    blocks.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);

  for (const block of blocks) {
    if (block.has_children && block.type !== "child_page" && block.type !== "child_database") {
      block.children = await listBlocks(block.id);
    }
  }
  return blocks;
}

export async function getPage(pageId) {
  return notion("GET", `/pages/${pageId}`);
}

/* ------------------------------------------------------- 속성값 읽기 헬퍼 */

function prop(page, name) {
  return page.properties?.[name];
}

export function getTitle(page, name) {
  return richTextToPlain(prop(page, name)?.title ?? []);
}

export function getText(page, name) {
  return richTextToPlain(prop(page, name)?.rich_text ?? []);
}

export function getDate(page, name) {
  return prop(page, name)?.date?.start ?? "";
}

export function getSelect(page, name) {
  return prop(page, name)?.select?.name ?? "";
}

export function getNumber(page, name) {
  return prop(page, name)?.number ?? null;
}

export function getCheckbox(page, name) {
  return prop(page, name)?.checkbox ?? false;
}

export function getUrl(page, name) {
  return prop(page, name)?.url ?? "";
}

export function getMultiSelect(page, name) {
  return (prop(page, name)?.multi_select ?? []).map((o) => o.name);
}

/** files 속성 → [{ name, url, external }] */
export function getFiles(page, name) {
  return (prop(page, name)?.files ?? []).map((f) => ({
    name: f.name ?? "",
    url: f.type === "external" ? f.external.url : f.file?.url ?? "",
    external: f.type === "external",
  }));
}

/* -------------------------------------------------- 노션 블록 → 마크다운 */

export function richTextToPlain(richText = []) {
  return richText.map((t) => t.plain_text).join("");
}

/**
 * 리치 텍스트 → 마크다운(+HTML).
 * 사이트가 react-markdown + rehype-raw 로 렌더링하므로 인라인 HTML 이 허용된다.
 * 노션에서 색을 입힌 텍스트는 전부 사이트의 강조색(var(--color-accent))으로 매핑한다.
 */
export function richTextToMd(richText = []) {
  return richText
    .map((t) => {
      let s = t.plain_text;
      if (!s.trim()) return s;
      const a = t.annotations ?? {};
      if (a.code) {
        s = `\`${s}\``;
      } else {
        if (a.bold) s = `**${s}**`;
        if (a.italic) s = `*${s}*`;
        if (a.strikethrough) s = `<s>${s}</s>`;
        if (a.underline) s = `<u>${s}</u>`;
      }
      if (t.href) s = `[${s}](${t.href})`;
      if (a.color && a.color !== "default" && !a.color.endsWith("_background")) {
        s = `<span style="color: var(--color-accent)">${s}</span>`;
      }
      return s;
    })
    .join("");
}

const INDENT = "  ";

function indentLines(text, unit = INDENT) {
  return text
    .split("\n")
    .map((line) => (line ? unit + line : line))
    .join("\n");
}

/**
 * 블록 트리 → 마크다운 문서.
 * ctx.saveImage(url, blockId): 노션이 준 (만료되는) 파일 URL 을 저장하고
 * 사이트에서 쓸 경로를 돌려주는 콜백. 없으면 URL 을 그대로 둔다.
 */
export async function blocksToMarkdown(blocks, ctx = {}, depth = 0) {
  const chunks = []; // { md, isList }
  let numbered = 0;

  for (const block of blocks) {
    const type = block.type;
    if (type !== "numbered_list_item") numbered = 0;

    const data = block[type] ?? {};
    const rt = data.rich_text ?? [];
    let md = null;
    let isList = false;

    const children = async () => {
      if (!block.children?.length) return "";
      return blocksToMarkdown(block.children, ctx, depth + 1);
    };

    switch (type) {
      case "paragraph":
        md = richTextToMd(rt);
        break;
      case "heading_1":
        md = `# ${richTextToMd(rt)}`;
        break;
      case "heading_2":
        md = `## ${richTextToMd(rt)}`;
        break;
      case "heading_3":
        md = `### ${richTextToMd(rt)}`;
        break;
      case "bulleted_list_item": {
        isList = true;
        md = `- ${richTextToMd(rt)}`;
        const inner = await children();
        if (inner) md += "\n" + indentLines(inner);
        break;
      }
      case "numbered_list_item": {
        isList = true;
        numbered += 1;
        md = `${numbered}. ${richTextToMd(rt)}`;
        const inner = await children();
        if (inner) md += "\n" + indentLines(inner, "   ");
        break;
      }
      case "to_do":
        isList = true;
        md = `- [${data.checked ? "x" : " "}] ${richTextToMd(rt)}`;
        break;
      case "toggle": {
        const inner = await children();
        md = `<details>\n<summary>${richTextToMd(rt)}</summary>\n\n${inner}\n\n</details>`;
        break;
      }
      case "quote": {
        let text = richTextToMd(rt);
        const inner = await children();
        if (inner) text += "\n" + inner;
        md = text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        break;
      }
      case "callout": {
        const icon = data.icon?.type === "emoji" ? `${data.icon.emoji} ` : "";
        md = `> ${icon}${richTextToMd(rt)}`;
        break;
      }
      case "divider":
        md = "---";
        break;
      case "code": {
        const lang = data.language === "plain text" ? "" : data.language ?? "";
        md = `\`\`\`${lang}\n${richTextToPlain(rt)}\n\`\`\``;
        break;
      }
      case "image": {
        const src = data[data.type]?.url ?? "";
        let url = src;
        if (data.type === "file" && ctx.saveImage) {
          url = await ctx.saveImage(src, block.id);
        }
        md = `![${richTextToPlain(data.caption ?? [])}](${url})`;
        break;
      }
      case "video":
      case "embed":
      case "bookmark":
      case "link_preview": {
        const url = data.url ?? data[data.type]?.url ?? "";
        if (url) md = `[${url}](${url})`;
        break;
      }
      case "table": {
        const rows = block.children ?? [];
        const header = data.has_column_header;
        const html = rows
          .map((row, i) => {
            const tag = header && i === 0 ? "th" : "td";
            const cells = (row.table_row?.cells ?? [])
              .map((cell) => `<${tag}>${richTextToMd(cell)}</${tag}>`)
              .join("");
            return `  <tr>${cells}</tr>`;
          })
          .join("\n");
        md = `<table>\n${html}\n</table>`;
        break;
      }
      case "column_list":
      case "column":
      case "synced_block":
        md = await children();
        break;
      case "equation":
        md = data.expression ?? "";
        break;
      case "child_page":
      case "child_database":
        break;
      default:
        if (rt.length) md = richTextToMd(rt);
        break;
    }

    if (md === null || md === "") continue;
    chunks.push({ md, isList });
  }

  let out = "";
  let prev = null;
  for (const chunk of chunks) {
    if (out) out += prev?.isList && chunk.isList ? "\n" : "\n\n";
    out += chunk.md;
    prev = chunk;
  }
  return out;
}

/* -------------------------------------------------- 마크다운 → 노션 블록 */

/** 노션 rich_text 아이템 하나는 2000자 제한이 있어 긴 문자열을 쪼갠다. */
export function textItems(content, extra = {}) {
  const items = [];
  for (let i = 0; i < content.length; i += 2000) {
    items.push({
      type: "text",
      text: { content: content.slice(i, i + 2000), ...extra },
    });
  }
  return items;
}

/** 아주 기본적인 인라인 파서: **굵게**, *기울임*, `코드`, [링크](url). */
export function parseInline(text) {
  if (!text) return [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const items = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) items.push(...textItems(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith("**")) {
      const item = textItems(tok.slice(2, -2))[0];
      item.annotations = { bold: true };
      items.push(item);
    } else if (tok.startsWith("`")) {
      const item = textItems(tok.slice(1, -1))[0];
      item.annotations = { code: true };
      items.push(item);
    } else if (tok.startsWith("*")) {
      const item = textItems(tok.slice(1, -1))[0];
      item.annotations = { italic: true };
      items.push(item);
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      items.push(...textItems(lm[1], { link: { url: lm[2] } }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) items.push(...textItems(text.slice(last)));
  return items;
}

const NOTION_CODE_LANGS = new Set([
  "javascript", "typescript", "python", "json", "html", "css", "bash", "shell",
  "markdown", "yaml", "sql", "java", "c", "c++", "c#", "go", "rust", "ruby", "php",
]);

/**
 * 마크다운 → 노션 블록 배열 (베스트 에포트).
 * 인라인 HTML(span/details 등)은 노션 블록으로 되돌릴 수 없어 일반 텍스트로 들어간다.
 * opts.resolveImage(src): 이미지 경로 → image 블록(또는 null) 반환하는 비동기 콜백.
 */
export async function markdownToBlocks(md, opts = {}) {
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\S*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스
      const lang = NOTION_CODE_LANGS.has(fence[1]) ? fence[1] : "plain text";
      blocks.push({
        type: "code",
        code: { rich_text: textItems(body.join("\n")), language: lang },
      });
      continue;
    }

    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      const level = m[1].length;
      blocks.push({
        type: `heading_${level}`,
        [`heading_${level}`]: { rich_text: parseInline(m[2]) },
      });
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      blocks.push({
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseInline(m[1]) },
      });
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: { rich_text: parseInline(m[1]) },
      });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      blocks.push({ type: "quote", quote: { rich_text: parseInline(m[1]) } });
    } else if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: "divider", divider: {} });
    } else if ((m = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/))) {
      const src = m[1];
      let block = null;
      if (/^https?:\/\//.test(src)) {
        block = { type: "image", image: { type: "external", external: { url: src } } };
      } else if (opts.resolveImage) {
        block = await opts.resolveImage(src);
      }
      if (block) blocks.push(block);
      else blocks.push({ type: "paragraph", paragraph: { rich_text: textItems(line) } });
    } else if (line.trim() !== "") {
      blocks.push({ type: "paragraph", paragraph: { rich_text: parseInline(line) } });
    }
    i++;
  }
  return blocks;
}

/* ------------------------------------------------------------ 파일 전송 */

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

const PART_SIZE = 10 * 1024 * 1024;
const SINGLE_PART_LIMIT = 20 * 1024 * 1024;

/** 로컬 파일을 노션 File Upload API 로 올리고 file_upload id 를 돌려준다. */
export async function uploadFile(absPath) {
  const buf = fs.readFileSync(absPath);
  const filename = path.basename(absPath);
  const contentType = MIME[path.extname(absPath).toLowerCase()] ?? "application/octet-stream";

  if (buf.length <= SINGLE_PART_LIMIT) {
    const created = await notion("POST", "/file_uploads", {
      filename,
      content_type: contentType,
    });
    const form = new FormData();
    form.append("file", new Blob([buf], { type: contentType }), filename);
    await notion("POST", `/file_uploads/${created.id}/send`, form);
    return created.id;
  }

  const parts = Math.ceil(buf.length / PART_SIZE);
  const created = await notion("POST", "/file_uploads", {
    mode: "multi_part",
    number_of_parts: parts,
    filename,
    content_type: contentType,
  });
  for (let p = 0; p < parts; p++) {
    const form = new FormData();
    form.append("part_number", String(p + 1));
    form.append(
      "file",
      new Blob([buf.subarray(p * PART_SIZE, (p + 1) * PART_SIZE)], { type: contentType }),
      filename
    );
    await notion("POST", `/file_uploads/${created.id}/send`, form);
  }
  await notion("POST", `/file_uploads/${created.id}/complete`, {});
  return created.id;
}

/** URL 의 파일을 내려받아 저장한다. */
export async function download(url, absPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buf);
}

export function sanitizeFilename(name) {
  return name.replace(/[/\\?%*:|"<>#]/g, "_").trim() || "file";
}

/** URL 경로에서 확장자 추출 (쿼리스트링 무시). 없으면 fallback. */
export function extFromUrl(url, fallback = ".png") {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ext || fallback;
  } catch {
    return fallback;
  }
}

export function shortId(notionId) {
  return notionId.replace(/-/g, "").slice(0, 8);
}

/** 유튜브 URL 또는 맨 ID → 11자 영상 ID. URL 형태가 아니면 입력 그대로 돌려준다. */
export function youtubeId(input) {
  const s = (input ?? "").trim();
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : s;
}
