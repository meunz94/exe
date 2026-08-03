# by

## 콘텐츠 추가 가이드

`npm run dev` / `npm run build` 시 아래 스크립트들이 자동 실행되어 JSON을 생성한다.

### 계정 구분에 대해

`db.json` 과 `guest.json` 은 더 이상 별도 로그인이 아니다. 두 파일이 로드 시 하나로
합쳐져 랜딩 페이지에 Nº001부터 순서대로 전부 나온다 (`sidebarItems` 를 이어붙인 순서).
새 엔트리는 둘 중 아무 파일에나 추가하면 되고, 카테고리 코드만 겹치지 않으면 된다.

### 게시글 추가

`public/data/posts/{카테고리}/{게시판}/` 에 `.md` 파일 추가.

```
public/data/posts/VB/OOC/9.md
```

frontmatter 형식:

```
---
title: "제목"
date: "2026-04-11"
preview: "미리보기 텍스트"
---
```

썸네일이 필요하면 `public/images/posts/{카테고리}/{게시판}/` 에 같은 이름의 이미지 배치. (예: `9.jpeg`)

### AU 게시글 추가

`public/data/au-posts/{auId}/` 에 `.md` 파일 추가.

```
public/data/au-posts/au-4/1.md
```

frontmatter 형식:

```
---
title: "제목"
date: "2026-04-11"
preview: "미리보기 텍스트"
---
```

### AU 명대사(말풍선) 추가

`public/data/db.json`의 `au` 배열 내 각 AU 항목에 `quotes` 필드를 추가한다.

```json
"quotes": [
  { "memberIndex": 0, "text": "대사 내용" },
  { "memberIndex": 1, "text": "대사 내용" }
]
```

- `memberIndex`는 같은 AU의 `members` 배열 인덱스와 일치시킨다 (0=왼쪽 정렬, 1=오른쪽 정렬).
- 화자 이름은 해당 인덱스의 member name에서 자동으로 표시된다.

### YouTube 영상 추가

`public/data/db.json`의 `youtube` 배열에 항목을 추가한다.

```json
"youtube": [
  { "id": "yt-1", "videoId": "dQw4w9WgXcQ", "title": "영상 제목", "category": "VB" }
]
```

- `videoId`는 YouTube URL의 `v=` 파라미터 값 (예: `https://youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`)
- `category`로 해당 카테고리 페이지에만 표시

### 갤러리 이미지 추가

카테고리별: `public/images/gallery/{카테고리}/` 에 이미지 파일 배치.

```
public/images/gallery/VB/photo.jpeg
```

AU별: `public/images/gallery/au/{auId}/` 에 이미지 파일 배치.

```
public/images/gallery/au/au-4/photo.jpeg
```

캡션이 필요하면 같은 이름의 `.txt` 파일을 옆에 둔다. (예: `photo.txt`)

`npm run gallery` 실행 시 `public/images/thumbs/` 에 높이 720px webp 썸네일이 자동 생성된다.
랜딩 페이지의 이미지 스트립이 이 썸네일을 쓴다 (원본은 갤러리 창에서만 사용).

- 소스보다 썸네일이 최신이면 건너뛰므로 재빌드 비용은 없다.
- `public/images/thumbs/` 는 생성물이라 `.gitignore` 에 있다. 커밋하지 않는다.

### 첫 화면(부팅) 사진 교체

첫 화면은 책상 사진 위에 모니터 유리 영역만 실제 DOM으로 얹은 구조다.
사진을 바꾸려면 새 이미지를 넣고:

```
npm run boot-scene -- src/assets/새이미지.png
```

- `src/assets/boot-desk.webp` (앱이 import하는 파일)을 새로 굽고
- 검은 화면 사각형을 자동으로 찾아 CSS 변수값을 출력한다

출력된 `--scene-w/h`, `--glass-*` 를 [`BootScreen.module.css`](src/components/Boot/BootScreen.module.css) 의
`.stage` 블록에, `GLASS_FRACTION` 을 [`BootScreen.tsx`](src/components/Boot/BootScreen.tsx) 에 붙여넣으면 끝.

- 사진은 **모니터 화면이 꺼진(검은) 상태**여야 자동 검출이 된다.
- 가로 3000px 이상을 권장한다. 전원을 켜면 모니터로 줌인하는데, 원본이 작으면 그만큼 흐려진다.
  (현재 1672px라 줌 배율을 1.8배로 제한해 둠 — [`BootScreen.tsx`](src/components/Boot/BootScreen.tsx) 의 `targetGlassWidth`)
- 원본 PNG은 번들에 포함되지 않는다. import하는 건 webp 뿐.

### 모니터 안 바탕화면 교체

유리 안은 지금 검은 배경 + 아이콘 3개(info / LOVE / prompt)다.
배경에 이미지나 gif를 넣으려면 [`GlassDesktop.module.css`](src/components/Boot/GlassDesktop.module.css) 의
`.wallpaper` 에 있는 CSS 변수 하나만 채우면 된다.

```css
.wallpaper {
  background-image: var(--glass-wallpaper, none);
}
```

`.stage` 나 `.glass` 어디든 `--glass-wallpaper: url("/images/boot/wall.gif");` 를 선언하면 적용된다.
(`image-rendering: pixelated` 가 걸려 있어 도트 이미지도 뭉개지지 않는다.)

