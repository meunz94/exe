/**
 * 노션 → 사이트 데이터 동기화 (2026-11 재디자인 스키마).
 *
 * notion.config.json 의 databases 에 ID 가 채워진 데이터셋만 동기화한다.
 * 출력은 사이트가 그대로 읽는 파일이다 (docs/NOTION.md 의 표 참고):
 *
 *   public/data/site.json, pairs.json, neighbors.json, links.json, comments.json, guestbook.json
 *   public/data/<pair>/subjects.json, timeline.json, playlist.json
 *   public/data/<pair>/logs/<번호>.md, stories/vol-<권>.md, diary/<번호>.md
 *   public/images/notion/<page>/...   (노션 파일은 내려받아 저장, 이후 optimize-images 가 webp 로)
 *
 * 로그·스토리·일기의 목록 JSON 은 빌드 때 scripts/build-content.mjs 가 md 를 훑어 만든다.
 *
 * 동기화가 소유하는 경로(해당 데이터셋이 설정된 경우 노션에 없는 파일은 삭제):
 *   public/data/<pair>/logs/**, stories/**, diary/**, public/images/notion/**
 *
 * .notion-manifest.json 에 페이지별 last_edited_time 을 기록해 두고, 안 바뀐 페이지의
 * 본문 변환·이미지 다운로드는 건너뛴다.
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
  encryptText,
  richTextToPlain,
  richTextToMd,
  blocksToMarkdown,
  download,
  extFromUrl,
  shortId,
} from "./notion-lib.mjs";

const config = loadConfig();
const dbs = config.databases ?? {};

const manifest = loadManifest();
const next = {};
const expected = new Set();

const PUBLISHED = { filter: { property: "공개", checkbox: { equals: true } } };
const CREATED_ASC = [{ timestamp: "created_time", direction: "ascending" }];

const rel = (...parts) => parts.join("/");
const pad = (n, w = 2) => String(n).padStart(w, "0");
const slug = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
const lines = (s) => String(s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const getRelation = (page, name) => (page.properties?.[name]?.relation ?? []).map((r) => r.id);

function writeText(relPath, content) {
  const abs = path.resolve(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
  expected.add(relPath);
}
const writeJson = (relPath, value) => writeText(relPath, JSON.stringify(value, null, 2) + "\n");

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
async function pageBody(page, files, blocks) {
  const imgDir = rel("public", "images", "notion", shortId(page.id));
  const ctx = {
    saveImage: async (url, blockId) => {
      const target = rel(imgDir, `${shortId(blockId)}${extFromUrl(url)}`);
      await download(url, path.resolve(target));
      files.push(target);
      return "/" + target.replace(/^public\//, "");
    },
  };
  return blocksToMarkdown(blocks ?? (await listBlocks(page.id)), ctx);
}

/** files 속성의 첫 파일 → 사이트 경로. 외부 URL 은 그대로, 노션 파일은 내려받는다. (manifest 로 재사용) */
async function fileProp(page, name, ds, basename, files) {
  const f = getFiles(page, name)[0];
  if (!f) return "";
  if (f.external) return f.url;
  let target = rel("public", "images", "notion", shortId(page.id), `${basename}${extFromUrl(f.url)}`);
  // optimize-images 가 webp 로 바꿔 둔 파일이 있고 페이지가 그대로면 다시 받지 않는다 (받으면 webp 가 지워지고 재변환된다)
  const webp = target.replace(/\.(png|jpe?g|gif)$/i, ".webp");
  const unchanged = manifest[page.id]?.edited === page.last_edited_time;
  if (unchanged && webp !== target && fs.existsSync(path.resolve(webp))) target = webp;
  else if (!fs.existsSync(path.resolve(target)) || !unchanged) await download(f.url, path.resolve(target));
  files.push(target);
  expected.add(target);
  void ds;
  return "/" + target.replace(/^public\//, "");
}

function frontmatter(fields) {
  const out = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${out.join("\n")}\n---\n\n`;
}

function cleanTree(rootRel) {
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
        if (!expected.has(relPath)) {
          fs.rmSync(abs);
          console.log(`  - 삭제: ${relPath}`);
        }
      }
    }
  };
  walk(rootAbs);
}

const bySort = (prop) => (a, b) => (getNumber(a, prop) ?? Infinity) - (getNumber(b, prop) ?? Infinity);

/* ------------------------------------------------------------- 페어 */

/** 페어 목록. 다른 데이터셋이 페어 select 값(= 페어 ID)으로 묶인다. */
let pairs = [];
const pairIds = () => pairs.map((p) => p.id);
const pairOf = (page) => {
  const v = getSelect(page, "페어") || getText(page, "페어");
  if (v && pairIds().includes(v)) return v;
  return pairs[0]?.id ?? "";
};

async function syncPairs() {
  const rows = await queryAll(dbs.pairs, { sorts: CREATED_ASC });
  const out = [];
  for (const page of rows) {
    const files = [];
    const id = slug(getText(page, "ID") || getTitle(page, "이름"));
    out.push({
      id,
      code: getText(page, "코드") || id.slice(0, 2).toUpperCase(),
      name: getTitle(page, "이름"),
      tagline: getText(page, "태그라인"),
      titleTop: getText(page, "제목위"),
      titleBottom: getText(page, "제목아래"),
      accent: getText(page, "강조색") || "#1821CF",
      accentDark: getText(page, "강조색다크") || "#6DEE00",
      abstractTitle: getText(page, "초록제목"),
      abstractSub: getText(page, "초록부제"),
      synopsis: getText(page, "시놉시스"),
      subjectsLine: getText(page, "인물한줄"),
      slides: [],
      relation: { keywords: getMultiSelect(page, "관계키워드"), text: getText(page, "관계설명") },
      _default: getCheckbox(page, "기본"),
    });
    record(page, "pairs", files);
  }
  pairs = out;
  console.log(`✓ 페어 ${out.length}건`);
}

async function syncSlides() {
  const rows = await queryAll(dbs.slides, { sorts: CREATED_ASC }); // 슬라이드는 공개 여부 없이 전부
  rows.sort(bySort("정렬"));
  for (const page of rows) {
    const pair = pairs.find((p) => p.id === pairOf(page));
    if (!pair) continue;
    const files = [];
    pair.slides.push({
      left: await fileProp(page, "왼쪽", "slides", "left", files),
      right: await fileProp(page, "오른쪽", "slides", "right", files),
      caption: getTitle(page, "캡션"),
    });
    record(page, "slides", files);
  }
  console.log(`✓ 슬라이드 ${rows.length}건`);
}

function writePairs() {
  const def = pairs.find((p) => p._default) ?? pairs[0];
  writeJson(
    "public/data/pairs.json",
    pairs.map(({ _default, ...p }) => {
      void _default;
      return p;
    })
  );
  return def?.id ?? "";
}

/* ------------------------------------------------------------- 사이트 설정 */

async function syncSite(defaultPair) {
  const rows = dbs.site ? await queryAll(dbs.site, {}) : [];
  const kv = {};
  for (const page of rows) {
    const key = getTitle(page, "키").trim();
    const files = [];
    const file = await fileProp(page, "파일", "site", slug(key), files);
    kv[key] = file || getText(page, "값");
    if (files.length) record(page, "site", files);
  }
  const prev = fs.existsSync("public/data/site.json") ? JSON.parse(fs.readFileSync("public/data/site.json", "utf-8")) : {};
  writeJson("public/data/site.json", {
    defaultPair: defaultPair || prev.defaultPair || "",
    banner: { image: kv["banner.image"] ?? prev.banner?.image ?? "", code: kv["banner.code"] ?? prev.banner?.code ?? "" },
    guestbookEndpoint: kv["guestbookEndpoint"] ?? prev.guestbookEndpoint ?? "",
    aiBoards: kv["aiBoards"] ? kv["aiBoards"].split(/[,\s]+/).filter(Boolean) : prev.aiBoards ?? ["diary", "guestbook"],
  });
  console.log(`✓ 사이트 설정`);
}

/* ------------------------------------------------------------- 인물 */

/** `## Appearance / 외형` 꼴 제목으로 본문을 섹션으로 나눈다. */
function splitSections(md) {
  const parts = md.split(/^##\s+(.+)$/m);
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    const head = parts[i].trim();
    const body = (parts[i + 1] ?? "").trim();
    const m = head.match(/^(?:(\d+)[.)]?\s+)?([^/·|]+?)(?:\s*[/·|]\s*(.+))?$/);
    const en = (m?.[2] ?? head).trim();
    const ko = (m?.[3] ?? "").trim();
    sections.push({ no: pad(m?.[1] ?? sections.length + 1), en, ko: ko || en, md: body });
  }
  if (!sections.length && md.trim()) sections.push({ no: "01", en: "About", ko: "소개", md: md.trim() });
  return sections;
}

/** "AGE: 29" 줄 목록 → specs */
const parseSpecs = (text) =>
  lines(text)
    .map((l) => l.match(/^([^:：]+)[:：]\s*(.*)$/))
    .filter(Boolean)
    .map((m) => ({ k: m[1].trim(), v: m[2].trim() }));

/** 대사: 줄 = 말풍선, 빈 줄 = 세트 구분 */
const parseQuotes = (text) =>
  String(text ?? "")
    .split(/\n\s*\n/)
    .map((set) => lines(set))
    .filter((set) => set.length);

/** 인물 페이지 ID → "A"(첫 번째) / "B"(두 번째) */
const subjectKeyByPage = new Map();

async function syncSubjects() {
  const subjRows = await queryAll(dbs.subjects, { sorts: CREATED_ASC }); // 인물은 공개 여부 없이 전부
  subjRows.sort(bySort("정렬"));
  const peopleRows = dbs.people ? await queryAll(dbs.people, { ...PUBLISHED, sorts: CREATED_ASC }) : [];

  const byPair = Object.fromEntries(pairIds().map((id) => [id, { subjects: [], people: [] }]));

  for (const page of subjRows) {
    const pair = pairOf(page);
    const files = [];
    const cached = reuse(page, "subjects") ? manifest[page.id]?.data : null;
    let data = cached;
    if (!data) {
      const body = await pageBody(page, files);
      data = {
        id: slug(getText(page, "ID") || getTitle(page, "이름")),
        no: pad(byPair[pair].subjects.length + 1), // 정렬 순서가 곧 번호 (01, 02)
        name: getTitle(page, "이름"),
        big: getText(page, "큰이름") || getTitle(page, "이름"),
        label: getText(page, "라벨"),
        role: getText(page, "역할"),
        color: getText(page, "테마색").trim(),
        colorDark: getText(page, "테마색다크").trim(),
        keywords: getMultiSelect(page, "키워드"),
        image: await fileProp(page, "이미지", "subjects", "portrait", files),
        specs: parseSpecs(getText(page, "스펙")),
        call: getText(page, "호칭"),
        quotes: parseQuotes(getText(page, "대사")),
        sections: splitSections(body),
      };
      record(page, "subjects", files);
      next[page.id].data = data;
    }
    subjectKeyByPage.set(page.id, (byPair[pair]?.subjects.length ?? 0) === 0 ? "A" : "B");
    byPair[pair]?.subjects.push(data);
  }

  for (const page of peopleRows) {
    const pair = pairOf(page);
    const files = [];
    let data = reuse(page, "people") ? manifest[page.id]?.data : null;
    if (!data) {
      const body = await pageBody(page, files);
      data = {
        id: shortId(page.id),
        name: getTitle(page, "이름"),
        relation: getText(page, "관계"),
        image: await fileProp(page, "이미지", "people", "avatar", files),
        md: body,
      };
      record(page, "people", files);
      next[page.id].data = data;
    }
    // 관계A / 관계B 에 각 캐릭터와의 관계를 따로 적는다. 적힌 쪽에만 나온다.
    // (둘 다 비어 있으면 예전 방식 — 인물(관계) 로 고른 캐릭터에 `관계` 를 같이 쓴다.)
    const perSubject = ["A", "B"].map((w) => [w, getText(page, `관계${w}`)]).filter(([, t]) => t);
    if (perSubject.length) {
      for (const [w, relation] of perSubject) byPair[pair]?.people.push({ ...data, relation, with: w });
    } else {
      const keys = [...new Set(getRelation(page, "인물").map((id) => subjectKeyByPage.get(id)).filter(Boolean))];
      for (const w of keys.length ? keys : ["A"]) byPair[pair]?.people.push({ ...data, with: w });
    }
  }

  for (const [pair, data] of Object.entries(byPair)) {
    writeJson(rel("public", "data", pair, "subjects.json"), data);
  }
  console.log(`✓ 인물 ${subjRows.length}건 · 주변 인물 ${peopleRows.length}건`);
}

/* ------------------------------------------------------------- 타임라인 */

const DIALOGUE = /^\s*(?:\*\*)?([A-Za-z가-힣.·'? ]{1,20}?)(?:\*\*)?\s*[:：]\s+(.+)$/s;

/** 본문: 장면 제목(`## SCENE 01 · 장소`) 앞은 본문, 뒤는 대사 목록 */
function splitChapter(md) {
  // 각주 정의(`[^1]: 내용`)는 어디에 있든 챕터 글 끝으로 모은다 — 장면 아래 적어도 지문으로 새지 않게
  const notes = [];
  md = md.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (m) => {
    notes.push(m);
    return "";
  });
  const parts = md.split(/^#{2,3}\s+(.+)$/m);
  const body = [(parts[0] ?? "").trim(), ...notes].filter(Boolean).join("\n\n");
  const scenes = [];
  for (let i = 1; i < parts.length; i += 2) {
    const head = parts[i].trim();
    const m = head.match(/^SCENE\s*(\d+)?\s*(?:[·/|-]\s*(.*))?$/i);
    const no = pad(m?.[1] ?? scenes.length + 1);
    const place = (m ? m[2] : head) ?? "";
    const ls = lines((parts[i + 1] ?? "").replace(/^>\s?/gm, "")).map((l) => {
      const d = l.match(DIALOGUE);
      return d ? { who: d[1].trim(), text: d[2].trim() } : { text: l };
    });
    scenes.push({ no, place: place.trim(), lines: ls });
  }
  return { body, scenes };
}

/** 스토리 페이지 ID → 스토리 사이트 id("vol-1-1"). stories 를 먼저 동기화해 채운다. */
const storyIdByPage = new Map();
/** 스토리 페이지 ID → 타임라인 챕터 id (타임라인의 `관련스토리` 관계에서 거꾸로 모은다) */
const chapterByStoryPage = new Map();

async function syncTimeline() {
  const rows = await queryAll(dbs.timeline, { sorts: CREATED_ASC });
  // 정렬은 노션 생성 순 (query 의 created_time 오름차순)
  const byPair = Object.fromEntries(pairIds().map((id) => [id, []]));
  for (const page of rows) {
    const pair = pairOf(page);
    const files = [];
    let data = reuse(page, "timeline") ? manifest[page.id]?.data : null;
    if (data && !("_storyPages" in data)) data = null; // 관계가 로그→스토리로 바뀌기 전 캐시
    if (!data) {
      const { body, scenes } = splitChapter(await pageBody(page, files));
      data = {
        id: slug(getText(page, "ID")) !== "item" ? slug(getText(page, "ID")) : `ch-${shortId(page.id)}`,
        day: getText(page, "DAY"),
        major: getCheckbox(page, "강조"),
        title: getTitle(page, "제목"),
        body,
        scenes,
        _storyPages: getRelation(page, "관련스토리"),
      };
      record(page, "timeline", files);
      next[page.id].data = data;
    }
    const { _storyPages, ...rest } = data;
    const ids = new Set((_storyPages ?? []).map((id) => storyIdByPage.get(id)).filter(Boolean));
    byPair[pair]?.push({ ...rest, stories: [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) });
  }
  for (const [pair, data] of Object.entries(byPair)) writeJson(rel("public", "data", pair, "timeline.json"), data);
  console.log(`✓ 타임라인 ${rows.length}건`);
}

/* ------------------------------------------------------------- 로그 · 스토리 · 일기 (md) */

const chapterIdByPage = new Map();

async function syncLogs() {
  const rows = await queryAll(dbs.logs, { ...PUBLISHED, sorts: CREATED_ASC });
  // 번호는 페어 안에서 생성 순으로 1 부터 — "001" 꼴 세 자리
  const counters = {};
  for (const page of rows) {
    const pair = pairOf(page);
    const no = pad((counters[pair] = (counters[pair] ?? 0) + 1), 3);
    if (reuse(page, "logs")) continue;
    const files = [];
    // 비밀번호가 있으면 잠금 글: 본문은 암호문으로만 싣고, 사진·소제목·본문 미리보기는 내보내지 않는다
    const password = getText(page, "비밀번호").trim();
    const photo = password ? "" : await fileProp(page, "사진", "logs", "photo", files);
    const body = await pageBody(page, files);
    const target = rel("public", "data", pair, "logs", `${no}.md`);
    writeText(
      target,
      frontmatter({
        no,
        date: getDate(page, "날짜"),
        kind: (getSelect(page, "구분") || "ORIGINAL").toUpperCase() === "AU" ? "AU" : "ORIGINAL",
        title: getTitle(page, "제목"),
        subtitle: password ? "" : getText(page, "소제목"),
        tags: getMultiSelect(page, "태그"),
        photo,
        caption: password ? "" : getText(page, "사진설명"),
        ...(password ? { locked: true, cipher: await encryptText(body, password) } : {}),
      }) + (password ? "" : body + "\n")
    );
    files.push(target);
    record(page, "logs", files);
  }
  for (const pair of pairIds()) cleanTree(rel("public", "data", pair, "logs"));
  console.log(`✓ 로그 ${rows.length}건`);
}

const pageStart = (p) => {
  const m = String(p ?? "").match(/\d+/);
  return m ? Number(m[0]) : Infinity;
};

async function syncStories() {
  const rows = await queryAll(dbs.stories, { sorts: CREATED_ASC });
  // 파일 이름(= URL id): 권 하나에 한 편이면 vol-1, 여러 편이면 쪽 시작값 순으로 vol-1-1, vol-1-2 …
  const groups = new Map();
  for (const page of rows) {
    const k = `${pairOf(page)}/${getNumber(page, "권") ?? 0}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(page);
  }
  const targetOf = new Map();
  for (const [k, list] of groups) {
    const [pair, vol] = k.split("/");
    list.sort((a, b) => pageStart(getText(a, "쪽")) - pageStart(getText(b, "쪽")));
    list.forEach((page, i) => {
      const name = Number(vol) ? (list.length > 1 ? `vol-${vol}-${i + 1}` : `vol-${vol}`) : `vol-${shortId(page.id)}`;
      targetOf.set(page.id, rel("public", "data", pair, "stories", `${name}.md`));
    });
  }
  for (const page of rows) {
    const target = targetOf.get(page.id);
    storyIdByPage.set(page.id, path.basename(target, ".md"));
    const chapter = chapterByStoryPage.get(page.id) ?? "";
    // 이름이 바뀌었거나(같은 권에 편이 늘거나 줄어서) 타임라인 연결이 바뀌었으면 캐시를 쓰지 않고 다시 쓴다
    if (manifest[page.id]?.files?.includes(target) && manifest[page.id]?.chapter === chapter && reuse(page, "stories")) continue;
    const files = [];
    const body = await pageBody(page, files);
    const vol = getNumber(page, "권") ?? 0;
    writeText(
      target,
      frontmatter({
        vol,
        title: getTitle(page, "제목"),
        abstract: getText(page, "요약"),
        affiliations: lines(getText(page, "소속")),
        pages: getText(page, "쪽"),
        chapter,
      }) + body + "\n"
    );
    files.push(target);
    record(page, "stories", files);
    next[page.id].chapter = chapter;
  }
  for (const pair of pairIds()) cleanTree(rel("public", "data", pair, "stories"));
  console.log(`✓ 스토리 ${rows.length}건`);
}

/** 일기 페이지 ID → 사이트 id(세 자리 번호) */
const diaryIdByPage = new Map();
const diaryPairByPage = new Map();

async function syncDiary() {
  const rows = await queryAll(dbs.diary, { ...PUBLISHED, sorts: CREATED_ASC });
  // 일기는 번호 속성이 없다 — 날짜순(같은 날짜면 생성순)으로 1 부터 매긴다
  rows.sort((a, b) => getDate(a, "날짜").localeCompare(getDate(b, "날짜")) || a.created_time.localeCompare(b.created_time));
  const counters = {};
  for (const page of rows) {
    const pair = pairOf(page);
    const no = (counters[pair] = (counters[pair] ?? 0) + 1);
    const id = pad(no, 3);
    diaryIdByPage.set(page.id, id);
    diaryPairByPage.set(page.id, pair);
    if (reuse(page, "diary")) continue;
    const files = [];
    const body = await pageBody(page, files);
    const target = rel("public", "data", pair, "diary", `${id}.md`);
    writeText(
      target,
      frontmatter({
        no,
        date: getDate(page, "날짜"),
        author: getSelect(page, "작성자") || getText(page, "작성자"),
        title: getTitle(page, "제목"),
      }) + body + "\n"
    );
    files.push(target);
    record(page, "diary", files);
  }
  for (const pair of pairIds()) cleanTree(rel("public", "data", pair, "diary"));
  console.log(`✓ 일기 ${rows.length}건`);
}

/* ------------------------------------------------------------- 방명록 · 댓글 */

const guestIdByPage = new Map();

async function syncGuestbook() {
  const rows = await queryAll(dbs.guestbook, { ...PUBLISHED, sorts: CREATED_ASC });
  const out = rows.map((page) => {
    const id = shortId(page.id);
    guestIdByPage.set(page.id, id);
    return {
      id,
      who: getText(page, "이름") || "[익명]",
      date: getDate(page, "날짜") || page.created_time.slice(0, 10),
      text: getTitle(page, "내용"),
    };
  });
  out.sort((a, b) => b.date.localeCompare(a.date));
  writeJson("public/data/guestbook.json", out);
  console.log(`✓ 방명록 ${out.length}건`);
}

async function syncComments() {
  const rows = await queryAll(dbs.comments, { ...PUBLISHED, sorts: CREATED_ASC });
  const out = [];
  for (const page of rows) {
    const diaryPage = getRelation(page, "일기")[0];
    const guestPage = getRelation(page, "방명록")[0];
    let target, targetId, pair;
    if (diaryPage && diaryIdByPage.has(diaryPage)) {
      target = "diary";
      targetId = diaryIdByPage.get(diaryPage);
      pair = diaryPairByPage.get(diaryPage);
    } else if (guestPage && guestIdByPage.has(guestPage)) {
      target = "guestbook";
      targetId = guestIdByPage.get(guestPage);
    } else {
      console.warn(`  ! 댓글 "${getTitle(page, "내용").slice(0, 20)}" 의 대상 글을 찾지 못해 건너뜀`);
      continue;
    }
    // 긴 댓글은 본문(페이지 내용)에 쓴다
    let content = getTitle(page, "내용");
    if (page.has_children !== false) {
      const blocks = await listBlocks(page.id);
      const body = richTextToPlain(blocks.flatMap((b) => b[b.type]?.rich_text ?? []));
      if (body.trim()) content = blocks.map((b) => richTextToMd(b[b.type]?.rich_text ?? [])).filter(Boolean).join("\n\n");
    }
    const anchor = getNumber(page, "각주");
    const replyTo = getRelation(page, "답글대상")[0];
    out.push({
      id: shortId(page.id),
      ...(pair ? { pair } : {}),
      target,
      targetId,
      author: getSelect(page, "작성자") || getText(page, "작성자") || "[익명]",
      source: getSelect(page, "출처") === "AI" ? "AI" : "사람",
      date: getDate(page, "날짜") || page.created_time.slice(0, 10),
      content,
      ...(anchor != null ? { anchor } : {}),
      ...(replyTo ? { replyTo: shortId(replyTo) } : {}),
    });
  }
  writeJson("public/data/comments.json", out);
  console.log(`✓ 댓글 ${out.length}건`);
}

/* ------------------------------------------------------------- AU (칩 라이브러리) */

/**
 * 본문 속 "갤러리" 하위 페이지의 이미지 블록 → 사이트 경로 배열.
 * (하위 페이지는 pageBody 의 마크다운에 들어가지 않으므로 따로 읽는다)
 */
async function galleryOf(page, blocks, files) {
  const sub = blocks.find((b) => b.type === "child_page" && b.child_page?.title?.trim() === "갤러리");
  if (!sub) return [];
  const out = [];
  const walk = async (list) => {
    for (const b of list) {
      if (b.type === "image") {
        const src = b.image?.[b.image.type]?.url ?? "";
        if (!src) continue;
        if (b.image.type === "external") {
          out.push(src);
          continue;
        }
        const target = rel("public", "images", "notion", shortId(page.id), `gallery-${shortId(b.id)}${extFromUrl(src)}`);
        if (!fs.existsSync(path.resolve(target))) await download(src, path.resolve(target));
        files.push(target);
        expected.add(target);
        out.push("/" + target.replace(/^public\//, ""));
      }
      if (b.children) await walk(b.children);
    }
  };
  await walk(await listBlocks(sub.id));
  return out;
}

/**
 * AU 본문 → { intro, members }.
 * 첫 `## ` 앞의 글은 시놉시스 뒤에 붙고, `## 이름` 섹션 하나가 프로필 하나다.
 * 섹션 안의 이미지는 프로필 사진, 나머지 문단은 소개 줄.
 */
function parseAuBody(md) {
  const intro = [];
  const members = [];
  let cur = null;
  for (const raw of String(md ?? "").split("\n")) {
    const line = raw.trim();
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      cur = { name: h[1].trim(), image: "", lines: [] };
      members.push(cur);
      continue;
    }
    if (!cur) {
      intro.push(raw);
      continue;
    }
    const img = line.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    if (img) {
      if (!cur.image) cur.image = img[1];
      continue;
    }
    if (line) cur.lines.push(line);
  }
  return { intro: intro.join("\n").trim(), members };
}

/**
 * AU DB → <페어>/au.json.
 * 프로필은 본문 `## 이름` 섹션, 갤러리는 본문 안의 "갤러리" 하위 페이지.
 * 칩 라벨 이미지는 public/images/chips/<ID>.webp 에 두면 자동으로 쓰인다.
 */
async function syncAu() {
  const rows = await queryAll(dbs.au, { ...PUBLISHED, sorts: CREATED_ASC });
  const byPair = Object.fromEntries(pairIds().map((id) => [id, []]));
  for (const page of rows) {
    const pair = pairOf(page);
    // 링크용 번호: 페어 안에서 생성 순 1, 2, 3…
    const id = String(byPair[pair].length + 1);
    const files = [];
    let data = reuse(page, "au") ? manifest[page.id]?.data : null;
    if (!data) {
      const bg = await fileProp(page, "대표이미지", "au", "cover", files);
      const label = await fileProp(page, "라벨", "au", "label", files);
      const box = await fileProp(page, "박스아트", "au", "box", files);
      const blocks = await listBlocks(page.id);
      const gallery = await galleryOf(page, blocks, files);
      const { intro, members } = parseAuBody(await pageBody(page, files, blocks));
      data = {
        id,
        title: getTitle(page, "제목"),
        description: getText(page, "설명"),
        synopsis: [getText(page, "시놉시스"), intro].filter(Boolean).join("\n\n"),
        members,
        gallery,
        bg,
        label,
        box,
      };
      record(page, "au", files);
      next[page.id].data = data;
    }
    byPair[pair]?.push(data);
  }
  for (const [pair, data] of Object.entries(byPair)) writeJson(rel("public", "data", pair, "au.json"), data);
  console.log(`✓ AU ${rows.length}건`);
}

/* ------------------------------------------------------------- 이웃 · 링크 · 플레이리스트 */

async function syncNeighbors() {
  const rows = await queryAll(dbs.neighbors, { ...PUBLISHED, sorts: CREATED_ASC });
  const items = [];
  for (const page of rows) {
    const files = [];
    const image = await fileProp(page, "배너", "neighbors", "banner", files);
    if (files.length) record(page, "neighbors", files);
    items.push({ name: getTitle(page, "이름"), image: image.replace(/^\//, ""), url: getUrl(page, "URL") });
  }
  writeJson("public/data/neighbors.json", items);
  console.log(`✓ 이웃 ${items.length}건`);
}

async function syncLinks() {
  const rows = await queryAll(dbs.links, { ...PUBLISHED, sorts: CREATED_ASC });
  writeJson(
    "public/data/links.json",
    rows.map((page) => ({ name: getTitle(page, "이름"), desc: getText(page, "설명"), url: getUrl(page, "URL") }))
  );
  console.log(`✓ 링크 ${rows.length}건`);
}

async function syncGallery() {
  const rows = await queryAll(dbs.gallery, { ...PUBLISHED, sorts: CREATED_ASC });
  const byPair = Object.fromEntries(pairIds().map((id) => [id, []]));
  for (const page of rows) {
    const pair = pairOf(page);
    if (!byPair[pair]) continue;
    const files = [];
    let data = reuse(page, "gallery") ? manifest[page.id]?.data : null;
    if (!data) {
      data = {
        id: shortId(page.id),
        title: getTitle(page, "제목"),
        caption: getText(page, "설명"),
        image: await fileProp(page, "이미지", "gallery", "image", files),
      };
      record(page, "gallery", files);
      next[page.id].data = data;
    }
    byPair[pair].push(data);
  }
  for (const [pair, data] of Object.entries(byPair)) writeJson(rel("public", "data", pair, "gallery.json"), data);
  console.log(`✓ 갤러리 ${rows.length}건`);
}

async function syncPlaylist() {
  const rows = await queryAll(dbs.playlist, { sorts: CREATED_ASC });
  rows.sort(bySort("정렬"));
  const byPair = Object.fromEntries(pairIds().map((id) => [id, []]));
  rows.forEach((page, i) => {
    const videoId = youtubeId(getText(page, "영상ID"));
    const item = { id: `pl-${i + 1}`, title: getTitle(page, "제목"), artist: getText(page, "아티스트"), ...(videoId ? { videoId } : {}) };
    const p = getSelect(page, "페어");
    const targets = p && byPair[p] ? [p] : pairIds();
    for (const t of targets) byPair[t].push(item);
  });
  for (const [pair, data] of Object.entries(byPair)) writeJson(rel("public", "data", pair, "playlist.json"), data);
  console.log(`✓ 플레이리스트 ${rows.length}건`);
}

/* ------------------------------------------------------------------ 실행 */

async function main() {
  const active = new Set(Object.entries(dbs).filter(([, id]) => id).map(([k]) => k));
  for (const [pageId, entry] of Object.entries(manifest)) {
    if (!active.has(entry.ds)) {
      next[pageId] = entry;
      entry.files.forEach((f) => expected.add(f));
    }
  }

  if (!dbs.pairs) {
    // 페어 DB 가 없으면 기존 pairs.json 을 페어 목록으로 쓴다
    pairs = fs.existsSync("public/data/pairs.json") ? JSON.parse(fs.readFileSync("public/data/pairs.json", "utf-8")) : [];
    console.log(`- 페어 DB 없음: pairs.json 의 ${pairs.length}건을 기준으로 진행`);
  } else {
    await syncPairs();
    if (dbs.slides) await syncSlides();
  }
  const defaultPair = dbs.pairs ? writePairs() : "";
  if (dbs.site || dbs.pairs) await syncSite(defaultPair);

  if (dbs.subjects) await syncSubjects();
  // 스토리 ↔ 타임라인은 서로를 참조한다: 스토리는 챕터 ID 가, 타임라인은 스토리 id 가 필요하다.
  // 타임라인 ID 와 `관련스토리` 관계를 먼저 수집해 두고, 스토리 → 타임라인 순으로 쓴다.
  if (dbs.timeline) {
    for (const page of await queryAll(dbs.timeline)) {
      const chId = slug(getText(page, "ID")) !== "item" ? slug(getText(page, "ID")) : `ch-${shortId(page.id)}`;
      chapterIdByPage.set(page.id, chId);
      for (const storyPage of getRelation(page, "관련스토리")) chapterByStoryPage.set(storyPage, chId);
    }
  }
  if (dbs.logs) await syncLogs();
  if (dbs.stories) await syncStories();
  if (dbs.timeline) await syncTimeline();
  if (dbs.diary) await syncDiary();
  if (dbs.guestbook) await syncGuestbook();
  if (dbs.comments) await syncComments();
  if (dbs.au) await syncAu();
  if (dbs.neighbors) await syncNeighbors();
  if (dbs.links) await syncLinks();
  if (dbs.gallery) await syncGallery();
  if (dbs.playlist) await syncPlaylist();

  cleanTree("public/images/notion");
  saveManifest(next);
  console.log("동기화 완료");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
