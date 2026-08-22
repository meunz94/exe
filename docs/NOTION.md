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
| 게시글 `posts` | 제목(제목), 날짜(날짜), 게시판(선택: LOG/OOC/ETC), 미리보기(텍스트), 대표이미지(파일), 공개 + **본문 = 페이지 내용** | `public/data/posts/<게시판>/<페이지ID>.md` → PC 대시보드 |
| 칩 게시글 `auPosts` | 제목, 날짜, AU(선택: **칩 ID** — org_1 · au_1 등), 미리보기, 공개 + 본문 | `public/data/au-posts/<칩 ID>/<페이지ID>.md` → 칩 상세의 로그 |
| 이웃 `neighbors` | 이름(제목), URL(URL), 배너(파일), 정렬(숫자), 크롭(숫자), 크롭위치(숫자), 공개 | `neighbors.json` + 배너 다운로드 |
| 플레이리스트 `playlist` | 제목, 아티스트, 길이, 카테고리, 가사(텍스트), 영상ID(텍스트, 유튜브 URL 붙여넣기 가능), 정렬, 공개 | `playlist.json` |
| 갤러리 `gallery` | 이름(제목), 이미지(파일), 섹션(선택), 캡션(텍스트), 공개 | `public/images/gallery/<섹션>/` (섹션이 `au-*` 면 `au/<섹션>/`) |
| 유튜브 `youtube` | 제목, 영상ID(텍스트, URL 가능), 카테고리, 정렬, 공개 | `notion.json` |
| 칩 `au` | 제목(제목), ID(텍스트: org_1 · au_1 등), **종류**(선택: 시리즈/AU), 카테고리(선택: VB/VS — 시리즈용), 시놉시스(시리즈용), AU있음(체크박스), 설명, 대표이미지(파일), 이미지위치, 태그(다중선택), 섹션(선택: main/sub), 정렬, 공개 + 본문 | `notion.json` 의 `sidebarItems`(종류=시리즈) + `au`(종류=AU) |
| AU 멤버 `auMembers` | 이름(제목), AU(선택: au-1 등), 역할, 이미지(파일), 소개(텍스트, 줄바꿈=항목), 노트, 정렬, 공개 | `notion.json` (AU 에 합쳐짐) |
| 스크립트 `scripts` | 제목, 날짜, 분류(선택: ORG/AU), 파일명(텍스트, 비우면 페이지ID), 공개 + 본문 | `public/data/scripts/<파일명>.md` → PAPERS |
| 루틴 `routine` | 일정(제목), 담당(선택: 인물명), 요일(다중선택: 월~일), 시작(숫자, 13.5=13시 30분), 종료(숫자), 장소(텍스트), 부하도(숫자 0-100), 공개 | `pc-modules.json` 의 `schedule` |
| 라디오 `radio` | 방송국(제목), 주파수(숫자, 예 98.4), 대사(텍스트 — 한 줄에 하나, `V: 내용` 형식), 공개 | `pc-modules.json` 의 `stations` |
| 인물 `agents` | 이름(제목), ID, 카테고리(선택), 소개(텍스트, 줄바꿈=항목), 이미지·대표이미지(파일), 서브타이틀, 코드네임, 분류, 속성, 나이국적, 평가, 능력개요, 능력스킬(줄바꿈), 버서크, 키체격, 머리눈, 복장, 관계, TMI, 정렬, 공개 | `notion.json` 의 `agents` |

- 인물의 **관계**는 한 줄에 하나씩 `이름 \| 관계 \| 설명`, **TMI** 는 `제목 \| 내용` 형식.
- 칩의 **ID** 가 칩 라벨 이미지 파일명과 같아야 한다 (`public/images/chips/<ID>.png`).
- **게시글 DB 는 PC 대시보드 전용**이다 (게시판 = LOG · OOC · ETC).
  카테고리(VB/VS) 속성은 더 쓰지 않는다.
- **칩(시리즈·AU) 로그**는 `auPosts`(칩 게시글) DB 의 **AU** 속성에 칩 ID 를 넣어
  갈린다 — 시리즈 칩도 `org_1` 처럼 칩 ID 를 그대로 쓴다.
- **AU 별 갤러리**는
`gallery` DB 의 **섹션** 을 AU ID(`au_1` 등)로 두면
  `public/images/gallery/au/<AU ID>/` 로 저장돼 그 AU 에만 붙는다.
  시리즈 칩은 로그·갤러리 모두 **카테고리**(VB/VS)로 갈린다.
- `chips`·`agents` 는 `notion.json` 으로 나가고, 사이트는 이 값을 `db.json` 보다
  우선한다. 즉 노션 DB 를 만든 뒤부터는 노션이 원본이 된다.

- **파일명**이 그대로 주소가 된다 (`/papers/<파일명>`, `/pc/<파일명>`). 비워 두면
  페이지 ID 가 쓰이므로, 공유할 링크를 예쁘게 하려면 채우는 편이 좋다.
- **담당**의 선택값은 대시보드에 그대로 표시된다. 심박수 그래프는
  `pc-modules.json` 의 `heart.agent` 와 이름이 같은 인물의 **부하도**를 따라 움직인다
  (부하도 자체는 화면에 노출되지 않음).
- **부하도**: 식사·휴식 10~25 / 사무 30~50 / 훈련·실험 80~100 정도가 자연스럽다.
- 라디오 **주파수**는 87.5~108 범위. 다이얼이 ±0.3MHz 안에 들어오면 잡히므로
  방송국끼리 0.6MHz 이상 띄울 것.

페이지 2개:

| 페이지 (config 키) | 출력 |
|---|---|
| Notice `pages.notice` | `public/data/notice.md` |
| Memo `pages.memo` | `public/data/memo.md` |

## 3-1. repo 쪽에서 데이터를 고쳤을 때 (역방향 반영)

평소 흐름은 **노션 → repo** 한 방향이다. repo 에서 직접 데이터를 손봤다면
(AU 목록 정리, ID 변경 등) 노션이 옛 상태로 남아 있어 다음 동기화가 그것을
되살릴 수 있다. 이때만 역방향 스크립트를 쓴다.

```bash
NOTION_TOKEN=secret_xxx npm run notion:push            # 미리보기 (변경 없음)
NOTION_TOKEN=secret_xxx npm run notion:push -- --apply # 실제 반영
```

- 대상: `au`(AU) · `auMembers`(AU 멤버) · `auPosts`(없는 AU 에 달린 행 보관)
- `db.json` 의 AU 목록이 기준. 노션에만 있는 AU/멤버 행은 **보관(archive)** 되고,
  없는 행은 새로 만들어지고, 있는 행은 속성만 갱신된다
- **본문은 건드리지 않는다.** 새로 만드는 행에만 본문이 들어가므로, 노션에서
  다듬은 서식은 그대로 남는다
- `sidebarItems`(칩) 와 `agents`(인물) 는 노션에 없고 `db.json` 에서만 관리한다

### 새 데이터셋(스크립트 · PC 게시글 · 루틴 · 라디오) 추가하기

`notion.config.json` 에 아직 ID 가 없으므로 bootstrap 을 한 번 더 돌리면 된다.
이미 ID 가 있는 DB 는 건너뛰므로 기존 것에는 영향이 없다.

```bash
NOTION_TOKEN=secret_xxx NOTION_PARENT_PAGE=<페이지ID> npm run notion:bootstrap
```

생성된 ID 가 `notion.config.json` 에 기록되면 **커밋**해야 다음 동기화부터 반영된다.

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
