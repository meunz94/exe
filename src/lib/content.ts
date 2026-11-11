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

/** 대사 바로 아랫줄의 `(번역)` 줄 — 굵게 등으로 감싸여 있어도 */
const TRANSLATION_LINE = /^\s*(\*{0,3})\(.+\)(\*{0,3})\s*$/;

export function parseBlocks(md: string): Block[] {
  // 빈 줄로 문단을 나누되, <details> 토글은 닫힐 때까지 한 덩어리로 둔다
  const parts: string[] = [];
  let open: string[] | null = null;
  for (const raw of md.split(/\n\s*\n/)) {
    const p = raw.trim();
    if (!p) continue;
    if (open) {
      open.push(p);
      if (/<\/details>\s*$/.test(p)) {
        parts.push(open.join("\n\n"));
        open = null;
      }
    } else if (/^<details[\s>]/.test(p) && !/<\/details>\s*$/.test(p)) open = [p];
    else parts.push(p);
  }
  if (open) parts.push(open.join("\n\n"));

  return parts.map((p) => {
    // 한 줄 대사, 또는 대사 + 아랫줄 번역(괄호)은 같은 이름 아래 한 묶음
    const extra = p.split("\n").slice(1);
    if (!extra.every((l) => TRANSLATION_LINE.test(l))) return { type: "p", text: p } as Block;
    const m = p.match(DIALOGUE);
    if (m) {
      let text = m[2].trim();
      // **이름: "대사"\n(번역)** 처럼 문단 전체가 굵게면, 이름을 떼고 남은 쪽에도 여는 ** 를 돌려준다
      if (/^\s*\*\*/.test(p) && !/^\s*\*\*[^*\n]+?\*\*\s*[:：]/.test(p)) text = "**" + text;
      return { type: "d", who: m[1].trim(), text } as Block;
    }
    // <mark>이름: "대사"</mark> 처럼 형광펜·글자색이 이름부터 칠해져 있으면, 이름은 떼고 꾸밈은 대사에만 남긴다
    const lead = p.match(/^(?:<mark>|<span class="ink">|\*\*)+/)?.[0] ?? "";
    const m2 = lead ? p.slice(lead.length).match(DIALOGUE) : null;
    if (m2) return { type: "d", who: m2[1].trim(), text: lead + m2[2].trim() } as Block;
    return { type: "p", text: p } as Block;
  });
}

/**
 * 대사 아랫줄의 `(번역)` 을 줄바꿈 + 회색 묶음으로 바꾼다.
 * `**"대사"\n(번역)**` 처럼 굵게가 두 줄에 걸쳐 있으면 줄마다 따로 닫고 연다.
 */
export function markTranslations(md: string): string {
  return md.replace(/([^\n])\n([ \t]*(\*{0,3})\(([^\n]+)\)(\*{0,3})[ \t]*)(?=\n|$)/g, (_all, prev: string, _line, open: string, inner: string, close: string) => {
    // 앞줄에서 열린 굵게를 번역 줄이 닫는 경우: 앞줄 끝에서 닫고 번역 안에서 다시 연다
    const carry = !open && close ? close : "";
    const o = open || carry;
    return `${prev}${carry}<br /><span class="tr">${o}(${inner})${close}</span>`;
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
