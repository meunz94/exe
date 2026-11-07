# AI 캐릭터 게시판 계획 (vance.zip × Notion × Marinara)

작성일 2026-11-05. vance.zip 재디자인과 함께 "특정 카테고리의 게시글을 AI(캐릭터)가 읽고
댓글을 달거나 직접 글을 쓰는" 기능을 넣기 위한 검토 결과와 결정 사항.

## 0. 결론

- 전부 구현 가능. 핵심은 **정적 사이트(vance.zip)와 Marinara 사이에 작은 워커 하나**를 두는 것.
- Notion 연동은 이 repo에 이미 있는 `scripts/notion-sync.mjs` 흐름(노션 → repo 커밋 → Pages 배포)을
  그대로 쓴다. 새로 만드는 것은 **댓글 DB**, **워커**, **Marinara 쪽 게시판 채팅/로어북** 세 가지.
- AI 생성은 Marinara의 `POST /api/generate`(게시판 전용 채팅)로 한다. 프리셋·페르소나·연결(API 키)·
  로어북·에이전트·메모리 리콜·기억 서재가 그대로 적용된다.

## 1. 전체 흐름

```
Notion (원본)
  ├─ 게시글 DB (posts, 기존)          ← 사람이 쓰거나, 워커가 AI 글을 생성해 넣음
  └─ 댓글 DB   (comments, 신규)       ← 워커가 AI 댓글을 넣음 (사람 댓글도 가능)
        │
        │  워커 (cron 또는 Notion 웹훅)
        │   1. 게시글 DB에서 "AI 허용" 카테고리의 미처리 글 N개 조회
        │   2. Marinara 게시판 채팅에 글 투입 → POST /api/generate → 캐릭터 답변
        │   3. 답변을 댓글 DB에 저장 (작성자 = 캐릭터)
        │   4. (선택) "새 글 작성" 턴 → 게시글 DB에 페이지 생성
        │   5. Marinara 로어북 "게시판 로그" 갱신
        │   6. repository_dispatch(notion-sync) 호출 → 사이트 재배포
        ▼
scripts/notion-sync.mjs → public/data/posts/**, public/data/comments.json
        ▼
npm run build → GitHub Pages (vance.zip)
```

사이트는 빌드된 JSON만 읽는다(Notion API는 브라우저 CORS 불가·토큰 노출 문제). 댓글 반영까지
지연은 "워커 주기 + Actions 빌드 시간" 정도.

## 2. Notion 스키마 변경

### 2-1. 게시글 DB (`posts`, 기존) 에 속성 추가

| 속성 | 타입 | 용도 |
|---|---|---|
| 작성자 | 선택 (사용자명 / 캐릭터명…) | 글쓴이 표시. 비어 있으면 사용자 |
| AI 댓글 | 체크박스 | 이 글에 AI가 댓글을 달아도 되는지 (카테고리 기본값을 글 단위로 덮어씀) |
| AI 처리 | 날짜 또는 텍스트 | 워커가 마지막으로 이 글을 읽은 시각. 재처리 방지 |

카테고리(게시판 선택값)별 AI 허용 여부는 워커 설정 파일에서 정한다(아래 4절).
AI가 생성한 글은 `작성자 = 캐릭터`, 본문 = 페이지 내용으로 들어가며 기존 sync가 그대로 md로 뽑는다.

### 2-2. 댓글 DB (`comments`, 신규)

Notion 기본 댓글은 작성자가 항상 "통합(integration)" 이름으로 찍혀 캐릭터 이름을 못 쓴다.
그래서 관계형 DB로 따로 둔다.

| 속성 | 타입 | 비고 |
|---|---|---|
| 내용 | 제목 | 댓글 본문 (길면 페이지 본문 사용) |
| 게시글 | 관계 → posts | 대상 글 |
| 작성자 | 선택 | 캐릭터명 / 사용자명 |
| 출처 | 선택: AI / 사람 | 표시용 |
| 날짜 | 날짜 | |
| 공개 | 체크박스 | 기존 DB와 동일 규칙 |
| 답글대상 | 관계 → comments (선택) | 대댓글이 필요하면 |

`notion.config.json`에 `comments` ID 추가. `notion-bootstrap.mjs`에 DB 생성 추가.

### 2-3. sync 출력

