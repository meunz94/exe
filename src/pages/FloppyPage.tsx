import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { publicUrl } from "../utils/publicUrl";
import { FONT_CREDITS, MODEL_CREDITS, type Credit } from "../data/credits";
import styles from "./FloppyPage.module.css";

interface Neighbor {
  name: string;
  image: string;
  url: string;
}

type DocId = "notice" | "prompts" | "neighbor" | "credits";

const MENU: { id: DocId; label: string; hint: string }[] = [
  { id: "notice", label: "NOTICE.MD", hint: "이용 안내 및 공지" },
  { id: "prompts", label: "PROMPTS.MD", hint: "생성 프롬프트 메모" },
  { id: "neighbor", label: "NEIGHBOR.LNK", hint: "이웃 사이트" },
  { id: "credits", label: "CREDITS.MD", hint: "에셋 출처" },
];

const DOC_SOURCES: Partial<Record<DocId, string>> = {
  notice: "data/notice.md",
  prompts: "data/memo.md",
};

/** Strips the YAML frontmatter the Notion sync prepends to markdown files. */
const stripFrontmatter = (text: string) =>
  text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

interface FloppyPageProps {
  onBack: () => void;
}

/**
 * FLOPPY: a bare DOS disk menu on white. Arrow keys / click pick a document;
 * it opens in an old-OS window with its own scrollbar. Esc backs out one
 * level (window → menu → hub).
 */
export default function FloppyPage({ onBack }: FloppyPageProps) {
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState<DocId | null>(null);
  const [docs, setDocs] = useState<Partial<Record<DocId, string>>>({});
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);

  // Fetch lazily on first open, then keep — the files are tiny.
  useEffect(() => {
    if (!open) return;
    const src = DOC_SOURCES[open];
    if (src && docs[open] === undefined) {
      fetch(publicUrl(src))
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((text) => setDocs((d) => ({ ...d, [open]: stripFrontmatter(text) })))
        .catch(() => setDocs((d) => ({ ...d, [open]: "(문서를 불러올 수 없습니다.)" })));
    }
    if (open === "neighbor" && neighbors.length === 0) {
      fetch(publicUrl("data/neighbors.json"))
        .then((r) => (r.ok ? r.json() : []))
        .then(setNeighbors)
        .catch(() => setNeighbors([]));
    }
  }, [open, docs, neighbors.length]);

  const closeOrBack = useCallback(() => {
    if (open) setOpen(null);
    else onBack();
  }, [open, onBack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeOrBack();
      if (open) return;
      if (e.key === "ArrowUp") setCursor((c) => (c + MENU.length - 1) % MENU.length);
      if (e.key === "ArrowDown") setCursor((c) => (c + 1) % MENU.length);
      if (e.key === "Enter") setOpen(MENU[cursor].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cursor, closeOrBack]);

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <button type="button" onClick={onBack}>
          ← DESK
        </button>
        <span>A:\LIMBIC</span>
      </div>

      {!open && (
        <div className={styles.menuWrap}>
          <pre className={styles.banner}>{"LIMBIC SYSTEM DISK UTILITY  v2.0\n(C) Yeonzzang Corp. All rights reserved."}</pre>
          <div className={styles.menu} role="menu">
            {MENU.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${i === cursor ? styles.menuActive : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => setOpen(item.id)}
              >
                <span className={styles.menuLabel}>{item.label}</span>
                <span className={styles.menuHint}>{item.hint}</span>
              </button>
            ))}
          </div>
          <p className={styles.help}>↑↓ 이동 · ENTER 열기 · ESC 나가기</p>
        </div>
      )}

      {open && (
        <section className={styles.window} aria-label={MENU.find((m) => m.id === open)?.label}>
          <header className={styles.titleBar}>
            <span>A:\LIMBIC\{MENU.find((m) => m.id === open)?.label}</span>
            <button type="button" onClick={() => setOpen(null)} aria-label="닫기">
              ×
            </button>
          </header>
          <div className={styles.windowBody}>
            {open === "neighbor" ? (
              <NeighborList neighbors={neighbors} />
            ) : open === "credits" ? (
              <CreditsList />
            ) : docs[open] === undefined ? (
              <p className={styles.loading}>READING DISK...</p>
            ) : (
              <div className={styles.markdown}>
                <Markdown rehypePlugins={[rehypeRaw]}>{docs[open]}</Markdown>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function NeighborList({ neighbors }: { neighbors: Neighbor[] }) {
  if (neighbors.length === 0) return <p className={styles.loading}>READING DISK...</p>;
  return (
    <ul className={styles.neighbors}>
      {neighbors.map((n) => (
        <li key={n.url}>
          <a href={n.url} target="_blank" rel="noreferrer">
            <img src={publicUrl(n.image)} alt="" loading="lazy" />
            <span>{n.name} ↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function CreditRow({ credit }: { credit: Credit }) {
  return (
    <li>
      <span className={styles.creditTitle}>
        {credit.url ? (
          <a href={credit.url} target="_blank" rel="noreferrer">
            {credit.title} ↗
          </a>
        ) : (
          credit.title
        )}
      </span>
      <span className={styles.creditMeta}>
        by {credit.author} · {credit.license}
      </span>
    </li>
  );
}

function CreditsList() {
  return (
    <div className={styles.markdown}>
      <h3>3D MODELS</h3>
      <ul className={styles.credits}>
        {MODEL_CREDITS.map((c) => (
          <CreditRow key={c.title} credit={c} />
        ))}
      </ul>
      <h3>FONTS</h3>
      <ul className={styles.credits}>
        {FONT_CREDITS.map((c) => (
          <CreditRow key={c.title} credit={c} />
        ))}
      </ul>
    </div>
  );
}