아이콘은 전부 `em` 단위라 유리 크기에 따라 자동으로 같이 커지고 작아진다 —
기준값은 [`BootScreen.tsx`](src/components/Boot/BootScreen.tsx) 의 `GLASS_EM_DIVISOR`.

### 화면 전환

두 종류 모두 [`TerminalFlood`](src/components/Boot/TerminalFlood.tsx) 한 컴포넌트에
스킨만 바꿔 쓴다. 문구는 [`floodScripts.ts`](src/components/Boot/floodScripts.ts) 에 모여 있다.

| 경로 | 스킨 | 내용 |
|---|---|---|
| info / prompt | amber | 접속 핸드셰이크 (`[VERIFIED]` `[GUEST]` `[STABLE]`) |
| LOVE → 사이트 | green | 부팅 로그. 실제 데이터에서 엔트리·글·이미지 수를 읽어 출력 |

클릭이나 Esc/Enter/Space로 건너뛸 수 있다.

### 사이트 구조

```
부팅 데스크(LOVE)
  └ 인덱스 (LandingPage)        Nº001~Nº005 스크롤
      └ 엔트리 (EntryPage)      profile / archive / music / gallery
          ├ 프로필 상세         전체화면 시트
          ├ 게시글 리더         전체화면 시트
          └ 갤러리 라이트박스
      └ AU 엔트리 (AuEntry)     AU는 4섹션 대신 자체 페이지
```

- 레이아웃 언어는 [noeinoi.com](https://noeinoi.com/) 참고 — 굵은 테두리 패널, 제로패딩 인덱스
  번호, 초대형 디스플레이 제목, 반전 태그 칩. 색만 우리 다크 팔레트로.
- **섹션 전환**은 [`WordWipe`](src/components/Transition/WordWipe.tsx) — 단색이 화면을 덮고
  목적지 이름이 **5줄로 쌓이며** 좌우 교대로 날아든 뒤 시트가 위로 걷힌다.
  화면이 불투명해진 순간(`onCovered`)에 콘텐츠를 교체하므로 바뀌는 장면은 보이지 않는다.
  섹션별 색·글자색은 [`wipeInks.ts`](src/components/Transition/wipeInks.ts).
  - 글자 크기는 숨은 프로브로 실제 폭을 재서 계산한다. 단어 길이가 섹션마다 달라서
    (`music` vs `403 NOSTELGIA FORBIDDEN`) 고정값으로는 넘치거나 빈다.
  - 디스플레이 서체(Big Shoulders)가 매우 좁아서 폭을 채우려면 가로로 늘려야 한다.
    `MAX_STRETCH`(1.9)가 그 상한 — 그 이상은 왜곡으로 읽힌다.
- 데이터가 4섹션보다 많아서 **timeline·disciplinary는 profile 안에**, **video는 music 안에**
  넣었다. 별도 탭을 만들 만한 분량이 아니라서.

> Win98 창 시스템(데스크톱·창·태스크바·시작메뉴·`98.css`)은 전부 제거됐다.
> 엔트리는 창이 아니라 페이지다. 남은 건 부팅 화면의 레트로 커서
> ([`useRetroCursors.ts`](src/components/Boot/useRetroCursors.ts))뿐.

### 주의: 표준 `translate`/`scale`/`rotate` 속성

`transform` 과 **같은 룰 안에서** 표준 속성(`translate:` 등)을 쓰지 말 것.
명세상 둘은 합성되지만, CSS 미니파이어는 뒤에 오는 `transform` 이 덮어쓴다고 보고
표준 속성을 **통째로 삭제한다.** dev 에서는 정상이고 프로덕션 빌드에서만 깨진다.

실제로 이 문제로 `.scene` 의 `translate: -50% -50%` 가 배포본에서 사라져
첫 화면 전체가 우하단으로 밀렸다. 지금은 `--center` 변수로 `transform` 안에 넣어둔다.

```css
/* 위험 — 프로덕션에서 translate 가 사라진다 */
.x { translate: -50% -50%; transform: scale(1); }

/* 안전 */
.x { --center: translate(-50%, -50%); transform: var(--center) scale(1); }
```

`transform` 이 없는 룰이면 표준 속성 단독 사용은 안전하다 (`.glow`, `.prompt` 등).

## 디자인 시스템

전역 팔레트·타이포 토큰은 [`src/styles/tokens.css`](src/styles/tokens.css) 한 곳에 있다.
색을 바꾸려면 컴포넌트가 아니라 여기를 고친다.

- `--px-*` : 원본 팔레트 (배경 `#1a1a1a`, 본문 `#bababa`, red/blue/green/cream 악센트)
- `--color-*` : 기존 컴포넌트 CSS 모듈이 참조하는 시맨틱 별칭
- `.sectionRed` / `.sectionBlue` / `.sectionCream` … : `--background`·`--color` 를 스왑하는 색 반전 클래스

Win98 창 크롬은 [`useWin98Styles.ts`](src/components/Boot/useWin98Styles.ts) 가 `98.css` 를
런타임에 재채색 + `[data-win98-root]` 로 스코프해서 주입한다. 이 스코프 밖(랜딩 페이지)에는
98.css 가 적용되지 않는다.