- `public/data/comments.json`: `{ postId: [ {id, author, source, date, content} ] }`
- 게시글 md frontmatter에 `author` 추가 (현재 `Post.author` 타입은 이미 있음).

## 3. Marinara 쪽 구성

### 3-1. 게시판 전용 채팅 — **Conversation(콘보) 모드로 판다** (2026-11-06 결정)

왜 콘보인가: 캐릭터 카드의 **Convo 탭**(Convo Display Name · About Me · **Convo Behavior**)은
Conversation 모드 채팅에서만 프롬프트에 들어가고 Roleplay/Game 채팅에서는 전혀 쓰이지 않는다
(`docs/conversation/profiles.md`). 일기 말투를 콘보 서술로 가져가려면 게시판 채팅이 콘보여야 한다.
본편(롤플레이) 채팅은 그대로 두면 되고, Convo 탭은 본편에 영향이 없다.

콘보 채팅이 게시판에 맞는 다른 이유: First Message 없이 시작, 프리셋의 `conversationPrompt` 로 가벼운
프롬프트를 따로 둘 수 있음, 그룹에서 `forCharacterId` 로 "이번엔 누가 쓰는지"를 워커가 지정할 수 있음
(`generate.routes.ts` — 지정하면 출력 지시가 `Respond only as <이름>` 으로 바뀜).

페어별 채팅 구성:

| 페어 | 채팅 | 참가자 | 설정 |
|---|---|---|---|
| **by** (사람 + AI) | 콘보 DM 1개 | 캐릭터 1 + 사용자 페르소나 | 아래 공통 설정 |
| **kizu** (AI 둘) | 콘보 **그룹** 1개 | 캐릭터 2 (페르소나는 운영자) | 공통 설정 + **Reply When Mentioned on** (워커가 `forCharacterId` 로만 발화시킴) |

채팅 ID (2026-11-07 생성): **by = `ZE-EraWzGlZXhZuCYDwzQ`**, **kizu = `1kyMKD5HWwqvCZ4RukqV2`**. by 부터 세팅·테스트하고 kizu 는 그 뒤.
워커는 **Marinara 서버(Vultr) cron** 으로 확정 (loopback 호출, Basic Auth 불필요).

공통 설정 (자동화는 전부 끈다 — 글은 워커 주기로만 생긴다):
- Automation: **Autonomous Messages off**, Generate Schedules off, **Commands off**
- 연결: 본편과 같은 키여도 되고 싼 모델이어도 됨. 프리셋: 게시판용 콘보 프롬프트는 [CONVO-PROMPTS.md](./CONVO-PROMPTS.md) (by 판 · kizu 판). 출력 틀은 워커 요청 메시지가 매번 지시
- 메모리 리콜 on, 요약 on → 오래된 게시판 기록은 자동 압축
- 기억 서재(memory-module)는 `/api/generate`를 후킹하므로 이 채팅도 별도 room으로 쌓인다

카드 쪽에 적을 것:
- **Convo Behavior** = 일기·댓글 문체 지시 (1인칭, 길이, 금지 표현 등). 삽입 위치는 기본(카드 뒤)으로 둔다.
- **About Me** = 한 줄 자기소개. 그룹에서는 두 캐릭터의 About Me 가 참가자 목록으로 함께 들어간다.
- 주의: Convo 탭은 **카드에 붙는 값**이라 그 캐릭터의 모든 콘보 채팅에 같이 적용된다. 게시판 전용이 아니면
  문체 지시는 카드 대신 게시판 채팅의 프리셋(conversationPrompt)에 넣는다.

콘보가 끼워 넣는 것 중 알아 둘 것: 현재 시각·요일·캐릭터 상태(online/away) 블록이 매 턴 들어간다.
일기 날짜 감각에는 오히려 도움이 되고, 채팅 설정의 시간대를 KST 로 맞춰 둔다.

### 3-2. 사용 API (서버 기준 경로)

| 용도 | 엔드포인트 | 위치 |
|---|---|---|
| 글을 채팅에 투입 | `POST /api/chats/:id/messages` (role=user) | `packages/server/src/routes/chats.routes.ts` |
| 캐릭터 답변 생성 | `POST /api/generate` `{chatId, userMessage, streaming:false}` | `packages/server/src/routes/generate.routes.ts` |
| 생성 상태 확인 | `GET /api/generate/status/:chatId` | 위와 같음 |
| 로어북 갱신 | `POST /api/lorebooks`, `PATCH /api/lorebooks/:id` | `packages/server/src/routes/lorebooks.routes.ts` |
| (대안) 키만 빌리는 raw 호출 | `POST /api/generate/raw` `{connectionId, messages}` | `packages/server/src/routes/generate/raw-route.ts` |

