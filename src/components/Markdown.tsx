import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { markTranslations } from "../lib/content";
import { publicUrl } from "../lib/url";

/**
 * 본문 마크다운 렌더러.
 * - `## 1. 소제목` 의 번호는 모노 회색으로
 * - `-` 목록과 `1.` 목록은 같은 모양(모노 회색 표식 + 같은 들여쓰기)
 * - `---` 구분선은 "···", 토글(<details>)은 + / × 로 여닫는 줄
 * - 대사 아랫줄의 `(번역)` 은 줄바꿈 + 회색
 * - 인용문 안의 `이름: 대사` 는 이름을 대문자 라벨로 (두 번째 subject 는 강조색)
 */
export function Markdown({
  md,
  className,
  speakers,
  speakerColors,
}: {
  md: string;
  className?: string;
  /** [첫 번째 인물, 두 번째 인물] — 두 번째면 강조색 */
  speakers?: [string, string];
  /** [첫 번째, 두 번째] 이름 색 — 없으면 두 번째만 강조색 */
  speakerColors?: [string, string];
}) {
  return (
    <div className={`prose ${className ?? ""}`}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          h2: ({ children }) => {
            const text = String(Array.isArray(children) ? children.join("") : children ?? "");
            const m = text.match(/^(\d+[.)]?)\s+(.*)$/);
            return m ? (
              <h2>
                <span className="num">{m[1]}</span> {m[2]}
              </h2>
            ) : (
              <h2>{children}</h2>
            );
          },
          // 구분선은 사이트 공통의 점 구분 "···"
          hr: () => (
            <div role="separator" className="dots prose-sep">
              ···
            </div>
          ),
          img: ({ src, alt }) => <img src={publicUrl(String(src ?? ""))} alt={alt ?? ""} loading="lazy" />,
          p: ({ children, node }) => {
            // 인용문 안의 대사 라벨
            const first = Array.isArray(children) ? children[0] : children;
            if (typeof first === "string" && node) {
              const m = first.match(/^([A-Za-z가-힣.·'? ]{1,20}?)\s*[:：]\s+/);
              if (m && speakers) {
                const who = m[1].trim();
                const isB = speakers[1] && who.toLowerCase().includes(speakers[1].toLowerCase().split(" ").pop() ?? "");
                const rest = Array.isArray(children) ? [first.slice(m[0].length), ...children.slice(1)] : first.slice(m[0].length);
                return (
                  <p>
                    <span className={`speaker ${isB ? "b" : ""}`} style={speakerColors ? { color: speakerColors[isB ? 1 : 0] } : undefined}>
                      {who}
                    </span>
                    {rest}
                  </p>
                );
              }
            }
            return <p>{children}</p>;
          },
        }}
      >
        {markTranslations(md)}
      </ReactMarkdown>
    </div>
  );
}
