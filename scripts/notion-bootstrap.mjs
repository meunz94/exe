/**
 * 최초 1회: 노션에 데이터베이스/페이지를 만들고 현재 repo 데이터를 이관한다.
 *
 * 실행 전 준비물:
 *   1. 노션 내부 통합(integration) 생성 → 토큰
 *   2. 콘텐츠를 담을 노션 페이지 하나 (통합과 연결/공유되어 있어야 함)
 *
 * 사용:
 *   NOTION_TOKEN=... NOTION_PARENT_PAGE=<페이지ID> node scripts/notion-bootstrap.mjs
 *
 * 생성된 DB/페이지 ID 는 notion.config.json 에 자동으로 기록된다.
 * 이미 ID 가 채워진 항목은 건너뛰므로 여러 번 실행해도 중복 생성되지 않는다.
 *
 * 한계: 마크다운 → 노션 변환은 베스트 에포트다. 특히 notice.md 처럼 인라인
 * HTML(span/details/sup)이 많은 문서는 일반 텍스트로 들어가므로, 이관 후
 * 노션에서 한 번 다듬어 주는 것을 권장한다 (색 강조는 노션 글자색으로,
 * 접기는 토글로 — sync 가 다시 HTML 로 되돌려 준다).
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import {
  loadConfig,
  saveConfig,
  notion,
  uploadFile,
  markdownToBlocks,
  textItems,
} from "./notion-lib.mjs";

const parent = process.env.NOTION_PARENT_PAGE || process.argv[2];
if (!parent) {
  console.error("NOTION_PARENT_PAGE 환경변수(또는 첫 번째 인자)로 상위 페이지 ID 를 주세요.");
  process.exit(1);
}

const config = loadConfig();
config.databases ??= {};
config.pages ??= {};

/* -------------------------------------------------------------- 값 빌더 */

const T = (s) => ({ title: textItems(s ?? "") });
const RT = (s) => ({ rich_text: textItems(s ?? "") });
const NUM = (n) => ({ number: n });
const CHECK = (b) => ({ checkbox: !!b });
const DATE = (d) => (d ? { date: { start: d } } : undefined);
const SEL = (s) => (s ? { select: { name: String(s).replaceAll(",", " ") } } : undefined);
const URLP = (u) => (u ? { url: u } : undefined);