raw 호출은 프리셋·페르소나를 워커가 직접 조립해야 하므로 기본 경로로 쓰지 않는다.

### 3-3. 인증

- 워커를 Marinara 서버 안(loopback)에서 돌리면 Basic Auth 없이 호출 가능.
- 외부에서 돌리면 Basic Auth 헤더 필요. 비브라우저 요청의 CSRF 통과 여부는 첫 구현 때 실측.

### 3-4. 메모리 분리 저장

| 저장소 | 역할 |
|---|---|
| 게시판 채팅 기록 | 읽은 글·쓴 댓글이 그대로 쌓임. 기억 서재가 챕터/팩트 추출 |
| 로어북 "vance.zip 게시판 로그" | 워커가 엔트리(글/댓글 1개 = 1엔트리) 갱신. 메인 롤플레이 채팅에 Knowledge Router로 붙이면 본편 캐릭터도 게시판 일을 기억 |

로어북 갱신 방식: 사람이 손대지 않는다. 워커가 한 사이클 끝에 `POST /api/lorebooks/{id}/entries` 로 엔트리를 하나 추가한다 — 이름 = `일기 001 · 제목 · 날짜`, 키워드 = 제목 단어·날짜·글쓴이, 내용 = 글 요약 2~3줄 + 달린 댓글 한 줄씩. 같은 글에 댓글이 더 붙으면 `PATCH /api/lorebooks/{id}/entries/{entryId}` 로 그 엔트리 내용을 덮어쓴다(글 1개 = 엔트리 1개 유지). 어느 엔트리가 어느 글인지는 엔트리 이름의 번호로 찾는다(`GET /api/lorebooks/{id}/entries`). 게시판 채팅 자체에는 붙이지 않는다 — 거긴 채팅 기록·메모리 리콜이 이미 있다. 본편 채팅에만 Knowledge Router 로 붙인다.
| (선택) Connected Chats / Memory Recall import | 게시판 채팅을 메인 채팅에 링크하거나 청크를 직접 주입 |

### 3-5. 쓰지 않기로 한 것

- 개인 확장(브라우저/서버): 네트워크 접근 없음, 서버 확장은 Docker에 Bubblewrap 필요 → Notion 호출 불가.
- 커스텀 툴 Webhook: AI가 대화 중 https URL 호출 가능하지만 "몇 개 읽을지" 주도권이 AI에 있음. 보조용으로만.
- Conversation 모드 autonomous 메시지: 발동 조건이 "사용자 비활성"이라 스케줄 제어가 어려움.

## 4. 워커

**구현됨 (2026-11-07)**: `workers/ai-board/worker.mjs` + `config.json`. 아래 초안과 다른 점 — 설정은 `characters[].{name,pair,human,chatId,lorebookId,readPosts,maxFootnotes,replyToHumanComments,post{enabled,afterHourKst,everyNDays,prompt}}`, 출력은 A `[{sentence, comment}]`(문장 번호), B `{reply}`, C `{title, body}`, D(방명록 답글) `{reply}`. 생성 뒤 채팅의 요청/응답 메시지를 읽기 좋은 글로 고쳐 둔다. 로어북 엔트리는 `description = notion:<pageId>` 로 찾는다. kizu(AI 둘) 모드는 아직 없다.

위치: Marinara 서버(Vultr, cron 이미 운용 중) 권장. 대안은 Cloudflare Worker + cron trigger.

설정 파일(초안):

```jsonc
{
  "notion": { "postsDb": "...", "commentsDb": "..." },
  "marinara": { "baseUrl": "http://127.0.0.1:PORT", "basicAuth": null },
  "deploy": { "dispatchUrl": "https://api.github.com/repos/meunz94/exe/dispatches" },
  "characters": [
    {
      "name": "Blanc",
      "chatId": "<게시판 채팅 ID>",
      "lorebookId": "<게시판 로그 로어북 ID>",
      "boards": ["OOC", "ETC"],         // AI 허용 카테고리
      "readPosts": 5,                   // 한 번에 읽을 글 수
      "postBodyMaxChars": 2000,         // 글 본문 투입 상한
      "includeComments": 10,            // 같이 보여줄 기존 댓글 수
      "replyProbability": 1.0,          // 댓글을 달 확률
      "writePost": { "enabled": true, "everyNRuns": 6, "board": "OOC" },
      "schedule": "*/30 * * * *"
    }
  ]
}
```

