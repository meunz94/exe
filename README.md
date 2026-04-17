# by

## 콘텐츠 추가 가이드

`npm run dev` / `npm run build` 시 아래 스크립트들이 자동 실행되어 JSON을 생성한다.

### 게시글 추가

`public/data/posts/{카테고리}/{게시판}/` 에 `.md` 파일 추가.

```
public/data/posts/1-A/OOC/9.md
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
  { "id": "yt-1", "videoId": "dQw4w9WgXcQ", "title": "영상 제목", "category": "1-A" }
]
```

- `videoId`는 YouTube URL의 `v=` 파라미터 값 (예: `https://youtube.com/watch?v=dQw4w9WgXcQ` → `dQw4w9WgXcQ`)
- `category`로 해당 카테고리 페이지에만 표시

### 갤러리 이미지 추가

카테고리별: `public/images/gallery/{카테고리}/` 에 이미지 파일 배치.

```
public/images/gallery/1-A/photo.jpeg
```

AU별: `public/images/gallery/au/{auId}/` 에 이미지 파일 배치.

```
public/images/gallery/au/au-4/photo.jpeg
```

캡션이 필요하면 같은 이름의 `.txt` 파일을 옆에 둔다. (예: `photo.txt`)
