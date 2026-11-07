import { parseBlocks, splitHtmlFences, type Block } from "../lib/content";
import { useSubjectColors } from "../lib/site";
import type { Subject } from "../lib/types";
import { Markdown } from "./Markdown";

/**
 * 로그 본문: 서술 문단 + `이름: 대사` 대본 블록.
 * 대사는 이름 칸(대문자) 옆에 본문이 붙고, 두 번째 subject 의 이름은 강조색.
 */
export function Blocks({ md, subjects }: { md: string; subjects: Subject[] }) {
  // ```html 코드블록은 그대로 HTML 로 끼워 넣고, 나머지는 문단·대사 블록으로
  type HtmlBlock = { type: "html"; html: string };
  const blocks: (Block | HtmlBlock)[] = splitHtmlFences(md).flatMap((seg): (Block | HtmlBlock)[] => (seg.type === "html" ? [{ type: "html", html: seg.html }] : parseBlocks(seg.text)));
  const colors = useSubjectColors(subjects);
  const isB = (who: string) => {
    const b = subjects[1];
    if (!b) return false;
    const w = who.toLowerCase();
    return w.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(w) || w.includes(b.big.toLowerCase());
  };
  return (
    <section aria-label="본문" className="blocks">
      {blocks.map((b, i) => {
        if (b.type === "html") return <div key={i} className="block-html" dangerouslySetInnerHTML={{ __html: b.html }} />;
        if (b.type === "p") return <Markdown key={i} md={b.text} className="block-p" />;
        const prevD = blocks[i - 1]?.type === "d";
        return (
          <div key={i} className="block-d" style={{ marginTop: prevD ? -10 : 0 }}>
            <span className="block-who" style={{ color: colors[isB(b.who ?? "") ? 1 : 0] }}>
              {b.who}
            </span>
            <Markdown md={b.text} className="block-text" />
          </div>
        );
      })}
    </section>
  );
}
