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