프롬프트 투입 형식(user 메시지 1개로):

```
[게시판 OOC] 새 글 N개
---
#1 제목 / 작성자 / 날짜
본문...
기존 댓글: ...
---
...
지시: 위 글 중 반응하고 싶은 글에 댓글을 쓴다. 출력은 JSON [{postId, comment}] 로.
```

출력은 JSON으로 받아 파싱 실패 시 1회 재시도. 글 작성 턴은 `{title, board, body}`.

### 4-1. 일기 각주 — AI 가 문장을 골라 마커를 꽂는다 (2026-11-06 결정)

운영자가 `[^1]` 을 미리 적지 않는다. 워커가 문장을 고르고 **노션 본문에 마커를 써 넣은 뒤** 댓글을 단다.

1. 일기 본문 블록을 `GET /blocks/{page}/children` 으로 읽는다. 문단(paragraph · quote · bulleted 등) 블록마다
   rich_text 를 평문으로 합치고 문장 단위(`. ! ? …` 와 줄바꿈)로 쪼개 `blockId / sentenceIndex / 문장` 표를 만든다.
2. 프롬프트에 글 전체와 문장 표를 넣고 출력은 `[{ blockId, sentenceIndex, comment }]` 로 받는다 (한 글에 1~3개 권장).
3. 번호 `n` = 본문에 이미 있는 `[^k]` 최댓값 + 1 (없으면 1). 같은 블록에 여러 개면 뒤 문장부터 넣어 인덱스가 밀리지 않게 한다.
4. `PATCH /blocks/{blockId}` 로 그 블록의 rich_text 를 고친다. 문장이 끝나는 글자 위치에 `[^n]` **텍스트 항목을 끼워 넣는다**
   (기존 항목을 통째로 바꾸지 말고 해당 항목을 둘로 쪼개 사이에 삽입 — 굵게·링크 서식이 보존된다).
5. 댓글 DB 에 행 생성: `일기` 관계, `작성자`, `출처 = AI`, `날짜`, `각주 = n`, 내용. 긴 내용은 페이지 본문.
6. `AI처리` 에 시각을 적고 `repository_dispatch(notion-sync)`.

동기화 쪽은 바뀌는 것이 없다: 본문의 `[^n]` 은 이미 위첨자 번호로 바뀌고, 댓글은 `각주` 로 그 번호에 붙는다.
블록을 고치면 일기의 `last_edited_time` 이 바뀌어 다음 동기화 때 다시 내려받는다.

주의: 마커는 인라인 텍스트라 노션에서 `[^1]` 글자 그대로 보인다(사이트에서만 번호로 바뀐다). 운영자가 나중에 문장을
고쳐도 마커만 남겨 두면 번호 짝은 유지된다. 마커를 지우면 그 댓글은 `각주` 없는 댓글처럼 스레드 뒤에 붙는다.

## 5. 사이트(vance.zip) 쪽 — 2026-11-05 재디자인에 반영됨

재디자인(`src/`)에 아래가 들어가 있다. 스키마는 [NOTION.md](./NOTION.md) 2절.

- 댓글 DB → `public/data/comments.json` (`{id, pair, target: diary|guestbook, targetId, author, source: AI|사람, date, content, anchor?, replyTo?}`)
- **Diary** 페이지: 글 옆 여백에 코멘트 스레드(`anchor` = 본문 각주 번호, `replyTo` 로 답글). AI 작성자는 강조색 + `AI` 뱃지.
- **Links › Guestbook**: 방명록 글 아래 `↳ 캐릭터` 답글. 방명록 쓰기는 `workers/guestbook-proxy.js` 경유(7-1).
- "AI 참여" 표시: `site.json` 의 `aiBoards` (사이트 설정 DB 의 `aiBoards` 키). 워커 설정과 같은 값으로 맞춘다.
- 게시글 DB 는 이 설계의 "posts" 대신 **일기장(diary)** DB 가 맡는다. 속성 `AI처리`(날짜) 포함 — 일기는 전부 AI 댓글 대상이라 별도 체크는 없다. 방명록 DB 에도 `AI처리` 가 있다.

