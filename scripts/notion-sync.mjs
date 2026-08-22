/**
 * 노션 → 사이트 데이터 동기화.
 *
 * notion.config.json 에 ID 가 채워진 데이터셋만 동기화한다. 출력은 기존
 * 데이터 파일 형태 그대로라서 (public/data/*.json, md 파일, 갤러리 이미지)
 * 이후 빌드는 기존 generate-* 스크립트가 그대로 처리한다.
 *
 * 동기화가 소유하는 경로 — 해당 데이터셋이 설정된 경우 노션에 없는 파일은 삭제된다:
 *   public/data/posts/<게시판>/** (template.md 제외)
 *   public/data/au-posts/**
 *   public/data/neighbors/**    (→ public/images/notion/neighbors 로 대체)
 *   public/images/gallery/**
 *   public/images/notion/**
 *   notice.md, memo.md, playlist.json, neighbors.json, notion.json
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
  getCheckbox,
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
    const board = getSelect(page, "게시판");
    if (!board) {
      console.warn(`  ! 게시글 "${getTitle(page, "제목")}" 에 게시판이 없어 건너뜀`);
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
    const target = rel("public", "data", "posts", board, `${id}.md`);
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

    const dir = /^au[-_]/.test(section)
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
  const chips = [];

  for (const page of rows) {
    // 통합 DB: 종류=시리즈 인 행은 칩(sidebarItems), 나머지는 AU
    if (getSelect(page, "종류") === "시리즈") {
      const synopsis = getText(page, "시놉시스");
      chips.push({
        id: getText(page, "ID") || shortId(page.id),
        label: getTitle(page, "제목"),
        category: getSelect(page, "카테고리") ?? "",
        ...(synopsis ? { synopsis } : {}),
        ...(getCheckbox(page, "AU있음") ? { hasAu: true } : {}),
      });
      continue;
    }

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
  console.log(`✓ 칩 ${chips.length}건 · AU ${items.length}건`);
  return { chips, aus: items };
}

/** db.json 형태의 목록들 → notion.json (프론트에서 해당 키만 덮어쓴다). */
/** 노션 파일 속성 하나를 public/images/notion/<dir>/ 로 내려받고 상대경로를 돌려준다. */
async function pullImage(page, prop, ds, dir, suffix = "") {
  const file = getFiles(page, prop)[0];
  if (!file) return "";
  if (file.external) return file.url;
  let filename = sanitizeFilename(file.name || `${shortId(page.id)}${suffix}`);
  if (!path.extname(filename)) filename += extFromUrl(file.url);
  const target = rel("public", "images", "notion", dir, filename);
  await download(file.url, path.resolve(target));
  record(page, ds, [target]);
  return target.replace(/^public\//, "");
}

/** "이름 | 관계 | 설명" 형태의 여러 줄을 객체 배열로. */
function splitRows(text, keys) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return Object.fromEntries(keys.map((k, i) => [k, parts[i] ?? ""]));
    });
}

const lines = (text) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * 인물 → notion.json 의 agents
 * 속성: 이름(title) · ID · 카테고리(select) · 소속 · 직책 · 소개(줄바꿈=항목) ·
 *      이미지(files) · 대표이미지(files) · 서브타이틀 · 코드네임 · 분류 · 속성 ·
 *      나이국적 · 평가 · 능력개요 · 능력스킬(줄바꿈) · 버서크 · 키체격 · 머리눈 ·
 *      복장 · 관계("이름 | 관계 | 설명" 여러 줄) · TMI("제목 | 내용" 여러 줄) ·
 *      정렬 · 공개
 */
async function syncAgents() {
  const rows = await queryAll(dbs.agents, { ...PUBLISHED, sorts: CREATED_ASC });
  rows.sort(bySort("정렬"));
  const items = [];
  for (const [i, page] of rows.entries()) {
    const fresh = !reuse(page, "agents");
    const imageUrl = fresh ? await pullImage(page, "이미지", "agents", "agents") : "";
    const heroImageUrl = fresh
      ? await pullImage(page, "대표이미지", "agents", "agents", "-hero")
      : "";
    const berserkSign = getText(page, "버서크");
    const tmi = splitRows(getText(page, "TMI"), ["title", "text"]);
    items.push({
      id: getText(page, "ID") || `ag-${i + 1}`,
      name: getTitle(page, "이름"),
      description: lines(getText(page, "소개")),
      imageUrl,
      category: getSelect(page, "카테고리") ?? "",
      detail: {
        heroImageUrl,
        subtitle: getText(page, "서브타이틀"),
        title: getTitle(page, "이름"),
        descriptions: lines(getText(page, "소개")),
        profile: {
          codename: getText(page, "코드네임"),
          classification: getText(page, "분류"),
          attribute: getText(page, "속성"),
          "age & nationality": getText(page, "나이국적"),
          evaluation: getText(page, "평가"),
        },
        ability: {
          overview: getText(page, "능력개요"),
          skills: lines(getText(page, "능력스킬")),
          ...(berserkSign ? { berserkSign } : {}),
        },
        appearance: {
          "height & build": getText(page, "키체격"),
          "hair & eyes": getText(page, "머리눈"),
          outfit: getText(page, "복장"),
        },
        ...(tmi.length ? { tmi } : {}),
        relations: splitRows(getText(page, "관계"), ["name", "relation", "description"]),
      },
    });
  }
  console.log(`✓ 인물 ${items.length}건`);
  return items;
}

