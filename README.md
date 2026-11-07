# vance.zip — LIMBIC SYSTEM

OC × 캐논 페어 아카이브. 2026-11 에 `LIMBIC SYSTEM — TRPG 아카이브` 시안대로 전면 재구성했다.
Vite + React, GitHub Pages(커스텀 도메인 vance.zip). 콘텐츠는 노션에서 관리한다 → [docs/NOTION.md](docs/NOTION.md). 운영 준비 할 일 → [docs/SETUP-CHECKLIST.md](docs/SETUP-CHECKLIST.md).

## 구조

```
public/data/
  site.json            기본 페어 · 배너 · 방명록 프록시 URL · AI 참여 게시판
  pairs.json           페어 목록 (강조색, 거대 타이포, 초록, 슬라이드, 관계)
  neighbors.json       이웃 배너 / links.json  외부 링크 / comments.json  댓글 / guestbook.json  방명록
  <pair>/subjects.json 인물 2명 + 주변 인물
  <pair>/timeline.json 챕터 (본문 · 장면 말풍선 · 관련 로그)
  <pair>/playlist.json BGM
  <pair>/au.json       AU (id · title · synopsis · members · gallery · bg) — id 는 생성 순 번호
  <pair>/logs/*.md     로그 (frontmatter: no "001", date, kind ORIGINAL|AU, title, tags, photo, caption, chapter)
  <pair>/stories/*.md  스토리 (vol, title, abstract, affiliations, pages)
  <pair>/diary/*.md    일기 (no, date, author, weather, title)
src/
  App.tsx              라우팅 (/, /profile, /profile/:id, /timeline, /story[/:id], /log[/:id], /diary[/:id], /au, /links — 다른 페어는 /<pairId>/... )
  pages/               섹션별 화면 · components/ 공용 조각 · lib/ 데이터·라우터·테마 · styles/ 토큰과 레이아웃
scripts/
  build-content.mjs    md → logs.json / stories.json / diary.json (dev·build 때 자동)
  notion-sync.mjs      노션 → public/data  ·  notion-bootstrap.mjs  DB 생성  ·  optimize-images.mjs  webp 변환
workers/guestbook-proxy.js   방명록 쓰기 프록시 (Cloudflare Worker)
```

## AU 페이지

`/au` 는 흰 바탕에 3D 모니터(`public/models/monitor.glb`) 한 대. 호버하면 스포트라이트가 켜지고 화면에 페어 이름·칩 수가 뜬다.
누르면 `/au/chips` — 옛 사이트의 닌텐도 칩 라이브러리(카트리지 고리 → 삽입 → DS 화면 프로필/로그/갤러리)가 그대로 열린다.
`/au/chips/<칩 id>` 로 바로 열 수도 있다. 3D 코드는 `src/au/` (three + react-three-fiber, 지연 로드).

## 실행

```bash
npm install
npm run dev          # md 색인 생성 후 vite
npm run build        # 색인 → tsc → vite build (dist/)
npm run notion:sync  # .env 의 NOTION_TOKEN 으로 노션 내용 내려받기 + 이미지 최적화
```

## 손으로 글 쓰기 (노션 없이)

`public/data/by/logs/009.md` 처럼 md 를 두면 빌드 때 목록에 들어간다. 본문 규칙:

- `Vance: 대사` 로 시작하는 문단은 대본 블록. 두 번째 인물의 이름은 강조색.
- 스토리·일기의 각주는 `[^1]` + 맨 아래 `[^1]: 내용`.
- 로그의 `photo` 는 이미지 경로. 아직 사진이 없는데 사진 칸 레이아웃을 쓰려면 `photo: true`.

## 테마

라이트/다크는 OS 설정을 따르고, 헤더 오른쪽 끝의 작은 `dark`/`light` 글자로 바꿀 수 있다(브라우저에 저장).
`?theme=dark` 쿼리로도 강제된다. 페어마다 강조색(라이트/다크)이 따로 있다.

## 이전 사이트

2026-11-05 이전의 3D 책상 버전은 git 기록에 있다(`a86de81` ~ `bc4db8f`). 그때 쓰던 노션 DB ID 는
`notion.config.json` 의 `legacy` 에 남겨 두었고 동기화에서는 읽지 않는다.
