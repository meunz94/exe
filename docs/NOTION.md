# 노션 연동 가이드

사이트 콘텐츠(게시글, 공지, 타임라인, 이웃, 플레이리스트, 갤러리 등)를 노션에서
관리하고, 노션의 버튼으로 사이트를 배포하는 구성.

```
노션 (원본)
  │  scripts/notion-sync.mjs        ← GitHub Actions "Sync content from Notion"
  ▼
public/data/*, public/images/*      ← 기존 파일 형태 그대로 커밋됨
  │  npm run build                  ← 기존 generate-* 스크립트가 그대로 동작
  ▼
GitHub Pages
```

## 1. 최초 설정

### 1-1. 노션 연결(connection) 만들기

1. https://app.notion.com/developers/connections → 사이드바 **Build** →
   **Internal connections** → **Create a new connection** (이름 입력, 워크스페이스 선택)
2. **Configuration** 탭의 **Installation access token** 이 `NOTION_TOKEN`.
   같은 탭에서 Read/Update/Insert content 권한이 모두 켜져 있는지 확인
3. 노션에 콘텐츠를 담을 페이지를 하나 만들고(예: "BYHOME CMS"),
   페이지 우상단 `•••` → **Connections** → **+ Add connection** 으로 방금 만든
   연결을 추가 (새 연결은 기본적으로 아무 페이지에도 접근 못 하므로 필수)

### 1-2. 기존 데이터 이관 (로컬에서 1회)

```bash
NOTION_TOKEN=secret_xxx NOTION_PARENT_PAGE=<페이지ID> npm run notion:bootstrap
```

- 페이지 ID는 해당 페이지 URL 끝의 32자리 문자열
- 데이터베이스 9개 + 페이지 2개(Notice/Memo)가 생성되고 현재 repo 데이터가 채워짐
- 생성된 ID가 `notion.config.json` 에 자동 기록됨 → **커밋 필수**
- 이미 ID가 채워진 항목은 건너뛰므로 중간에 끊겨도 다시 실행하면 됨
- notice/memo 는 인라인 HTML이 일반 텍스트로 들어가므로, 노션에서 색 강조·토글로
  한 번 다듬어 줄 것 (아래 "스타일 매핑" 참고)

### 1-3. 동기화 확인 (로컬)

```bash
NOTION_TOKEN=secret_xxx npm run notion:sync
git diff   # 노션 내용이 기존 파일 형태로 다시 내려왔는지 확인
```

### 1-4. GitHub 설정

- repo → Settings → Secrets and variables → Actions → **NOTION_TOKEN** 시크릿 추가
- 이후 Actions 탭의 **Sync content from Notion** 워크플로우를 수동 실행해 확인

## 2. 노션에서 배포 버튼 만들기

노션 자동화 웹훅은 GitHub API 가 요구하는 인증 헤더/본문을 보낼 수 없어서,
중간에 작은 프록시(Cloudflare Worker, 무료)를 하나 둔다.

### 2-1. GitHub 토큰

GitHub → Settings → Developer settings → **Fine-grained personal access token**
- Repository access: 이 repo 만
- Permissions: **Contents: Read and write**

### 2-2. Cloudflare Worker

dash.cloudflare.com → Workers → Create Worker, 아래 코드 배포:

```js
export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("nope", { status: 405 });
    const url = new URL(req.url);
    if (url.searchParams.get("key") !== env.WEBHOOK_KEY)
      return new Response("forbidden", { status: 403 });

    const res = await fetch("https://api.github.com/repos/<계정>/<repo>/dispatches", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "notion-deploy",
      },
      body: JSON.stringify({ event_type: "notion-sync" }),
    });
    return new Response(res.ok ? "deploy triggered" : `github ${res.status}`, {
      status: res.ok ? 200 : 502,
    });
  },
};
```

Worker → Settings → Variables and Secrets:
- `GITHUB_TOKEN`: 2-1 의 토큰
- `WEBHOOK_KEY`: 아무 긴 랜덤 문자열 (URL 유출 대비 열쇠)

### 2-3. 노션 버튼

CMS 페이지에 **버튼 블록** 추가 → 동작 "웹훅 보내기(Send webhook)" →
URL 에 `https://<worker>.workers.dev/?key=<WEBHOOK_KEY>` 입력.

버튼 클릭 → Worker → GitHub `repository_dispatch` → 동기화 → 변경 커밋 → 배포.
(정기 자동 동기화를 원하면 `.github/workflows/notion-sync.yml` 의 schedule 주석 해제)

## 3. 데이터베이스 스키마

속성 이름이 정확히 일치해야 한다. 모든 DB에 **공개**(체크박스)가 있고,
체크된 행만 사이트에 반영된다. `notion.config.json` 에서 ID 가 빈 항목은
동기화에서 제외된다 (그 항목은 계속 repo 파일로 관리).

