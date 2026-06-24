import { useEffect, useState, useCallback } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import { publicUrl } from "../../utils/publicUrl";
import { fixCjkEmphasis } from "../../utils/markdown";
import styles from "./BootScreen.module.css";

interface MemoDialogProps {
  onClose: () => void;
}

export default function MemoDialog({ onClose }: MemoDialogProps) {
  const [content, setContent] = useState<string>("불러오는 중...");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
        if (!cancelled) setContent("(메모를 불러올 수 없습니다.)");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Copy every node between this section's h3 and the next h3/hr — same behaviour
  // as the prompt copy button that used to live on the main page.
  const handleCopySection = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const h3 = btn.parentElement;
    if (!h3) return;

    let text = "";
    let sibling = h3.nextElementSibling;
    while (sibling && sibling.tagName !== "H3" && sibling.tagName !== "HR") {
      text += (sibling.textContent || "") + "\n";
      sibling = sibling.nextElementSibling;
    }
    text = text.trim();

    navigator.clipboard.writeText(text).then(() => {
      const span = h3.querySelector("span");
      setCopiedId(span?.textContent || "");
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const components: Components = {
    h3: ({ children }) => (
      <h3 className={styles.memoH3}>
        <span>{children}</span>
        <button
          className={`${styles.memoCopyBtn} ${copiedId === String(children) ? styles.memoCopyBtnDone : ""}`}
          onClick={handleCopySection}
          type="button"
        >
          {copiedId === String(children) ? "복사됨!" : "복사하기"}
        </button>
      </h3>
    ),
  };

  return (
    <div className={`window ${styles.dialog}`}>
      <div className="title-bar">
        <div className="title-bar-text">Memo</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body">
        <div className={styles.dialogBody}>
          <div className={styles.markdown}>
            <Markdown rehypePlugins={[rehypeRaw]} components={components}>
              {fixCjkEmphasis(content.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
            </Markdown>
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button className="default" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
