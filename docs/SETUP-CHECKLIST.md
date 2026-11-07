# 운영 준비 체크리스트 (사용자가 직접 할 것)

코드는 준비됐고, 아래는 계정·서비스에 손을 대야 해서 사용자가 해야 하는 일이다.
순서대로 하면 된다. 각 항목의 "확인" 이 되면 다음으로 넘어간다.

---

## 1. 노션 (필수)

- [x] **통합 토큰** 준비. 기존 통합 "Github" 을 쓰거나 새로 만든다. → 저장소 루트 `.env` 에 `NOTION_TOKEN=...`
  ```
  (지금 `.env` 의 토큰은 유효한 것을 확인했다.)
  ```
- [x] 노션에 **새 빈 페이지** 생성 (예: `vance.zip`). 페이지 `•••` → *Connections* → 통합 연결.
- [x] 페이지 ID 를 알려주거나 직접 실행 (2026-11-06 실행됨):
  ```
  ```bash
  NOTION_PARENT_PAGE=3b15a6bfc77380a08974fafc6577a02a npm run notion:bootstrap
  ```
  → `notion.config.json` 에 DB 16개의 ID 가 채워진다. **커밋.**
  ```
- [x] 샘플 데이터 시드 (2026-11-06, `npm run notion:seed`) — `public/data` 의 대괄호 플레이스홀더가 그대로 행으로 들어가 있다.
  노션에서 각 행의 `[...]` 를 실제 내용으로 바꾸면 된다. **랜딩 슬라이드만 비어 있다** (이미지 필요).
- [ ] 최소 데이터 입력 (공개 속성이 있는 DB 는 **공개** 체크):
  - 페어 DB 1행 — 이름 · ID(`by`) · 코드 · 제목위/제목아래 · 태그라인 · 강조색 · 강조색다크 · **기본** 체크
  - 인물 DB 2행 — 이름 · 페어 · 큰이름 · 라벨 · 이미지(투명 PNG) · 정렬 1/2 (정렬이 곧 01/02)
  - 랜딩 슬라이드 1행 이상 — 왼쪽/오른쪽 이미지
  - (선택) 두 번째 페어가 있으면 페어 DB 에 한 행 더. 이름·태그라인·인물한줄은 "다른 페어" 카드에 쓰인다
- [x] 로컬 확인 (시드 직후 1회 왕복 확인됨 — 시드한 행이 같은 파일로 되돌아온다):
  ```
  ```bash
  npm run notion:sync && npm run dev
  ```
  샘플 데이터가 실제 데이터로 바뀐다. 이미지가 webp 로 변환되는지, 페어 색이 바뀌는지 본다.
  ```
- [ ] 나머지 DB 채우기 — 속성 의미는 [NOTION.md](./NOTION.md) 2절. 글 본문 규칙은 2-7.
  - AU: `라벨` 파일(정사각)을 올린다. 프로필은 본문 `## 이름` 섹션, 갤러리는 본문 안의 "갤러리" 하위 페이지.
  - 플레이리스트 DB 에 유튜브 영상 ID 가 있는 곡을 넣어야 랜딩 재생 버튼이 켜진다. 여러 곡이면 정렬 순으로 이어 재생.
  - 갤러리 DB 는 시드가 비워 두었다. 그림 한 장 = 한 행(제목·페어·이미지·공개). 행이 없으면 Gallery 페이지가 빈 격자로 뜬다.

**확인**: `npm run dev` 에서 랜딩·프로필·타임라인·로그·스토리·일기·갤러리·AU·링크가 실제 내용으로 보인다.

---



## 2. GitHub · 배포 (필수)