function props(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function fileValue(localOrUrl) {
  if (!localOrUrl) return undefined;
  if (/^https?:\/\//.test(localOrUrl)) {
    return { files: [{ type: "external", external: { url: localOrUrl }, name: "external" }] };
  }
  const abs = path.resolve("public", localOrUrl.replace(/^\/+/, ""));
  if (!fs.existsSync(abs)) {
    console.warn(`  ! 파일 없음, 건너뜀: ${localOrUrl}`);
    return undefined;
  }
  const id = await uploadFile(abs);
  return { files: [{ type: "file_upload", file_upload: { id }, name: path.basename(abs) }] };
}

async function resolveImage(src) {
  const abs = path.resolve("public", src.replace(/^\/+/, ""));
  if (!fs.existsSync(abs)) return null;
  const id = await uploadFile(abs);
  return { type: "image", image: { type: "file_upload", file_upload: { id } } };
}

/* ---------------------------------------------------------- 생성 헬퍼 */

async function createDb(key, title, properties) {
  const existing = config.databases[key];
  if (existing) {
    // 이미 있는 DB 는 행 이관 없이 스키마만 맞춘다: 코드에 새로 생긴 속성을 추가.
    const db = await notion("GET", `/databases/${existing}`);
    const missing = Object.fromEntries(
      Object.entries(properties).filter(([name]) => !db.properties?.[name])
    );
    if (Object.keys(missing).length) {
      await notion("PATCH", `/databases/${existing}`, { properties: missing });
      console.log(`~ ${title}: 속성 추가 → ${Object.keys(missing).join(", ")}`);
    } else {
      console.log(`- ${title}: 이미 설정됨, 건너뜀`);
    }
    return null;
  }
  const res = await notion("POST", "/databases", {
    parent: { type: "page_id", page_id: parent },
    title: [{ type: "text", text: { content: title } }],
    properties,
  });
  config.databases[key] = res.id;
  saveConfig(config);
  console.log(`+ DB 생성: ${title}`);
  return res.id;
}

async function createRow(dbId, properties, children = []) {
  const page = await notion("POST", "/pages", {
    parent: { database_id: dbId },
    properties,
    ...(children.length ? { children: children.slice(0, 100) } : {}),
  });
  for (let i = 100; i < children.length; i += 100) {
    await notion("PATCH", `/blocks/${page.id}/children`, {
      children: children.slice(i, i + 100),
    });
  }
  return page;
}

function readJson(relPath, fallback) {
  const abs = path.resolve(relPath);
  if (!fs.existsSync(abs)) return fallback;
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

/** db.json + guest.json 의 배열 항목을 이어붙인다 (useAppData 의 병합과 동일). */
function mergedDbKey(key) {
  return [
    ...(readJson("public/data/db.json", {})[key] ?? []),
    ...(readJson("public/data/guest.json", {})[key] ?? []),
  ];
}

/* ------------------------------------------------------------ 데이터셋 */

async function bootstrapPosts() {
  const dbId = await createDb("posts", "게시글", {
    제목: { title: {} },
    날짜: { date: {} },
    게시판: { select: {} },
    미리보기: { rich_text: {} },
    대표이미지: { files: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  const root = path.resolve("public/data/posts");
  if (!fs.existsSync(root)) return;
  const IMAGE_EXTS = [".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif"];

  for (const boardDir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const board = boardDir.name;
    const boardPath = path.join(root, board);
    for (const file of fs.readdirSync(boardPath).filter((f) => f.endsWith(".md"))) {
      const id = path.basename(file, ".md");
      const { data: meta, content } = matter(fs.readFileSync(path.join(boardPath, file), "utf-8"));
      let cover = meta.imageUrl;
      if (!cover) {
        for (const ext of IMAGE_EXTS) {
          const guess = `/images/posts/${board}/${id}${ext}`;
          if (fs.existsSync(path.resolve("public", guess.slice(1)))) {
            cover = guess;
            break;
          }
        }
      }
      console.log(`  게시글 이관: ${board}/${file}`);
      await createRow(
        dbId,
        props({
          제목: T(meta.title || id),
          날짜: DATE(meta.date),
          게시판: SEL(board),
          미리보기: RT(meta.preview ?? ""),
          대표이미지: cover ? await fileValue(cover) : undefined,
          공개: CHECK(true),
        }),
        await markdownToBlocks(content.trim(), { resolveImage })
      );
    }
  }
}

async function bootstrapAuPosts() {
  const dbId = await createDb("auPosts", "AU 게시글", {
    제목: { title: {} },
    날짜: { date: {} },
    AU: { select: {} },
    미리보기: { rich_text: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  const root = path.resolve("public/data/au-posts");
  if (!fs.existsSync(root)) return;
  for (const auDir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const auId = auDir.name;
    for (const file of fs.readdirSync(path.join(root, auId)).filter((f) => f.endsWith(".md"))) {
      const id = path.basename(file, ".md");
      const { data: meta, content } = matter(fs.readFileSync(path.join(root, auId, file), "utf-8"));
      console.log(`  AU 게시글 이관: ${auId}/${file}`);
      await createRow(
        dbId,
        props({
          제목: T(meta.title || id),
          날짜: DATE(meta.date),
          AU: SEL(auId),
          미리보기: RT(meta.preview ?? ""),
          공개: CHECK(true),
        }),
        await markdownToBlocks(content.trim(), { resolveImage })
      );
    }
  }
}

async function bootstrapDocPage(key, title, relPath) {
  if (config.pages[key]) {
    console.log(`- ${title}: 이미 설정됨, 건너뜀`);
    return;
  }
  const abs = path.resolve(relPath);
  const raw = fs.existsSync(abs) ? fs.readFileSync(abs, "utf-8") : "";
  const { content } = matter(raw);
  const children = await markdownToBlocks(content.trim(), { resolveImage });

  const page = await notion("POST", "/pages", {
    parent: { page_id: parent },
    properties: { title: { title: textItems(title) } },
    ...(children.length ? { children: children.slice(0, 100) } : {}),
  });
  for (let i = 100; i < children.length; i += 100) {
    await notion("PATCH", `/blocks/${page.id}/children`, { children: children.slice(i, i + 100) });
  }
  config.pages[key] = page.id;
  saveConfig(config);
  console.log(`+ 페이지 생성: ${title} (${relPath})`);
}

async function bootstrapPlaylist() {
  const dbId = await createDb("playlist", "플레이리스트", {
    제목: { title: {} },
    아티스트: { rich_text: {} },
    길이: { rich_text: {} },
    카테고리: { select: {} },
    가사: { rich_text: {} },
    영상ID: { rich_text: {} },
    정렬: { number: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;
  const items = readJson("public/data/playlist.json", []);
  for (const [i, item] of items.entries()) {
    await createRow(dbId, props({
      제목: T(item.title),
      아티스트: RT(item.artist ?? ""),
      길이: RT(item.duration ?? ""),
      카테고리: SEL(item.category),
      가사: RT(item.lyrics ?? ""),
      영상ID: item.videoId ? RT(item.videoId) : undefined,
      정렬: NUM(i + 1),
      공개: CHECK(true),
    }));
  }
  console.log("  플레이리스트 이관 완료");
}

async function bootstrapNeighbors() {
  const dbId = await createDb("neighbors", "이웃", {
    이름: { title: {} },
    URL: { url: {} },
    배너: { files: {} },
    정렬: { number: {} },
    크롭: { number: {} },
    크롭위치: { number: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;
  const items = readJson("public/data/neighbors.json", []);
  for (const [i, item] of items.entries()) {
    console.log(`  이웃 이관: ${item.name}`);
    await createRow(dbId, props({
      이름: T(item.name),
      URL: URLP(item.url),
      배너: await fileValue(item.image),
      정렬: NUM(i + 1),
      크롭: item.crop != null ? NUM(item.crop) : undefined,
      크롭위치: item.cropPosition != null ? NUM(item.cropPosition) : undefined,
      공개: CHECK(true),
    }));
  }
}

async function bootstrapGallery() {
  const dbId = await createDb("gallery", "갤러리", {
    이름: { title: {} },
    이미지: { files: {} },
    섹션: { select: {} },
    캡션: { rich_text: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  const IMAGE_EXTS = new Set([".jpeg", ".jpg", ".png", ".webp", ".gif", ".avif", ".svg"]);
  const root = path.resolve("public/images/gallery");
  if (!fs.existsSync(root)) return;

  const migrateDir = async (dirAbs, section, publicPrefix) => {
    for (const file of fs.readdirSync(dirAbs).sort()) {
      if (!IMAGE_EXTS.has(path.extname(file).toLowerCase())) continue;
      const txt = path.join(dirAbs, file.replace(/\.[^.]+$/, ".txt"));
      const caption = fs.existsSync(txt) ? fs.readFileSync(txt, "utf-8").trim() : "";
      console.log(`  갤러리 이관: ${publicPrefix}/${file}`);
      await createRow(dbId, props({
        이름: T(path.basename(file, path.extname(file))),
        이미지: await fileValue(`${publicPrefix}/${file}`),
        섹션: SEL(section),
        캡션: caption ? RT(caption) : undefined,
        공개: CHECK(true),
      }));
    }
  };

  for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    if (dir.name === "au") {
      const auRoot = path.join(root, "au");
      for (const auDir of fs.readdirSync(auRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        await migrateDir(path.join(auRoot, auDir.name), auDir.name, `/images/gallery/au/${auDir.name}`);
      }
    } else {
      await migrateDir(path.join(root, dir.name), dir.name, `/images/gallery/${dir.name}`);
    }
  }
}

async function bootstrapAu() {
  const membersDbId = await createDb("auMembers", "AU 멤버", {
    이름: { title: {} },
    AU: { select: {} },
    역할: { rich_text: {} },
    이미지: { files: {} },
    소개: { rich_text: {} },
    노트: { rich_text: {} },
    정렬: { number: {} },
    공개: { checkbox: {} },
  });
  const auDbId = await createDb("au", "칩 (시리즈 · AU)", {
    제목: { title: {} },
    ID: { rich_text: {} },
    종류: { select: { options: [{ name: "시리즈" }, { name: "AU" }] } },
    카테고리: { select: {} },
    시놉시스: { rich_text: {} },
    AU있음: { checkbox: {} },
    설명: { rich_text: {} },
    대표이미지: { files: {} },
    이미지위치: { rich_text: {} },
    태그: { multi_select: {} },
    섹션: { select: {} },
    정렬: { number: {} },
    공개: { checkbox: {} },
  });
  if (!auDbId && !membersDbId) return;

  // 시리즈 칩도 같은 DB 에 종류=시리즈 로 들어간다
  if (auDbId) {
    for (const [i, item] of mergedDbKey("sidebarItems").entries()) {
      console.log(`  시리즈 칩 이관: ${item.label}`);
      await createRow(
        auDbId,
        props({
          제목: T(item.label),
          ID: RT(item.id),
          종류: SEL("시리즈"),
          카테고리: SEL(item.category),
          시놉시스: RT(item.synopsis ?? ""),
          AU있음: CHECK(Boolean(item.hasAu)),
          정렬: NUM(i + 1),
          공개: CHECK(true),
        })
      );
    }
  }

  const items = mergedDbKey("au");
  for (const [i, au] of items.entries()) {
    if (auDbId) {
      console.log(`  AU 이관: ${au.title}`);
      // 대사(quotes)는 본문 인용 블록으로 넣는다: "> 멤버이름: 대사"
      const bodyLines = [];
      if (au.content) bodyLines.push(au.content);
      for (const q of au.quotes ?? []) {
        const name = au.members?.[q.memberIndex]?.name ?? "";
        bodyLines.push(`> ${name ? `${name}: ` : ""}${q.text}`);
      }
      await createRow(
        auDbId,
        props({
          제목: T(au.title),
          ID: RT(au.id),
          종류: SEL("AU"),
          설명: RT(au.description ?? ""),
          대표이미지: await fileValue(au.imageUrl),
          이미지위치: au.imagePosition ? RT(au.imagePosition) : undefined,
          태그: au.tags?.length
            ? { multi_select: au.tags.map((t) => ({ name: String(t).replaceAll(",", " ") })) }
            : undefined,
          섹션: SEL(au.section),
          정렬: NUM(i + 1),
          공개: CHECK(true),
        }),
        await markdownToBlocks(bodyLines.join("\n\n"), { resolveImage })
      );
    }
    if (membersDbId) {
      for (const [j, m] of (au.members ?? []).entries()) {
        await createRow(membersDbId, props({
          이름: T(m.name),
          AU: SEL(au.id),
          역할: RT(m.role ?? ""),
          이미지: await fileValue(m.imageUrl),
          소개: RT((m.descriptions ?? []).join("\n")),
          노트: m.note ? RT(m.note) : undefined,
          정렬: NUM(j + 1),
          공개: CHECK(true),
        }));
      }
    }
  }
}

async function bootstrapYoutube() {
  const dbId = await createDb("youtube", "유튜브", {
    제목: { title: {} },
    영상ID: { rich_text: {} },
    카테고리: { select: {} },
    정렬: { number: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;
  for (const [i, item] of mergedDbKey("youtube").entries()) {
    await createRow(dbId, props({
      제목: T(item.title),
      영상ID: RT(item.videoId),
      카테고리: SEL(item.category),
      정렬: NUM(i + 1),
      공개: CHECK(true),
    }));
  }
}

/** PAPERS 스크립트 DB — 로컬 md 가 있으면 함께 이관한다. */
async function bootstrapScripts() {
  const dbId = await createDb("scripts", "스크립트 (PAPERS)", {
    제목: { title: {} },
    날짜: { date: {} },
    분류: { select: { options: [{ name: "ORG" }, { name: "AU" }] } },
    파일명: { rich_text: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;
  await migrateMdDir(dbId, "public/data/scripts", "ORG", "스크립트");
}

/** frontmatter md 폴더를 그대로 노션 행으로 옮긴다. */
async function migrateMdDir(dbId, relDir, fallbackCategory, label) {
  const root = path.resolve(relDir);
  if (!fs.existsSync(root)) return;
  for (const file of fs.readdirSync(root)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const slug = path.basename(file, ".md");
    const { data: meta, content } = matter(fs.readFileSync(path.join(root, file), "utf-8"));
    console.log(`  ${label} 이관: ${file}`);
    await createRow(
      dbId,
      props({
        제목: T(meta.title || slug),
        날짜: DATE(meta.date),
        분류: SEL(meta.category || fallbackCategory),
        파일명: RT(slug),
        공개: CHECK(true),
      }),
      await markdownToBlocks(content.trim(), { resolveImage })
    );
  }
}

/** 루틴(일과) DB — 행 하나가 일정 블록 하나. */
async function bootstrapRoutine() {
  const dbId = await createDb("routine", "루틴 (PC 대시보드)", {
    일정: { title: {} },
    담당: { select: {} },
    요일: {
      multi_select: {
        options: ["월", "화", "수", "목", "금", "토", "일"].map((name) => ({ name })),
      },
    },
    시작: { number: {} },
    종료: { number: {} },
    장소: { rich_text: {} },
    부하도: { number: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  const abs = path.resolve("public/data/pc-modules.json");
  if (!fs.existsSync(abs)) return;
  const { schedule = {} } = JSON.parse(fs.readFileSync(abs, "utf-8"));
  const KR = { MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일" };

  // 같은 블록이 여러 요일에 걸쳐 있으면 요일만 합쳐 한 행으로 만든다.
  const merged = new Map();
  for (const [day, lanes] of Object.entries(schedule)) {
    for (const lane of lanes ?? []) {
      for (const b of lane.blocks ?? []) {
        const key = `${lane.agent}|${b.start}|${b.end}|${b.label}`;
        const entry = merged.get(key) ?? { ...b, agent: lane.agent, days: [] };
        entry.days.push(KR[day] ?? day);
        merged.set(key, entry);
      }
    }
  }

  for (const b of merged.values()) {
    console.log(`  루틴 이관: ${b.agent} ${b.label}`);
    await createRow(
      dbId,
      props({
        일정: T(b.label),
        담당: SEL(b.agent),
        요일: { multi_select: b.days.map((name) => ({ name })) },
        시작: NUM(b.start),
        종료: NUM(b.end),
        장소: RT(b.place ?? ""),
        부하도: NUM(b.load ?? 30),
        공개: CHECK(true),
      })
    );
  }
}

/** 라디오 방송국 DB. */
async function bootstrapRadio() {
  const dbId = await createDb("radio", "라디오 방송국", {
    방송국: { title: {} },
    주파수: { number: {} },
    대사: { rich_text: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  const abs = path.resolve("public/data/pc-modules.json");
  if (!fs.existsSync(abs)) return;
  const { stations = [] } = JSON.parse(fs.readFileSync(abs, "utf-8"));
  for (const st of stations) {
    console.log(`  라디오 이관: ${st.name}`);
    await createRow(
      dbId,
      props({
        방송국: T(st.name),
        주파수: NUM(st.freq),
        대사: RT((st.lines ?? []).map((l) => `${l.who}: ${l.text}`).join("\n")),
        공개: CHECK(true),
      })
    );
  }
}

/** 인물 DB — 중첩된 detail 을 속성으로 펼쳐 담는다. */
async function bootstrapAgents() {
  const dbId = await createDb("agents", "인물", {
    이름: { title: {} },
    ID: { rich_text: {} },
    카테고리: { select: {} },
    소개: { rich_text: {} },
    이미지: { files: {} },
    대표이미지: { files: {} },
    서브타이틀: { rich_text: {} },
    코드네임: { rich_text: {} },
    분류: { rich_text: {} },
    속성: { rich_text: {} },
    나이국적: { rich_text: {} },
    평가: { rich_text: {} },
    능력개요: { rich_text: {} },
    능력스킬: { rich_text: {} },
    버서크: { rich_text: {} },
    키체격: { rich_text: {} },
    머리눈: { rich_text: {} },
    복장: { rich_text: {} },
    관계: { rich_text: {} },
    TMI: { rich_text: {} },
    정렬: { number: {} },
    공개: { checkbox: {} },
  });
  if (!dbId) return;

  for (const [i, a] of mergedDbKey("agents").entries()) {
    const d = a.detail ?? {};
    console.log(`  인물 이관: ${a.name} (${a.category})`);
    await createRow(
      dbId,
      props({
        이름: T(a.name),
        ID: RT(a.id ?? ""),
        카테고리: SEL(a.category),
        소개: RT((a.description ?? []).join("\n")),
        이미지: await fileValue(a.imageUrl),
        대표이미지: await fileValue(d.heroImageUrl),
        서브타이틀: RT(d.subtitle ?? ""),
        코드네임: RT(d.profile?.codename ?? ""),
        분류: RT(d.profile?.classification ?? ""),
        속성: RT(d.profile?.attribute ?? ""),
        나이국적: RT(d.profile?.["age & nationality"] ?? ""),
        평가: RT(d.profile?.evaluation ?? ""),
        능력개요: RT(d.ability?.overview ?? ""),
        능력스킬: RT((d.ability?.skills ?? []).join("\n")),
        버서크: RT(d.ability?.berserkSign ?? ""),
        키체격: RT(d.appearance?.["height & build"] ?? ""),
        머리눈: RT(d.appearance?.["hair & eyes"] ?? ""),
        복장: RT(d.appearance?.outfit ?? ""),
        관계: RT(
          (d.relations ?? [])
            .map((r) => [r.name, r.relation, r.description].join(" | "))
            .join("\n")
        ),
        TMI: RT((d.tmi ?? []).map((t) => `${t.title} | ${t.text}`).join("\n")),
        정렬: NUM(i + 1),
        공개: CHECK(true),
      })
    );
  }
}

/* ------------------------------------------------------------------ 실행 */

async function main() {
  await bootstrapPosts();
  await bootstrapAuPosts();
  await bootstrapDocPage("notice", "Notice", "public/data/notice.md");
  await bootstrapDocPage("memo", "Memo", "public/data/memo.md");
  await bootstrapPlaylist();
  await bootstrapNeighbors();
  await bootstrapGallery();
  await bootstrapAu();
  await bootstrapYoutube();
  await bootstrapScripts();
  await bootstrapRoutine();
  await bootstrapRadio();
  await bootstrapAgents();

  console.log("\n이관 완료. notion.config.json 에 ID 가 기록되었습니다.");
  console.log("notice/memo 는 노션에서 스타일(색 강조·토글)을 한 번 다듬어 주세요.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
