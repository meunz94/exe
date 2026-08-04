/**
 * 노션 → 사이트 데이터 동기화.
 *
 * notion.config.json 에 ID 가 채워진 데이터셋만 동기화한다. 출력은 기존
 * 데이터 파일 형태 그대로라서 (public/data/*.json, md 파일, 갤러리 이미지)
 * 이후 빌드는 기존 generate-* 스크립트가 그대로 처리한다.
 *
 * 동기화가 소유하는 경로 — 해당 데이터셋이 설정된 경우 노션에 없는 파일은 삭제된다:
 *   public/data/posts/**        (template.md 제외)
 *   public/data/au-posts/**
 *   public/data/neighbors/**    (→ public/images/notion/neighbors 로 대체)
 *   public/images/gallery/**
 *   public/images/notion/**
 *   notice.md, memo.md, timeline.json, playlist.json, neighbors.json, notion.json
 *
 * .notion-manifest.json 에 페이지별 last_edited_time 을 기록해 두고, 바뀌지
 * 않은 페이지의 본문 변환·이미지 다운로드는 건너뛴다 (커밋되는 파일).
 *
 * 사용: NOTION_TOKEN=... node scripts/notion-sync.mjs
 */
import fs from "fs";
import path from "path";
import {
  loadConfig,
  loadManifest,
  saveManifest,
  queryAll,
  listBlocks,
  getPage,
  getTitle,
  getText,
  getDate,
  getSelect,
  getNumber,
  getUrl,
  getFiles,
  getMultiSelect,
  youtubeId,
  richTextToPlain,
  blocksToMarkdown,
  download,
  sanitizeFilename,
  extFromUrl,
  shortId,
} from "./notion-lib.mjs";

const config = loadConfig();
const dbs = config.databases ?? {};
const pages = config.pages ?? {};

const manifest = loadManifest();
const next = {};
const expected = new Set(); // 이번 동기화가 유지하는 파일 (repo 상대경로)

const PUBLISHED = { filter: { property: "공개", checkbox: { equals: true } } };
const CREATED_ASC = [{ timestamp: "created_time", direction: "ascending" }];

function rel(...parts) {
  return parts.join("/");
}

function writeText(relPath, content) {
  const abs = path.resolve(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  expected.add(relPath);
}

function writeJson(relPath, value) {
  writeText(relPath, JSON.stringify(value, null, 2) + "\n");
}

/** 페이지가 안 바뀌었고 산출물이 전부 남아 있으면 재사용. */
function reuse(page, ds) {
  const entry = manifest[page.id];
  if (!entry || entry.edited !== page.last_edited_time) return false;
  if (!entry.files.every((f) => fs.existsSync(path.resolve(f)))) return false;
  next[page.id] = { ...entry, ds };
  entry.files.forEach((f) => expected.add(f));
  return true;
}

function record(page, ds, files) {
  next[page.id] = { ds, edited: page.last_edited_time, files };
  files.forEach((f) => expected.add(f));
}

/** 페이지 본문 → 마크다운. 본문 속 이미지는 public/images/notion/<page>/ 에 저장. */
async function pageBody(page, files) {
  const imgDir = rel("public", "images", "notion", shortId(page.id));
  const ctx = {
    saveImage: async (url, blockId) => {
      const target = rel(imgDir, `${shortId(blockId)}${extFromUrl(url)}`);
      await download(url, path.resolve(target));
      files.push(target);
      return "/" + target.replace(/^public\//, "");
    },
  };
  return blocksToMarkdown(await listBlocks(page.id), ctx);
}

function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** 소유 디렉터리에서 이번 동기화에 없는 파일 제거, 빈 폴더 정리. */
function cleanTree(rootRel, keepExtra = new Set()) {
  const rootAbs = path.resolve(rootRel);
  if (!fs.existsSync(rootAbs)) return;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
      } else {
        const relPath = path.relative(path.resolve("."), abs).split(path.sep).join("/");
        if (!expected.has(relPath) && !keepExtra.has(relPath)) {
          fs.rmSync(abs);
          console.log(`  - 삭제: ${relPath}`);
        }
      }
    }
  };
  walk(rootAbs);
}

const bySort = (prop) => (a, b) =>
  (getNumber(a, prop) ?? Infinity) - (getNumber(b, prop) ?? Infinity);
const byDate = (prop) => (a, b) => getDate(a, prop).localeCompare(getDate(b, prop));