- [ ] 저장소 `meunz94/exe` 에 이 폴더(`vance-zip`)의 변경을 커밋·푸시. (git 은 이미 이 폴더로 옮겨져 있다.)
- [ ] *Settings → Secrets and variables → Actions* 에 `NOTION_TOKEN` 등록 (이전에 있었다면 그대로).
- [ ] *Settings → Pages* 가 GitHub Actions 배포로 되어 있는지 확인. 도메인 `vance.zip` CNAME 은 `public/CNAME` 그대로.
- [ ] Actions 탭에서 **Sync content from Notion** 을 한 번 수동 실행 → 커밋이 생기고 **Deploy** 가 이어서 돈다.
- [ ] (선택) 노션 버튼으로 동기화를 부르려면: 이전 사이트에서 쓰던 웹훅 프록시(`repository_dispatch`,
  ```
  이벤트 `notion-sync`)를 그대로 쓴다. 바뀐 것이 없다. 새로 만들려면 Cloudflare Worker 하나에
  `GITHUB_TOKEN`(repo 권한) 을 넣고 `POST https://api.github.com/repos/meunz94/exe/dispatches`
  body `{"event_type":"notion-sync"}` 를 보내면 된다.
  ```

**확인**: [https://vance.zip](https://vance.zip) 에 노션 내용이 보인다. 노션에서 글을 고치고 Sync 를 돌리면 2~3분 안에 반영된다.

---



## 3. 방명록 쓰기 프록시 (방명록 폼을 켜려면)

- [ ] Cloudflare → *Workers & Pages* → 새 Worker. `workers/guestbook-proxy.js` 내용을 붙여넣는다.
- [ ] *Settings → Variables* :

  | 변수                             | 값                                                             |
  | ------------------------------ | ------------------------------------------------------------- |
  | `NOTION_TOKEN` (secret)        | 1절 토큰                                                         |
  | `GUESTBOOK_DB`                 | `notion.config.json` 의 `databases.guestbook`                  |
  | `ALLOW_ORIGIN`                 | `https://vance.zip` (로컬 테스트도 하려면 `,http://localhost:5173` 추가) |
  | `PUBLISH_DEFAULT`              | `false` 권장 (노션에서 공개 체크 후 노출). 바로 노출하려면 `true`                 |
  | `GITHUB_TOKEN` · `GITHUB_REPO` | (선택) `true` 로 둘 때 즉시 재배포하려면. `meunz94/exe`                    |


- [ ] 배포된 워커 URL(`https://xxx.workers.dev`) 을 노션 **사이트 설정** DB 에 키 `guestbookEndpoint`, 값 = URL 로 추가.
- [ ] Sync 실행. 사이트 Links 페이지의 방명록 폼이 "쓰기 경로 미연결" 대신 입력 가능 상태가 된다.
- [ ] 테스트 글 하나 남겨 노션 방명록 DB 에 행이 생기는지 확인. `PUBLISH_DEFAULT=false` 면 공개를 켜고 Sync.

**확인**: 사이트에서 쓴 글이 노션에 들어오고, 동기화 후 방명록 목록에 보인다.

---



## 4. AI 캐릭터 댓글 (by 가동 중 · kizu 대기)

워커 코드는 [workers/ai-board/](../workers/ai-board/) (설계 [AI-BOARD-PLAN.md](./AI-BOARD-PLAN.md), 프롬프트 [CONVO-PROMPTS.md](./CONVO-PROMPTS.md)).
2026-11-07 Marinara 서버 `/root/vance-board-worker/` 에 배포, `/etc/cron.d/vance-board` 로 30분마다 돈다. 로그 `worker.log`.

- [x] Marinara 콘보 채팅: by DM `ZE-EraWzGlZXhZuCYDwzQ` (캐릭터 Dr. 밴스 · 페르소나 블랑), kizu 그룹 `1kyMKD5HWwqvCZ4RukqV2`
- [x] 로어북 "[개인홈] 변연 게시판 로그" `5N1iOGs1N4MaVn380RrAu` — 워커가 글 1개 = 엔트리 1개로 갱신. 본편 채팅에 Knowledge Router 로 붙이는 건 사용자 몫
- [x] 서버 `.env`: NOTION_TOKEN · GITHUB_TOKEN · MARINARA_BASIC_AUTH_USER/PASS
- [x] 노션 `작성자` 옵션을 `Dr. 밴스` · `블랑` 으로 바꿈 (일기장·댓글 DB). 사이트에도 이 이름 그대로 뜬다
- [x] 첫 실행 확인: 일기 「개인홈을 만들었어요」 본문에 `[^1]` `[^2]` 가 들어가고 댓글 DB 에 AI 행 2개, 로어북 엔트리 1개 생김
- [x] 방명록 답글 확인: 연짱 방명록에 Dr. 밴스 답글이 붙고 Links 페이지에 `↳ Dr. 밴스` 로 보임. 방명록은 `출처 = 사람` · 공개 · AI처리 비어 있는 행만 대상
- [ ] **2절 push 가 끝나면** cron 줄에서 `--no-dispatch` 를 뗀다 (`ssh Marinara sed -i 's/ --no-dispatch//' /etc/cron.d/vance-board`). 그 전엔 워커가 노션만 쓰고 재배포는 안 부른다
- [ ] by 채팅 프리셋에 CONVO-PROMPTS.md 의 by 판이 들어가 있는지 확인 (지금은 사용자가 만든 프리셋 `rSeXmp6pVO4hSoo9TB5HE`)
- [ ] 일기 글 주기 확인: `config.json` 의 `post.afterHourKst: 21`, `everyNDays: 1` — 매일 21시(KST) 이후 첫 실행 때 Dr. 밴스가 한 편 쓴다. 바꾸려면 config 수정 후 rsync
- [ ] kizu: 두 캐릭터의 `characterId` 를 채팅에서 읽어 `config.json` 에 캐릭터 2개로 추가(`human` 대신 상대 캐릭터 규칙 — 워커에 kizu 모드 아직 없음, 요청 시 구현)

**확인**: 블랑이 일기를 쓰고 공개 체크 → 30분 안에 본문에 `[^n]` 과 댓글이 생긴다. 방명록도 공개 행이면 30분 안에 답글. 사이트는 Sync 후 반영.

---



## 5. 그 밖에 알아 둘 것

- `public/data/**` 의 md·json 은 동기화가 덮어쓴다. 손으로 고친 내용은 노션에 넣어야 남는다.
- `.notion-manifest.json` 은 캐시다. 이미지가 안 바뀌는 것 같으면 `{}` 로 비우고 Sync 를 다시 돌린다.
- 옛 사이트의 노션 DB 와 `public/images/chips/*.webp` 는 참고용으로만 남아 있다. 지워도 된다.
- 이 폴더의 변경은 아직 **커밋 전**이다. 2절 첫 항목에서 함께 올린다.

