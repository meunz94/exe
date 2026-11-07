/**
 * public/data 의 샘플(또는 현재) 데이터를 노션 DB 에 행으로 넣는다 (초기 1회용).
 *
 *   npm run notion:seed            # 비어 있는 DB 에만 넣는다
 *   npm run notion:seed -- --force # 이미 행이 있어도 추가한다 (중복 주의)
 *   npm run notion:seed -- --skip=slides,playlist
 *
 * 랜딩 슬라이드는 이미지가 필요해 기본으로 건너뛴다 (--only=slides 로 따로).
 * 넣은 뒤 `npm run notion:sync` 를 돌리면 같은 파일이 노션에서 다시 내려온다.
 */
import fs from "fs";
import path from "path";
import { loadConfig, notion, queryAll, markdownToBlocks, textItems } from "./notion-lib.mjs";

const dbs = loadConfig().databases ?? {};
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const SKIP = new Set((args.find((a) => a.startsWith("--skip="))?.slice(7) ?? "slides").split(",").filter(Boolean));
const ONLY = new Set((args.find((a) => a.startsWith("--only="))?.slice(7) ?? "").split(",").filter(Boolean));

const DATA = "public/data";
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null);
const readMd = (p) => {
  const raw = fs.readFileSync(p, "utf-8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (!kv) continue;
      try {
        fm[kv[1]] = JSON.parse(kv[2]);
      } catch {
        fm[kv[1]] = kv[2];
      }
    }
  }
  return { fm, body: m ? raw.slice(m[0].length).trim() : raw.trim() };
};

/* ------------------------------------------------------------ 속성 빌더 */
const T = (s) => ({ title: textItems(String(s ?? "")) });
const R = (s) => ({ rich_text: s ? textItems(String(s)) : [] });
const S = (s) => (s ? { select: { name: String(s) } } : { select: null });
const MS = (arr) => ({ multi_select: [...new Set((arr ?? []).filter(Boolean))].map((name) => ({ name: String(name).replace(/,/g, " ") })) });
const N = (n) => ({ number: n === undefined || n === null || n === "" ? null : Number(n) });
const D = (d) => ({ date: d ? { start: String(d).slice(0, 10) } : null });
const C = (b) => ({ checkbox: !!b });
const U = (u) => ({ url: u && u !== "#" ? u : null });
const REL = (ids) => ({ relation: (ids ?? []).filter(Boolean).map((id) => ({ id })) });

const pairKey = (pair) => S(pair);

/* ------------------------------------------------------------ 생성 */
async function dbIsEmpty(key) {
  const rows = await notion("POST", `/databases/${dbs[key]}/query`, { page_size: 1 });
  return rows.results.length === 0;
}

async function shouldRun(key) {
  if (!dbs[key]) return false;
  if (ONLY.size) return ONLY.has(key);
  if (SKIP.has(key)) return false;
  if (!FORCE && !(await dbIsEmpty(key))) {
    console.log(`- ${key}: 이미 행이 있어 건너뜀 (--force 로 강제)`);
    return false;
  }
  return true;
}

async function createPage(key, properties, body = "") {
  const children = body ? await markdownToBlocks(body) : [];
  const page = await notion("POST", "/pages", {
    parent: { database_id: dbs[key] },
    properties,
    children: children.slice(0, 100),
  });
  for (let i = 100; i < children.length; i += 100) {
    await notion("PATCH", `/blocks/${page.id}/children`, { children: children.slice(i, i + 100) });
  }
  return page.id;
}

async function seedRows(key, label, rows) {
  if (!(await shouldRun(key))) return new Map();
  const ids = new Map();
  for (const [k, props, body] of rows) {
    ids.set(k, await createPage(key, props, body));
  }
  console.log(`+ ${label} ${rows.length}건`);
  return ids;
}

/* ------------------------------------------------------------ 데이터셋 */
const pairs = readJson(`${DATA}/pairs.json`) ?? [];
const site = readJson(`${DATA}/site.json`) ?? {};

