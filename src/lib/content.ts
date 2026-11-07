import type { Line } from "./types";

/**
 * 본문 마크다운의 문단을 서술(P)과 대사(D)로 나눈다.
 * 대사는 문단 첫머리가 `이름: 내용` 꼴일 때. (이름은 20자 이하, 콜론 뒤 공백 필수)
 */
export interface Block {
  type: "p" | "d";
  who?: string;
  text: string;
}

const DIALOGUE = /^\s*(?:\*\*)?([A-Za-z가-힣.·'? ]{1,20}?)(?:\*\*)?\s*[:：]\s+(.+)$/s;

/** 본문을 ```html 펜스(그대로 HTML 로 렌더링)와 나머지 마크다운 조각으로 나눈다 */
export function splitHtmlFences(md: string): ({ type: "md"; text: string } | { type: "html"; html: string })[] {
  const out: ({ type: "md"; text: string } | { type: "html"; html: string })[] = [];
  const re = /^```html[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let last = 0;
  for (const m of md.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "md", text: md.slice(last, i) });
    out.push({ type: "html", html: m[1] });
    last = i + m[0].length;
  }
  if (last < md.length) out.push({ type: "md", text: md.slice(last) });
  return out;
}

export function parseBlocks(md: string): Block[] {
  return md
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(DIALOGUE);
      if (m && !p.includes("\n")) return { type: "d", who: m[1].trim(), text: m[2].trim() } as Block;
      return { type: "p", text: p } as Block;
    });
}

/** 타임라인 장면 등 줄 단위 대사 목록 */
export function parseLines(text: string): Line[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(DIALOGUE);
      return m ? { who: m[1].trim(), text: m[2].trim() } : { text: l };
    });
}

/**
 * `[^1]` 각주 표식과 `[^1]: 내용` 정의를 분리한다.
 * 표식은 <sup class="fn">1</sup> 로 바꾸고 정의는 배열로 돌려준다.
 */
export function splitFootnotes(md: string): { body: string; notes: { n: string; text: string }[] } {
  const notes: { n: string; text: string }[] = [];
  const body = md
    .replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_, n, text) => {
      notes.push({ n, text: text.trim() });
      return "";
    })
    .replace(/\[\^([^\]]+)\]/g, (_, n) => `<sup class="fn" id="fnref-${n}">${n}</sup>`);
  return { body: body.replace(/\n{3,}/g, "\n\n").trim(), notes };
}

/** 미리보기용: 마크다운 기호를 떼고 앞부분만 */
export function plainExcerpt(md: string, max = 160): string {
  const text = md
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}