/* ------------------------------------------------------------- 데이터셋 */

async function syncPosts() {
  const rows = await queryAll(dbs.posts, { ...PUBLISHED, sorts: CREATED_ASC });
  for (const page of rows) {
    const category = getSelect(page, "카테고리");
    const board = getSelect(page, "게시판");
    if (!category || !board) {
      console.warn(`  ! 게시글 "${getTitle(page, "제목")}" 에 카테고리/게시판이 없어 건너뜀`);
      continue;
    }
    if (reuse(page, "posts")) continue;

    // 파일명(=글 id)은 노션 페이지 ID에서 딴다. 목록 정렬은 날짜 기준이라
    // (generate-posts 가 날짜 내림차순 정렬) 사람이 번호를 매길 필요가 없다.
    const id = shortId(page.id);
    const files = [];

    let imageUrl;
    const cover = getFiles(page, "대표이미지")[0];
    if (cover) {
      if (cover.external) {
        imageUrl = cover.url;
      } else {
        const target = rel("public", "images", "notion", shortId(page.id), `cover${extFromUrl(cover.url)}`);
        await download(cover.url, path.resolve(target));
        files.push(target);
        imageUrl = "/" + target.replace(/^public\//, "");
      }
    }

    const body = await pageBody(page, files);
    const target = rel("public", "data", "posts", category, board, `${id}.md`);
    writeText(
      target,
      frontmatter({
        title: getTitle(page, "제목"),
        date: getDate(page, "날짜"),
        preview: getText(page, "미리보기"),
        imageUrl,
      }) + body + "\n"
    );
    files.push(target);
    record(page, "posts", files);
  }
  cleanTree("public/data/posts");
  console.log(`✓ 게시글 ${rows.length}건`);
}

async function syncAuPosts() {
  const rows = await queryAll(dbs.auPosts, { ...PUBLISHED, sorts: CREATED_ASC });
  for (const page of rows) {
    const auId = getSelect(page, "AU");
    if (!auId) {
      console.warn(`  ! AU 게시글 "${getTitle(page, "제목")}" 에 AU 가 없어 건너뜀`);
      continue;
    }
    if (reuse(page, "auPosts")) continue;

    const id = shortId(page.id);
    const files = [];
    const body = await pageBody(page, files);
    const target = rel("public", "data", "au-posts", auId, `${id}.md`);
    writeText(
      target,
      frontmatter({
        title: getTitle(page, "제목"),
        date: getDate(page, "날짜"),
        preview: getText(page, "미리보기"),
      }) + body + "\n"
    );
    files.push(target);
    record(page, "auPosts", files);
  }
  cleanTree("public/data/au-posts");
  console.log(`✓ AU 게시글 ${rows.length}건`);
}

async function syncDocPage(pageId, ds, targetRel) {
  const page = await getPage(pageId);
  if (reuse(page, ds)) return;
  const files = [];
  const body = await pageBody(page, files);
  writeText(targetRel, body + "\n");
  files.push(targetRel);
  record(page, ds, files);
  console.log(`✓ ${targetRel}`);
}

async function syncTimeline() {
  const rows = await queryAll(dbs.timeline, { ...PUBLISHED, sorts: CREATED_ASC });
  rows.sort(byDate("날짜"));
  writeJson(
    "public/data/timeline.json",
    rows.map((page, i) => ({
      id: `tl-${i + 1}`,
      date: getDate(page, "날짜"),
      title: getTitle(page, "제목"),
      description: getText(page, "설명"),
      category: getSelect(page, "카테고리"),
    }))
  );
  console.log(`✓ 타임라인 ${rows.length}건`);
}

async function syncPlaylist() {
  const rows = await queryAll(dbs.playlist, { ...PUBLISHED, sorts: CREATED_ASC });
  rows.sort(bySort("정렬"));
  writeJson(
    "public/data/playlist.json",
    rows.map((page, i) => {
      const lyrics = getText(page, "가사");
      // 유튜브 링크를 통째로 붙여넣어도 ID 만 추려낸다.
      const videoId = youtubeId(getText(page, "영상ID"));
      return {
        id: `pl-${i + 1}`,
        title: getTitle(page, "제목"),
        artist: getText(page, "아티스트"),
        duration: getText(page, "길이"),
        category: getSelect(page, "카테고리"),
        ...(lyrics ? { lyrics } : {}),
        ...(videoId ? { videoId } : {}),
      };
    })
  );
  console.log(`✓ 플레이리스트 ${rows.length}건`);
}

async function syncNeighbors() {
  const rows = await queryAll(dbs.neighbors, { ...PUBLISHED, sorts: CREATED_ASC });
  rows.sort(bySort("정렬"));
  const items = [];
  for (const page of rows) {
    const banner = getFiles(page, "배너")[0];
    let image = "";
    if (banner?.external) {
      image = banner.url;
    } else if (banner) {
      let filename = sanitizeFilename(banner.name || shortId(page.id));
      if (!path.extname(filename)) filename += extFromUrl(banner.url);
      const target = rel("public", "images", "notion", "neighbors", filename);
      if (!reuse(page, "neighbors")) {
        await download(banner.url, path.resolve(target));
        record(page, "neighbors", [target]);
      }
      image = target.replace(/^public\//, "");
    }
    const crop = getNumber(page, "크롭");
    const cropPosition = getNumber(page, "크롭위치");
    items.push({
      name: getTitle(page, "이름"),
      image,
      url: getUrl(page, "URL"),
      ...(crop != null ? { crop } : {}),
      ...(cropPosition != null ? { cropPosition } : {}),
    });
  }
  writeJson("public/data/neighbors.json", items);
  cleanTree("public/data/neighbors"); // 노션 이관 후 기존 이미지 폴더는 비운다
  console.log(`✓ 이웃 ${rows.length}건`);
}

async function syncGallery() {
  const rows = await queryAll(dbs.gallery, { ...PUBLISHED, sorts: CREATED_ASC });
  for (const page of rows) {
    const section = getSelect(page, "섹션");
    if (!section) {
      console.warn(`  ! 갤러리 "${getTitle(page, "이름")}" 에 섹션이 없어 건너뜀`);
      continue;
    }
    if (reuse(page, "gallery")) continue;

    const dir = section.startsWith("au-")
      ? rel("public", "images", "gallery", "au", section)
      : rel("public", "images", "gallery", section);
    const caption = getText(page, "캡션");
    const files = [];
    for (const file of getFiles(page, "이미지")) {
      let filename = sanitizeFilename(file.name || shortId(page.id));
      if (!path.extname(filename)) filename += extFromUrl(file.url);
      const target = rel(dir, filename);
      await download(file.url, path.resolve(target));
      files.push(target);
      expected.add(target);
      if (caption) {
        const txt = target.replace(/\.[^.]+$/, ".txt");
        writeText(txt, caption + "\n");
        files.push(txt);
      }
    }
    record(page, "gallery", files);
  }
  cleanTree("public/images/gallery");
  console.log(`✓ 갤러리 ${rows.length}건`);
}

/**
 * AU 목록. AU DB(평면 속성) + AU 멤버 DB(행 단위 멤버)를 조인한다.
 * 페이지 본문의 인용 블록은 "멤버이름: 대사" 형식의 quotes 로 파싱되고,
 * 나머지 블록이 content 가 된다.
 */
async function syncAu() {
  const membersByAu = new Map();
  if (dbs.auMembers) {
    const memberRows = await queryAll(dbs.auMembers, { ...PUBLISHED, sorts: CREATED_ASC });
    memberRows.sort(bySort("정렬"));
    for (const m of memberRows) {
      const auId = getText(m, "AU") || getSelect(m, "AU");
      if (!auId) {
        console.warn(`  ! AU 멤버 "${getTitle(m, "이름")}" 에 AU 가 없어 건너뜀`);
        continue;
      }
      let imageUrl = "";
      const img = getFiles(m, "이미지")[0];
      if (img?.external) {
        imageUrl = img.url;
      } else if (img) {
        const target = rel("public", "images", "notion", shortId(m.id), `member${extFromUrl(img.url)}`);
        if (!reuse(m, "auMembers")) {
          await download(img.url, path.resolve(target));
          record(m, "auMembers", [target]);
        }
        imageUrl = "/" + target.replace(/^public\//, "");
      }
      const note = getText(m, "노트");
      const list = membersByAu.get(auId) ?? [];
      list.push({
        name: getTitle(m, "이름"),
        role: getText(m, "역할"),
        imageUrl,
        descriptions: getText(m, "소개").split("\n").map((s) => s.trim()).filter(Boolean),
        ...(note ? { note } : {}),
      });
      membersByAu.set(auId, list);
    }
  }

  const rows = await queryAll(dbs.au, { ...PUBLISHED, sorts: CREATED_ASC });
  rows.sort(bySort("정렬"));
  const items = [];
  for (const page of rows) {
    const id = getText(page, "ID") || shortId(page.id);
    const members = membersByAu.get(id) ?? [];
    const files = [];

    let imageUrl = "";
    const cover = getFiles(page, "대표이미지")[0];
    if (cover?.external) {
      imageUrl = cover.url;
    } else if (cover) {
      const target = rel("public", "images", "notion", shortId(page.id), `cover${extFromUrl(cover.url)}`);
      await download(cover.url, path.resolve(target));
      files.push(target);
      imageUrl = "/" + target.replace(/^public\//, "");
    }

    // 본문: 인용 블록 → quotes, 나머지 → content
    const blocks = await listBlocks(page.id);
    const quotes = [];
    const rest = [];
    for (const b of blocks) {
      if (b.type !== "quote") {
        rest.push(b);
        continue;
      }
      const text = richTextToPlain(b.quote?.rich_text ?? []).trim();
      if (!text) continue;
      const ci = text.indexOf(":");
      const name = ci > 0 ? text.slice(0, ci).trim() : "";
      const idx = members.findIndex((m) => m.name === name);
      quotes.push({
        memberIndex: idx >= 0 ? idx : 0,
        text: idx >= 0 ? text.slice(ci + 1).trim() : text,
      });
    }
    const ctx = {
      saveImage: async (url, blockId) => {
        const target = rel("public", "images", "notion", shortId(page.id), `${shortId(blockId)}${extFromUrl(url)}`);
        await download(url, path.resolve(target));
        files.push(target);
        return "/" + target.replace(/^public\//, "");
      },
    };
    const content = await blocksToMarkdown(rest, ctx);

    const imagePosition = getText(page, "이미지위치");
    const section = getSelect(page, "섹션");
    items.push({
      id,
      title: getTitle(page, "제목"),
      description: getText(page, "설명"),
      imageUrl,
      ...(imagePosition ? { imagePosition } : {}),
      tags: getMultiSelect(page, "태그"),
      ...(section ? { section } : {}),
      members,
      content,
      ...(quotes.length ? { quotes } : {}),
    });
    record(page, "au", files);
  }
  console.log(`✓ AU ${rows.length}건`);
  return items;
}

/** db.json 형태의 목록들 → notion.json (프론트에서 해당 키만 덮어쓴다). */
async function syncDbLists() {
  const out = {};
  if (dbs.au) out.au = await syncAu();
  if (dbs.youtube) {
    const rows = await queryAll(dbs.youtube, { ...PUBLISHED, sorts: CREATED_ASC });
    rows.sort(bySort("정렬"));
    out.youtube = rows.map((page, i) => ({
      id: `yt-${i + 1}`,
      videoId: youtubeId(getText(page, "영상ID")),
      title: getTitle(page, "제목"),
      category: getSelect(page, "카테고리"),
    }));
    console.log(`✓ 유튜브 ${rows.length}건`);
  }
  if (Object.keys(out).length) writeJson("public/data/notion.json", out);
}

/* ------------------------------------------------------------------ 실행 */

async function main() {
  // 이번에 동기화하지 않는 데이터셋의 기존 산출물은 그대로 유지한다.
  const active = new Set(
    [
      dbs.posts && "posts",
      dbs.auPosts && "auPosts",
      dbs.neighbors && "neighbors",
      dbs.gallery && "gallery",
      dbs.au && "au",
      dbs.auMembers && "auMembers",
      pages.notice && "notice",
      pages.memo && "memo",
    ].filter(Boolean)
  );
  for (const [pageId, entry] of Object.entries(manifest)) {
    if (!active.has(entry.ds)) {
      next[pageId] = entry;
      entry.files.forEach((f) => expected.add(f));
    }
  }

  if (dbs.posts) await syncPosts();
  if (dbs.auPosts) await syncAuPosts();
  if (pages.notice) await syncDocPage(pages.notice, "notice", "public/data/notice.md");
  if (pages.memo) await syncDocPage(pages.memo, "memo", "public/data/memo.md");
  if (dbs.timeline) await syncTimeline();
  if (dbs.playlist) await syncPlaylist();
  if (dbs.neighbors) await syncNeighbors();
  if (dbs.gallery) await syncGallery();
  await syncDbLists();

  cleanTree("public/images/notion");
  saveManifest(next);
  console.log("동기화 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