async function main() {
  // 페어
  await seedRows(
    "pairs",
    "페어",
    pairs.map((p) => [
      p.id,
      {
        이름: T(p.name),
        ID: R(p.id),
        코드: R(p.code),
        태그라인: R(p.tagline),
        제목위: R(p.titleTop),
        제목아래: R(p.titleBottom),
        강조색: R(p.accent),
        강조색다크: R(p.accentDark),
        초록제목: R(p.abstractTitle),
        초록부제: R(p.abstractSub),
        시놉시스: R(p.synopsis),
        인물한줄: R(p.subjectsLine),
        관계키워드: MS(p.relation?.keywords),
        관계설명: R(p.relation?.text),
        기본: C(p.id === site.defaultPair),
      },
    ])
  );

  // 랜딩 슬라이드 (기본 skip)
  await seedRows(
    "slides",
    "랜딩 슬라이드",
    pairs.flatMap((p) =>
      (p.slides ?? []).map((s, i) => [`${p.id}-${i}`, { 캡션: T(s.caption), 페어: pairKey(p.id), 정렬: N(i + 1) }])
    )
  );

  // 사이트 설정
  await seedRows("site", "사이트 설정", [
    ["aiBoards", { 키: T("aiBoards"), 값: R((site.aiBoards ?? ["diary", "guestbook"]).join(",")) }],
    ["guestbookEndpoint", { 키: T("guestbookEndpoint"), 값: R(site.guestbookEndpoint) }],
    ["banner.code", { 키: T("banner.code"), 값: R(site.banner?.code) }],
    ["banner.image", { 키: T("banner.image"), 값: R("") }],
  ]);

  // 인물 · 주변 인물
  const subjRows = [];
  const peopleSrc = [];
  for (const p of pairs) {
    const sj = readJson(`${DATA}/${p.id}/subjects.json`);
    if (!sj) continue;
    (sj.subjects ?? []).forEach((s, i) => {
      const body = (s.sections ?? [])
        .map((sec) => `## ${sec.no} ${sec.en} / ${sec.ko}\n\n${sec.md}`)
        .join("\n\n");
      subjRows.push([
        `${p.id}/${s.id}`,
        {
          이름: T(s.name),
          페어: pairKey(p.id),
          ID: R(s.id),
          큰이름: R(s.big),
          라벨: R(s.label),
          역할: R(s.role),
          테마색: R(s.color),
          테마색다크: R(s.colorDark),
          키워드: MS(s.keywords),
          스펙: R((s.specs ?? []).map((x) => `${x.k}: ${x.v}`).join("\n")),
          호칭: R(s.call),
          대사: R((s.quotes ?? []).map((set) => set.join("\n")).join("\n\n")),
          정렬: N(i + 1),
        },
        body,
      ]);
    });
    (sj.people ?? []).forEach((x) => peopleSrc.push({ pair: p.id, x, subjects: sj.subjects ?? [] }));
  }
  const subjectIds = await seedRows("subjects", "인물", subjRows);
  // 같은 사람이 양쪽(A·B)에 있으면 한 행에 인물 둘을 연결한다
  const peopleRows = [];
  const peopleSeen = new Map();
  for (const { pair, x, subjects } of peopleSrc) {
    const w = x.with === "B" ? [1] : x.with === "A" ? [0] : [0, 1];
    const ids = w.map((i) => subjectIds.get(`${pair}/${subjects[i]?.id}`)).filter(Boolean);
    const key = `${pair}/${x.name}`;
    const relKey = x.with === "B" ? "관계B" : "관계A";
    if (peopleSeen.has(key)) {
      const prev = peopleSeen.get(key);
      prev.인물.relation.push(...ids.map((id) => ({ id })));
      prev[relKey] = R(x.relation);
      continue;
    }
    const props = { 이름: T(x.name), 페어: pairKey(pair), 인물: REL(ids), [relKey]: R(x.relation), 공개: C(true) };
    peopleSeen.set(key, props);
    peopleRows.push([`${pair}/${x.id}`, props, x.md ?? ""]);
  }
  await seedRows("people", "주변 인물", peopleRows);

  // 타임라인 (관련로그는 로그를 만든 뒤 채운다)
  const chapters = [];
  for (const p of pairs) {
    for (const [i, ch] of (readJson(`${DATA}/${p.id}/timeline.json`) ?? []).entries()) chapters.push({ pair: p.id, i, ch });
  }
  const chapterIds = await seedRows(
    "timeline",
    "타임라인",
    chapters.map(({ pair, i, ch }) => {
      const scenes = (ch.scenes ?? [])
        .map((sc) => {
          const ls = (sc.lines ?? []).map((l) => (l.who ? `${l.who}: ${l.text}` : l.text)).join("\n\n");
          return `## SCENE ${sc.no} · ${sc.place}\n\n${ls}`;
        })
        .join("\n\n");
      return [
        `${pair}/${ch.id}`,
        {
          제목: T(ch.title),
          페어: pairKey(pair),
          ID: R(ch.id),
          DAY: R(ch.day),
          강조: C(!!ch.major),
        },
        [ch.body, scenes].filter(Boolean).join("\n\n"),
      ];
    })
  );

  // 로그
  const logRows = [];
  for (const p of pairs) {
    const dir = `${DATA}/${p.id}/logs`;
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const { fm, body } = readMd(path.join(dir, f));
      logRows.push([
        `${p.id}/${String(fm.no)}`,
        {
          제목: T(fm.title),
          페어: pairKey(p.id),
          날짜: D(fm.date),
          구분: S(String(fm.kind ?? "ORIGINAL").toUpperCase() === "AU" ? "AU" : "ORIGINAL"),
          소제목: R(fm.subtitle),
          태그: MS(fm.tags),
          사진설명: R(fm.caption),
          공개: C(true),
        },
        body,
      ]);
    }
  }
  const logIds = await seedRows("logs", "로그", logRows);

  // 타임라인 ← 관련로그 (있는 로그만 관계로 연결. 없는 번호는 버린다)
  if (chapterIds.size) {
    for (const { pair, ch } of chapters) {
      const pageId = chapterIds.get(`${pair}/${ch.id}`);
      const nums = ch.logs ?? [];
      const linked = nums.map((n) => logIds.get(`${pair}/${String(Number(n))}`)).filter(Boolean);
      if (!linked.length) continue;
      await notion("PATCH", `/pages/${pageId}`, { properties: { 관련로그: REL(linked) } });
    }
  }

  // 스토리
  const storyRows = [];
  for (const p of pairs) {
    const dir = `${DATA}/${p.id}/stories`;
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const { fm, body } = readMd(path.join(dir, f));
      storyRows.push([
        `${p.id}/${f}`,
        {
          제목: T(fm.title),
          페어: pairKey(p.id),
          권: N(fm.vol),
          요약: R(fm.abstract),
          소속: R((fm.affiliations ?? []).join("\n")),
          쪽: R(fm.pages),
        },
        body,
      ]);
    }
  }
  await seedRows("stories", "스토리", storyRows);

  // 일기장
  const diaryRows = [];
  for (const p of pairs) {
    const dir = `${DATA}/${p.id}/diary`;
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const { fm, body } = readMd(path.join(dir, f));
      diaryRows.push([
        `${p.id}/${String(fm.no).padStart(3, "0")}`,
        {
          제목: T(fm.title),
          페어: pairKey(p.id),
          날짜: D(fm.date),
          작성자: S(fm.author),
          공개: C(true),
        },
        body,
      ]);
    }
  }
  const diaryIds = await seedRows("diary", "일기장", diaryRows);

  // 방명록
  const guest = readJson(`${DATA}/guestbook.json`) ?? [];
  const guestIds = await seedRows(
    "guestbook",
    "방명록",
    guest.map((g) => [g.id, { 내용: T(g.text), 이름: R(g.who), 날짜: D(g.date), 출처: S("사람"), 공개: C(true) }])
  );

  // 댓글 (답글대상은 두 단계)
  const comments = readJson(`${DATA}/comments.json`) ?? [];
  const commentIds = new Map();
  if (await shouldRun("comments")) {
    for (const c of comments) {
      const diaryPage = c.target === "diary" ? diaryIds.get(`${c.pair ?? pairs[0]?.id}/${c.targetId}`) : null;
      const guestPage = c.target === "guestbook" ? guestIds.get(c.targetId) : null;
      if (!diaryPage && !guestPage) {
        console.warn(`  ! 댓글 ${c.id}: 대상 글을 찾지 못해 건너뜀`);
        continue;
      }
      const id = await createPage("comments", {
        내용: T(c.content),
        일기: REL([diaryPage]),
        방명록: REL([guestPage]),
        작성자: S(c.author),
        출처: S(c.source || "사람"),
        날짜: D(c.date),
        각주: N(c.anchor),
        답글대상: REL([commentIds.get(c.replyTo)]),
        공개: C(true),
      });
      commentIds.set(c.id, id);
    }
    console.log(`+ 댓글 ${commentIds.size}건`);
  }

  // AU — 프로필은 본문 `## 이름` 섹션으로
  const auRows = [];
  for (const p of pairs) {
    for (const au of readJson(`${DATA}/${p.id}/au.json`) ?? []) {
      const body = (au.members ?? [])
        .map((m) => [`## ${m.name}`, ...(m.lines ?? [])].join("\n"))
        .join("\n\n");
      auRows.push([
        au.id,
        {
          제목: T(au.title),
          페어: pairKey(p.id),
          설명: R(au.description),
          시놉시스: R(au.synopsis),
          공개: C(true),
        },
        body,
      ]);
    }
  }
  await seedRows("au", "AU", auRows);

  // 링크 · 이웃
  const links = readJson(`${DATA}/links.json`) ?? [];
  await seedRows(
    "links",
    "Elsewhere 링크",
    links.map((l, i) => [`l${i}`, { 이름: T(l.name), URL: U(l.url), 설명: R(l.desc), 공개: C(true) }])
  );
  const neighbors = readJson(`${DATA}/neighbors.json`) ?? [];
  await seedRows(
    "neighbors",
    "이웃",
    neighbors.map((n) => [`n${i}`, { 이름: T(n.name), URL: U(n.url), 공개: C(true) }])
  );

  // 플레이리스트 (페어별 파일이 같은 곡이면 한 번만)
  const seen = new Map();
  for (const p of pairs) {
    for (const t of readJson(`${DATA}/${p.id}/playlist.json`) ?? []) {
      const k = `${t.title}|${t.artist}|${t.videoId ?? ""}`;
      const e = seen.get(k) ?? { ...t, pairs: [] };
      e.pairs.push(p.id);
      seen.set(k, e);
    }
  }
  await seedRows(
    "playlist",
    "플레이리스트",
    [...seen.values()].map((t, i) => [
      `pl${i}`,
      {
        제목: T(t.title),
        아티스트: R(t.artist),
        영상ID: R(t.videoId),
        페어: t.pairs.length === pairs.length ? S(null) : pairKey(t.pairs[0]),
        정렬: N(i + 1),
      },
    ])
  );

  console.log("완료 — npm run notion:sync 로 되돌려 받아 확인하세요.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