| DB (config 키) | 속성 | 출력 |
|---|---|---|
| 게시글 `posts` | 제목(제목), 날짜(날짜), 카테고리(선택), 게시판(선택), 미리보기(텍스트), 대표이미지(파일), 공개 + **본문 = 페이지 내용** | `public/data/posts/<카테고리>/<게시판>/<페이지ID>.md` |
| AU 게시글 `auPosts` | 제목, 날짜, AU(선택: au-1 등), 미리보기, 공개 + 본문 | `public/data/au-posts/<AU>/<페이지ID>.md` |
| 타임라인 `timeline` | 제목, 날짜, 설명(텍스트), 카테고리, 공개 | `timeline.json` (날짜순) |
| 이웃 `neighbors` | 이름(제목), URL(URL), 배너(파일), 정렬(숫자), 크롭(숫자), 크롭위치(숫자), 공개 | `neighbors.json` + 배너 다운로드 |
| 플레이리스트 `playlist` | 제목, 아티스트, 길이, 카테고리, 가사(텍스트), 영상ID(텍스트, 유튜브 URL 붙여넣기 가능), 정렬, 공개 | `playlist.json` |
| 갤러리 `gallery` | 이름(제목), 이미지(파일), 섹션(선택), 캡션(텍스트), 공개 | `public/images/gallery/<섹션>/` (섹션이 `au-*` 면 `au/<섹션>/`) |
| 유튜브 `youtube` | 제목, 영상ID(텍스트, URL 가능), 카테고리, 정렬, 공개 | `notion.json` |
| AU `au` | 제목(제목), ID(텍스트: au-1 등), 설명, 대표이미지(파일), 이미지위치(텍스트), 태그(다중선택), 섹션(선택: main/sub), 정렬, 공개 + 본문 | `notion.json` |
| AU 멤버 `auMembers` | 이름(제목), AU(선택: au-1 등), 역할, 이미지(파일), 소개(텍스트, 줄바꿈=항목), 노트, 정렬, 공개 | `notion.json` (AU 에 합쳐짐) |

페이지 2개:

| 페이지 (config 키) | 출력 |
|---|---|
| Notice `pages.notice` | `public/data/notice.md` |
| Memo `pages.memo` | `public/data/memo.md` |

## 4. 스타일 매핑 (노션 → 사이트)

| 노션 | 사이트 md/HTML |
|---|---|
| 굵게 / 기울임 / 인라인 코드 | `**` / `*` / `` ` `` |
| 취소선 / 밑줄 | `<s>` / `<u>` |
| **글자색 (아무 색이나)** | `<span style="color: var(--color-accent)">` — 사이트 강조색 |
| 토글 | `<details><summary>` |
| 인용 / 콜아웃 | `>` 인용 |
| 표 | HTML `<table>` |
| 이미지 | 파일을 내려받아 `public/images/notion/` 에 저장 |

배경색, 위첨자(`<sup>`) 등 노션에 대응이 없는 것은 표현 불가.
더 섬세한 매핑이 필요하면 `scripts/notion-lib.mjs` 의 `richTextToMd` 를 수정.

## 5. 동작 참고

- **정렬**: 타임라인과 게시글은 날짜순, 나머지 목록은 `정렬` 숫자 오름차순.
  게시글 파일명은 노션 페이지 ID에서 자동으로 만들어진다.
- **AU 대사**: AU 페이지 본문에 인용 블록으로 `멤버이름: 대사` 를 쓰면
  해당 멤버의 quotes 로 파싱된다. 인용이 아닌 블록은 AU 의 content 가 된다.
- **삭제**: 노션에서 행을 지우거나 공개를 끄면, 다음 동기화 때 해당 파일도
  삭제된다. 동기화가 소유하는 경로는 `scripts/notion-sync.mjs` 상단 주석 참고.
  한 데이터베이스의 행을 **전부** 비공개로 바꾸면 `cleanTree` 가 빈 디렉터리까지
  치우기 때문에 `public/data/posts` 같은 폴더 자체가 사라진다. 이건 정상 동작이고,
  생성 스크립트들은 폴더가 없는 상태를 빈 목록으로 처리한다 — 사이트에는 "등록된
  게시글이 없습니다" 가 뜬다.
- **`.notion-manifest.json`**: 페이지별 수정 시각 캐시. 커밋해 두면 안 바뀐
  페이지의 본문 변환·이미지 다운로드를 건너뛴다. 지워도 동작엔 문제 없음.
- **이미지 용량**: 노션 업로드는 요금제에 따라 파일당 제한(무료 5MB)이 있다.
- 노션이 원본이 된 데이터셋의 repo 파일은 동기화가 소유·정리한다.
