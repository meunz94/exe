import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import { publicUrl } from "../utils/publicUrl";
import { fixCjkEmphasis } from "../utils/markdown";
import styles from "./DocPage.module.css";

interface PromptPageProps {
  onBack: () => void;
}

/**
 * `prompt` — the generation prompts that used to live in the Memo dialog under
 * Settings, including the per-section copy button.
 *
 * Layout is deliberately provisional; this page gets its own design pass.
 */
export default function PromptPage({ onBack }: PromptPageProps) {
  const [content, setContent] = useState("불러오는 중...");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(publicUrl("data/memo.md"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""));
      })
      .catch(() => {
        if (!cancelled) setContent("(프롬프트를 불러올 수 없습니다.)");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Copies every node between this heading and the next h3/hr — the section's
  // prompt block, without the heading itself.
  const copySection = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const heading = e.currentTarget.closest("h3");
    if (!heading) return;

    let text = "";
    let node = heading.nextElementSibling;
    while (node && node.tagName !== "H3" && node.tagName !== "HR") {
      text += (node.textContent || "") + "\n";
      node = node.nextElementSibling;
    }

    navigator.clipboard.writeText(text.trim()).then(() => {
      const name = heading.querySelector("span")?.textContent ?? "";
      setCopied(name);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const components: Components = {
    h3: ({ children }) => (
      <h3>
        <span className={styles.h3Row}>
          <span>{children}</span>
          <button
            type="button"
            className={`${styles.copyBtn} ${copied === String(children) ? styles.copyBtnDone : ""}`}
            onClick={copySection}
          >
            {copied === String(children) ? "복사됨" : "복사"}
          </button>
        </span>
      </h3>
    ),
  };

  return (
    <div className={styles.page} data-dark-bg>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to desk
        </button>
        <span>Nº— / Prompt</span>
      </div>

      <h1 className={styles.title}>Prompt</h1>
      <p className={styles.lede}>
        캐릭터를 그릴 때 쓰는 생성 프롬프트. 섹션별로 복사해서 쓰세요.
      </p>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span>Generation Prompts</span>
          <span>⬤</span>
        </div>
        <div className={styles.markdown}>
          <Markdown rehypePlugins={[rehypeRaw]} components={components}>
            {fixCjkEmphasis(content.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
          </Markdown>
        </div>
      </section>
    </div>
  );
}
