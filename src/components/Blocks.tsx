import { parseBlocks, splitHtmlFences, type Block } from "../lib/content";
import { useSubjectColors } from "../lib/site";
import type { Subject } from "../lib/types";
import { Markdown } from "./Markdown";

/**
 * 로그 본문: 서술 문단 + `이름: 대사` 대본 블록.
 * 대사는 이름 칸(대문자) 옆에 본문이 붙고, 이름은 페어 두 사람만 각자 색(그 밖의 인물은 본문색).
 */
export function Blocks({ md, subjects }: { md: string; subjects: Subject[] }) {
  // ```html 코드블록은 그대로 HTML 로 끼워 넣고, 나머지는 문단·대사 블록으로
  type HtmlBlock = { type: "html"; html: string };
  const blocks: (Block | HtmlBlock)[] = splitHtmlFences(md).flatMap((seg): (Block | HtmlBlock)[] => (seg.type === "html" ? [{ type: "html", html: seg.html }] : parseBlocks(seg.text)));
  const colors = useSubjectColors(subjects);
  const isSubject = (s: Subject | undefined, who: string) => {
    const w = who.trim().toLowerCase();
    if (!s || !w) return false;
    return w.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(w) || w.includes(s.big.toLowerCase());
  };
  // 페어 두 사람은 각자 색, 그 밖의 인물(???·모브)은 본문색
  const whoColor = (who: string) => (isSubject(subjects[1], who) ? colors[1] : isSubject(subjects[0], who) ? colors[0] : "var(--fg)");
  return (
    <section aria-label="본문" className="blocks">
      {blocks.map((b, i) => {
        if (b.type === "html") return <div key={i} className="block-html" dangerouslySetInnerHTML={{ __html: b.html }} />;
        if (b.type === "p") return <Markdown key={i} md={b.text} className="block-p" />;
        const prevD = blocks[i - 1]?.type === "d";
        return (
          <div key={i} className="block-d" style={{ marginTop: prevD ? -10 : 0 }}>
            <span className="block-who" style={{ color: whoColor(b.who ?? "") }}>
              {b.who}
            </span>
            <Markdown md={b.text} className="block-text" />
          </div>
        );
      })}
    </section>
  );
}
