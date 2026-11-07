/** 사이트 전체 데이터 모델. public/data/* 의 JSON 과 1:1 로 대응한다. */

export interface Site {
  /** 루트("/")에서 열리는 페어 id */
  defaultPair: string;
  /** Links 페이지 "Our banner" */
  banner: { image: string; code: string };
  /** 방명록 쓰기 프록시(Cloudflare Worker 등). 비어 있으면 폼을 숨기지 않고 안내만 띄운다. */
  guestbookEndpoint: string;
  /** AI(캐릭터)가 글/댓글을 남기는 게시판. 표시용 플래그 — 워커 설정과 같은 값으로 맞춘다. */
  aiBoards: string[];
}

export interface Slide {
  /** 왼쪽·오른쪽 인물 이미지(투명 PNG). 비어 있으면 자리표시 */
  left: string;
  right: string;
  caption: string;
}

export interface Pair {
  id: string;
  /** 로그 코드 접두어 (LS-128-VB) */
  code: string;
  name: string;
  tagline: string;
  /** 랜딩의 거대 타이포 두 줄 */
  titleTop: string;
  titleBottom: string;
  accent: string;
  accentDark: string;
  abstractTitle: string;
  abstractSub: string;
  synopsis: string;
  /** 페어 전환 버튼에 보이는 한 줄 (예: "Dr. Vance · Blanc") */
  subjectsLine: string;
  slides: Slide[];
  relation: { keywords: string[]; text: string };
}

export interface Spec {
  k: string;
  v: string;
}

export interface Section {
  no: string;
  en: string;
  ko: string;
  md: string;
}

export interface Subject {
  id: string;
  no: string;
  name: string;
  /** 배경에 깔리는 큰 글자 (예: Vance) */
  big: string;
  /** 랜딩 라벨 (예: Observer / Subject) */
  label: string;
  role: string;
  /** 인물 고유색(라이트/다크). 비우면 라이트는 두 번째 인물, 다크는 첫 번째 인물이 강조색 */
  color?: string;
  colorDark?: string;
  /** 상세 페이지 이름 아래 강조색 칩 */
  keywords: string[];
  image: string;
  specs: Spec[];
  /** 상대를 부르는 호칭 */
  call: string;
  /** 대사 세트 — 클릭할 때마다 다음 세트 */
  quotes: string[][];
  sections: Section[];
}

export interface Person {
  id: string;
  name: string;
  /** 어느 쪽 인물의 관계인지: A = 첫 번째 subject, B = 두 번째 (노션에서 인물마다 따로 넣는다) */
  with: "A" | "B";
  relation: string;
  image: string;
  md: string;
}

export interface SubjectsFile {
  subjects: Subject[];
  people: Person[];
}

/** 대사 한 줄. who 가 없으면 지문 */
export interface Line {
  who?: string;
  text: string;
}

export interface Scene {
  no: string;
  place: string;
  lines: Line[];
}

export interface Chapter {
  id: string;
  /** 번호 아래 라벨 — "DAY+1" 처럼 */
  day: string;
  /** 주요 사건 — 번호를 강조색으로 */
  major?: boolean;
  title: string;
  body: string;
  scenes: Scene[];
  /** 관련 스토리 id (vol-1, vol-1-2 …) */
  stories: string[];
}

export interface StoryMeta {
  id: string;
  vol: number;
  title: string;
  abstract: string;
  /** 각 subject 의 소속 (각주 1, 2) */
  affiliations: string[];
  pages: string;
  /** 타임라인 챕터 id */
  chapter: string;
  path: string;
}

export interface LogMeta {
  id: string;
  /** 생성 순 번호 "001" (= id) */
  no: string;
  date: string;
  /** 로그 구분: 본편(ORIGINAL) / AU. 라벨 코드 접미어는 OR / AU */
  kind: "ORIGINAL" | "AU";
  title: string;
  /** 소제목 — 뷰어의 제목 아래, 목록의 NOTES 자리 (없으면 본문 미리보기) */
  subtitle: string;
  tags: string[];
  photo: string;
  caption: string;
  excerpt: string;
  /** 대사 한 줄 발췌 (사진 라벨에서만 사용) */
  quote?: Line;
  path: string;
  /** 잠금 글 — 본문은 cipher 에 암호화돼 있고 md 파일 본문은 비어 있다 */
  locked?: boolean;
  cipher?: string;
}

export interface DiaryMeta {
  id: string;
  no: number;
  date: string;
  author: string;
  title: string;
  path: string;
}

export interface Comment {
  id: string;
  /** 어느 페어의 글인지 (일기 번호는 페어마다 겹칠 수 있다) */
  pair?: string;
  target: "diary" | "guestbook";
  targetId: string;
  author: string;
  source: "AI" | "사람";
  date: string;
  content: string;
  /** 본문의 각주 번호에 붙는 코멘트면 그 번호 */
  anchor?: number;
  replyTo?: string;
}

export interface GuestEntry {
  id: string;
  who: string;
  date: string;
  text: string;
  /** 사이트에서 방금 써서 아직 Notion 동기화 전인 글 */
  pending?: boolean;
}

export interface Neighbor {
  name: string;
  image: string;
  url: string;
}

export interface LinkRef {
  name: string;
  desc: string;
  url: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  image: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  videoId?: string;
}

export type Theme = "light" | "dark";

/* ------------------------------------------------------------- AU (칩 라이브러리) */

/** 본문의 `## 이름` 섹션 하나 */
export interface AuMember {
  name: string;
  image: string;
  lines: string[];
}

export interface AuChip {
  id: string;
  title: string;
  /** 칩 뒷면·목록용 한 줄 */
  description: string;
  synopsis: string;
  members: AuMember[];
  /** `갤러리` 파일 속성 */
  gallery: string[];
  /** 상세 모드 배경 */
  bg: string;
  /** 카트리지 라벨 이미지(정사각). 비우면 public/images/chips/<id>.webp → 생성 목업 */
  label?: string;
  /** 박스아트(세로). 비우면 라벨 → 생성 목업 */
  box?: string;
}
