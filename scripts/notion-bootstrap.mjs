/**
 * 최초 1회: 노션에 재디자인 스키마의 데이터베이스를 만든다 (데이터 이관 없음).
 *
 *   NOTION_TOKEN=... NOTION_PARENT_PAGE=<페이지ID> node scripts/notion-bootstrap.mjs
 *
 * - 생성된 DB ID 는 notion.config.json 에 기록된다 → 커밋할 것
 * - 이전 사이트의 DB 는 쓰지 않는다. 새 페이지 아래에 전부 새로 만든다.
 * - 다시 실행하면(ID 가 이미 있으면) 빠진 속성만 추가한다 — 스키마가 바뀌었을 때 재실행용
 * - 관계(relation) 속성은 상대 DB 가 먼저 있어야 하므로 두 단계로 만든다
 */
import { loadConfig, saveConfig, notion } from "./notion-lib.mjs";

const parent = process.env.NOTION_PARENT_PAGE || process.argv[2];
if (!parent) {
  console.error("NOTION_PARENT_PAGE 환경변수(또는 첫 번째 인자)로 상위 페이지 ID 를 주세요.");
  process.exit(1);
}

const config = loadConfig();
config.databases ??= {};

const SEL = (...names) => ({ select: { options: names.map((name) => ({ name })) } });
const PAIR = { select: {} }; // 페어 ID 를 옵션으로 — 페어 DB 의 ID 와 같은 값을 쓴다

async function ensureDb(key, title, properties) {
  const existing = config.databases[key];
  if (existing) {
    const db = await notion("GET", `/databases/${existing}`);
    const missing = Object.fromEntries(Object.entries(properties).filter(([name]) => !db.properties?.[name]));
    if (Object.keys(missing).length) {
      await notion("PATCH", `/databases/${existing}`, { properties: missing });
      console.log(`~ ${title}: 속성 추가 → ${Object.keys(missing).join(", ")}`);
    } else {
      console.log(`- ${title}: 이미 설정됨`);
    }
    return existing;
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

const relationTo = (dbId) => ({ relation: { database_id: dbId, single_property: {} } });

async function main() {
  await ensureDb("site", "사이트 설정", {
    키: { title: {} },
    값: { rich_text: {} },
    파일: { files: {} },
  });
  await ensureDb("pairs", "페어", {
    이름: { title: {} },
    ID: { rich_text: {} },
    코드: { rich_text: {} },
    태그라인: { rich_text: {} },
    제목위: { rich_text: {} },
    제목아래: { rich_text: {} },
    강조색: { rich_text: {} },
    강조색다크: { rich_text: {} },
    초록제목: { rich_text: {} },
    초록부제: { rich_text: {} },
    시놉시스: { rich_text: {} },
    인물한줄: { rich_text: {} },
    관계키워드: { multi_select: {} },
    관계설명: { rich_text: {} },
    기본: { checkbox: {} },
  });
  await ensureDb("slides", "랜딩 슬라이드", {
    캡션: { title: {} },
    페어: PAIR,
    왼쪽: { files: {} },
    오른쪽: { files: {} },
    정렬: { number: {} },
  });
  const subjectsId = await ensureDb("subjects", "인물", {
    이름: { title: {} },
    페어: PAIR,
    ID: { rich_text: {} },
    큰이름: { rich_text: {} },
    라벨: { rich_text: {} },
    역할: { rich_text: {} },
    테마색: { rich_text: {} },
    테마색다크: { rich_text: {} },
    키워드: { multi_select: {} },
    이미지: { files: {} },
    스펙: { rich_text: {} },
    호칭: { rich_text: {} },
    대사: { rich_text: {} },
    정렬: { number: {} },
  });
  await ensureDb("people", "주변 인물", {
    이름: { title: {} },
    페어: PAIR,
    인물: relationTo(subjectsId),
    관계A: { rich_text: {} },
    관계B: { rich_text: {} },
    이미지: { files: {} },
        공개: { checkbox: {} },
  });
  const timelineId = await ensureDb("timeline", "타임라인", {
    제목: { title: {} },
    페어: PAIR,
    ID: { rich_text: {} },
    DAY: { rich_text: {} },
    강조: { checkbox: {} },
  });
  const storiesId = await ensureDb("stories", "스토리", {
    제목: { title: {} },
    페어: PAIR,
    권: { number: {} },
    요약: { rich_text: {} },
    소속: { rich_text: {} },
    쪽: { rich_text: {} },
  });
  await ensureDb("logs", "로그", {
    제목: { title: {} },
    페어: PAIR,
    날짜: { date: {} },
    구분: SEL("ORIGINAL", "AU"),
    소제목: { rich_text: {} },
    비밀번호: { rich_text: {} },
    태그: { multi_select: {} },
    사진: { files: {} },
    사진설명: { rich_text: {} },
    공개: { checkbox: {} },
  });
  // 타임라인 → 스토리 관계는 스토리 DB 가 생긴 뒤에
  await ensureDb("timeline", "타임라인", { 관련스토리: relationTo(storiesId) });

  const diaryId = await ensureDb("diary", "일기장", {
    제목: { title: {} },
    페어: PAIR,
    날짜: { date: {} },
    작성자: { select: {} },
    AI처리: { date: {} },
    공개: { checkbox: {} },
  });
  const guestId = await ensureDb("guestbook", "방명록", {
    내용: { title: {} },
    이름: { rich_text: {} },
    페어: PAIR,
    날짜: { date: {} },
    출처: SEL("사람", "AI"),
    AI처리: { date: {} },
    공개: { checkbox: {} },
  });
  const commentsId = await ensureDb("comments", "댓글", {
    내용: { title: {} },
    일기: relationTo(diaryId),
    방명록: relationTo(guestId),
    작성자: { select: {} },
    출처: SEL("AI", "사람"),
    날짜: { date: {} },
    각주: { number: {} },
    공개: { checkbox: {} },
  });
  await ensureDb("comments", "댓글", { 답글대상: relationTo(commentsId) });

  // AU 하나가 한 행. 프로필은 본문의 `## 이름` 섹션, 갤러리는 본문 안의 "갤러리" 하위 페이지
  await ensureDb("au", "AU", {
    제목: { title: {} },
    페어: PAIR,
    설명: { rich_text: {} },
    시놉시스: { rich_text: {} },
    대표이미지: { files: {} },
    라벨: { files: {} },
    박스아트: { files: {} },
    공개: { checkbox: {} },
  });
  await ensureDb("links", "외부 링크", {
    이름: { title: {} },
    URL: { url: {} },
    설명: { rich_text: {} },
    공개: { checkbox: {} },
  });
  await ensureDb("neighbors", "이웃", {
    이름: { title: {} },
    URL: { url: {} },
    배너: { files: {} },
        공개: { checkbox: {} },
  });
  await ensureDb("gallery", "갤러리", {
    제목: { title: {} },
    페어: PAIR,
    이미지: { files: {} },
    설명: { rich_text: {} },
    공개: { checkbox: {} },
  });
  await ensureDb("playlist", "플레이리스트", {
    제목: { title: {} },
    아티스트: { rich_text: {} },
    영상ID: { rich_text: {} },
    페어: PAIR,
    정렬: { number: {} },
  });
  console.log("완료 — notion.config.json 을 커밋하세요.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