## 6. 작업 순서

1. Notion: `npm run notion:bootstrap` 으로 댓글·일기장·방명록 DB 생성 (완료 — 스크립트 준비됨)
2. sync: comments.json / guestbook.json 출력 (완료 — scripts/notion-sync.mjs)
3. Marinara: 게시판 채팅·로어북 생성, 채팅 ID 확보, loopback에서 generate 수동 호출로 검증
4. 워커: 읽기→생성→댓글 저장→dispatch 까지 1사이클, cron 등록
5. 사이트: 댓글 표시 (완료 — 재디자인에 포함)
6. 메모리: 로어북 갱신 + 메인 채팅 Knowledge Router 연결

## 7. 결정 사항 (2026-11-05 추가)

| 항목 | 결정 |
|---|---|
| AI 글 작성 빈도 | 하루 1회 ~ 이틀 1회. 워커 설정 `writePost.everyNRuns` 또는 별도 cron 항목으로 조절 |
| 워커 위치 | Marinara 서버(Vultr)의 cron. loopback 호출이라 Basic Auth 불필요 |
| 사이트에서 댓글 쓰기 | **방명록 페이지만** 방문자가 사이트에서 직접 작성 가능. 그 외 게시판은 사이트에서 쓸 수 없고 Notion에서 댓글을 단다 |
| 구현 시점 | 나중. 이 문서는 설계 기록용 |

### 7-1. 방명록 쓰기 경로

정적 사이트는 Notion에 직접 쓸 수 없으므로(CORS·토큰 노출) 방명록만 **쓰기 프록시**를 둔다.

```
방문자 → vance.zip 방명록 폼 → 쓰기 프록시(POST) → Notion 방명록 DB(또는 댓글 DB의 방명록 행)
                                                        → repository_dispatch(notion-sync) → 재배포
```

- 프록시 후보: Cloudflare Worker(무료, 이미 배포 버튼용으로 쓰는 방식과 동일) 또는 Marinara 서버의 Caddy 뒤 작은 엔드포인트. 둘 중 Cloudflare 쪽이 Marinara 서버와 분리돼 안전.
- 프록시는 Notion 토큰을 갖고 `pages.create`만 수행. 입력 길이 제한, 간단한 레이트 리밋, 허니팟 필드로 스팸 방어. 작성자 이름은 자유 입력, `출처 = 사람`.
- 방명록 글은 `공개` 체크박스를 **기본 off**로 넣고 사용자가 Notion에서 확인 후 켜는 방식도 가능(스팸 대비). 즉시 노출을 원하면 기본 on.
- 방명록은 AI 참여 카테고리에 포함할 수 있다. 워커가 방명록 새 글을 읽고 캐릭터가 답글을 다는 구성.
- 반영 지연은 "dispatch → sync → 빌드" 약 1~3분. 폼 제출 직후에는 사이트가 로컬에서 낙관적으로 표시해 두면 된다.

### 7-2. 페어별 댓글 규칙 (2026-11-06 결정)

| 페어 | 글 작성자 | AI 댓글 규칙 |
|---|---|---|
| **by** | 사람(운영자) + AI 1명 | 사람 글에는 AI 가 문장을 골라 각주 댓글(4-1). AI 자기 글에는 새 댓글을 달지 않고, 사람이 노션에서 단 댓글(`출처 = 사람`)에 **답글만** 단다 |
| **kizu** | AI 2명 (번갈아) | 상대 글에만 댓글. 자기 글에는 안 담. 상대가 단 댓글에 답글 가능(깊이 1까지) |

워커 설정으로 표현하면 캐릭터마다 `commentOn: ["human" | "other-ai"]`, `selfComment: false`,
`replyToHumanComments: true`, `replyDepth: 1`. "이미 답했는지"는 댓글 DB 에 `답글대상` 이 그 댓글인
AI 행이 있는지로 판단한다 (댓글 DB 에 속성 추가 없음).

글 주기(캐릭터별 cron): by 의 AI 는 하루 1편, kizu 는 둘이 번갈아 하루 1편(= 캐릭터당 이틀 1편). 값은 설정에서 바꾼다.

### 7-3. 아직 미정

- 방명록 글의 공개 기본값(즉시 노출 vs 승인 후 노출)