async function syncDbLists() {
  const out = {};
  if (dbs.au) {
    const { chips, aus } = await syncAu();
    out.sidebarItems = chips;
    out.au = aus;
  }
  if (dbs.agents) out.agents = await syncAgents();
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

/**
 * PAPERS 스크립트 → public/data/scripts/<파일명>.md
 * 속성: 제목(title) · 날짜(date) · 분류(select: ORG|AU) · 파일명(rich_text, 선택) · 공개(checkbox)
 */
async function syncScripts() {
  const rows = await queryAll(dbs.scripts, { ...PUBLISHED, sorts: CREATED_ASC });
  for (const page of rows) {
    if (reuse(page, "scripts")) continue;
    const slug = sanitizeFilename(getText(page, "파일명") || shortId(page.id));
    const files = [];
    const body = await pageBody(page, files);
    const target = rel("public", "data", "scripts", `${slug}.md`);
    writeText(
      target,
      frontmatter({
        title: getTitle(page, "제목"),
        date: getDate(page, "날짜"),
        category: getSelect(page, "분류") === "AU" ? "AU" : "ORG",
      }) + body + "\n"
    );
    files.push(target);
    record(page, "scripts", files);
  }
  cleanTree("public/data/scripts");
  console.log(`✓ 스크립트 ${rows.length}건`);
}

/** pc-modules.json 은 세 데이터셋이 나눠 쓰므로 병합해서 쓴다. */
function readModules() {
  const abs = path.resolve("public/data/pc-modules.json");
  const base = { schedule: {}, stations: [], heart: {} };
  if (!fs.existsSync(abs)) return base;
  try {
    return { ...base, ...JSON.parse(fs.readFileSync(abs, "utf-8")) };
  } catch {
    return base;
  }
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAY_ALIAS = {
  월: "MON", 화: "TUE", 수: "WED", 목: "THU", 금: "FRI", 토: "SAT", 일: "SUN",
  MON: "MON", TUE: "TUE", WED: "WED", THU: "THU", FRI: "FRI", SAT: "SAT", SUN: "SUN",
};

/**
 * 루틴(일과) → pc-modules.json 의 schedule
 * 속성: 일정(title) · 담당(select) · 요일(multi_select: 월~일) ·
 *      시작(number, 예 13.5) · 종료(number) · 장소(rich_text) · 부하도(number 0-100) · 공개
 */
async function syncRoutine() {
  const rows = await queryAll(dbs.routine, PUBLISHED);
  const schedule = Object.fromEntries(WEEKDAYS.map((w) => [w, []]));

  for (const page of rows) {
    const agent = getSelect(page, "담당");
    const days = getMultiSelect(page, "요일")
      .map((d) => WEEKDAY_ALIAS[d])
      .filter(Boolean);
    const start = getNumber(page, "시작");
    const end = getNumber(page, "종료");
    if (!agent || days.length === 0 || start === null || end === null) {
      console.warn(`  ! 루틴 "${getTitle(page, "일정")}" 속성이 비어 건너뜀`);
      continue;
    }
    const block = {
      start,
      end,
      label: getTitle(page, "일정"),
      place: getText(page, "장소"),
      load: getNumber(page, "부하도") ?? 30,
    };
    for (const day of days) {
      let lane = schedule[day].find((l) => l.agent === agent);
      if (!lane) {
        lane = { agent, blocks: [] };
        schedule[day].push(lane);
      }
      lane.blocks.push(block);
    }
  }

  for (const day of WEEKDAYS) {
    schedule[day].forEach((lane) => lane.blocks.sort((a, b) => a.start - b.start));
  }

  writeJson("public/data/pc-modules.json", { ...readModules(), schedule });
  console.log(`✓ 루틴 ${rows.length}건`);
}

/**
 * 라디오 방송국 → pc-modules.json 의 stations
 * 속성: 방송국(title) · 주파수(number) · 대사(rich_text) · 공개
 * 대사는 한 줄에 한 대사, `V: 내용` / `B: 내용` 형식.
 */
async function syncRadio() {
  const rows = await queryAll(dbs.radio, PUBLISHED);
  const stations = rows
    .map((page) => {
      const freq = getNumber(page, "주파수");
      if (freq === null) {
        console.warn(`  ! 방송국 "${getTitle(page, "방송국")}" 에 주파수가 없어 건너뜀`);
        return null;
      }
      const lines = getText(page, "대사")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^([A-Za-z가-힣]{1,6})\s*[:：]\s*(.+)$/);
          return m ? { who: m[1], text: m[2] } : { who: "", text: line };
        });
      return { freq, name: getTitle(page, "방송국"), lines };
    })
    .filter(Boolean)
    .sort((a, b) => a.freq - b.freq);

  writeJson("public/data/pc-modules.json", { ...readModules(), stations });
  console.log(`✓ 라디오 ${stations.length}건`);
}

/* ------------------------------------------------------------------ 실행 */

async function main() {
  // 이번에 동기화하지 않는 데이터셋의 기존 산출물은 그대로 유지한다.
  const active = new Set(
    [
      dbs.posts && "posts",
      dbs.auPosts && "auPosts",
      dbs.scripts && "scripts",
      dbs.agents && "agents",
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
  if (dbs.playlist) await syncPlaylist();
  if (dbs.neighbors) await syncNeighbors();
  if (dbs.gallery) await syncGallery();
  if (dbs.scripts) await syncScripts();
  if (dbs.routine) await syncRoutine();
  if (dbs.radio) await syncRadio();
  await syncDbLists();

  cleanTree("public/images/notion");
  saveManifest(next);
  console.log("동기화 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
