import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { publicUrl } from "../../utils/publicUrl";
import styles from "./BootScreen.module.css";

interface NewUserDialogProps {
  onClose: () => void;
}

export default function NewUserDialog({ onClose }: NewUserDialogProps) {
  const [content, setContent] = useState<string>("불러오는 중...");

  useEffect(() => {
    let cancelled = false;
    fetch(publicUrl("data/notice.md"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""));
        }
      })
      .catch(() => {
        if (!cancelled) setContent("(약관을 불러올 수 없습니다.)");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`window ${styles.dialog}`}>
      <div className="title-bar">
        <div className="title-bar-text">Welcome to Limbic System</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body">
        <p className={styles.dialogText} style={{ marginBottom: 6 }}>
          이용 약관입니다. 내용을 확인해 주세요.
        </p>

        <div className={styles.dialogBody}>
          <div className={styles.markdown}>
            <Markdown rehypePlugins={[rehypeRaw]}>{content}</Markdown>
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button className="default" onClick={onClose}>
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
}
