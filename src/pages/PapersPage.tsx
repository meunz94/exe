import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { displayDate, publicUrl } from "../utils/publicUrl";
import styles from "./PapersPage.module.css";

interface ScriptMeta {
  id: string;
  title: string;
  date: string;
  category: "ORG" | "AU";
}

type CategoryFilter = "ALL" | "ORG" | "AU";

const scriptIdFromPath = () => window.location.pathname.split("/")[2] ?? null;

const stripFrontmatter = (text: string) =>
  text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

interface PapersPageProps {
  onBack: () => void;
}

/**
 * PAPERS: a type-specimen wall of script titles — numbered, staggered,
 * dated. The index (scripts.json) is tiny and loads once; a script's
 * markdown body is fetched only when its title is opened, so the wall
 * scales to hundreds of entries.
 */
export default function PapersPage({ onBack }: PapersPageProps) {
  const [items, setItems] = useState<ScriptMeta[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [ascending, setAscending] = useState(false);
  const [open, setOpen] = useState<ScriptMeta | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const bodyCache = useRef(new Map<string, string>());

  useEffect(() => {
    fetch(publicUrl("data/scripts.json"))
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const visible = useMemo(() => {
    const filtered = category === "ALL" ? items : items.filter((s) => s.category === category);
    return [...filtered].sort((a, b) =>
      ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    );
  }, [items, category, ascending]);

  const openScript = useCallback((script: ScriptMeta, pushUrl = true) => {
    setOpen(script);
    setBody(null);
    if (pushUrl) window.history.pushState(null, "", `/papers/${script.id}`);
    const cached = bodyCache.current.get(script.id);
    if (cached !== undefined) {
      setBody(cached);
      return;
    }
    fetch(publicUrl(`data/scripts/${script.id}.md`))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        const stripped = stripFrontmatter(text);
        bodyCache.current.set(script.id, stripped);
        setBody(stripped);
      })
      .catch(() => setBody("(본문을 불러올 수 없습니다.)"));
  }, []);

  const closeScript = useCallback((pushUrl = true) => {
    setOpen(null);
    if (pushUrl && scriptIdFromPath()) window.history.pushState(null, "", "/papers");
  }, []);

  // Deep link: /papers/<id> opens that script once the index is in.
  const consumedDeepLink = useRef(false);
  useEffect(() => {
    if (consumedDeepLink.current || items.length === 0) return;
    consumedDeepLink.current = true;
    const wanted = scriptIdFromPath();
    const script = wanted ? items.find((s) => s.id === wanted) : null;
    if (!script) return;
    const t = window.setTimeout(() => openScript(script, false), 0);
    return () => window.clearTimeout(t);
  }, [items, openScript]);

  // Browser back/forward within the section.
  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.startsWith("/papers")) return;
      const wanted = scriptIdFromPath();
      const script = wanted ? items.find((s) => s.id === wanted) : null;
      if (script) openScript(script, false);
      else setOpen(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [items, openScript]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (open) closeScript();
      else onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeScript, onBack]);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← DESK
        </button>
        <nav className={styles.filters}>
          {(["ALL", "ORG", "AU"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.chip} ${category === c ? styles.chipOn : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className={styles.sort}
          onClick={() => setAscending((v) => !v)}
          aria-label="날짜 정렬 전환"
        >
          DATE {ascending ? "↑" : "↓"}
        </button>
      </header>

      {/* every title runs into the next — one continuous stream of type,
          alternating ink so the seams stay readable */}
      <div className={styles.flow}>
        {visible.map((script, i) => (
          // an anchor, not a button: buttons are atomic inline boxes and
          // refuse to break mid-line, which would kill the continuous flow
          <a
            key={script.id}
            href={`/papers/${script.id}`}
            className={`${styles.entry} ${i % 2 ? styles.inkGray : styles.inkBlack}`}
            onClick={(e) => {
              e.preventDefault();
              openScript(script);
            }}
          >
            <sup className={styles.meta}>
              {script.category}
              {script.date && <>·{displayDate(script.date)}</>}
            </sup>
            {script.title}
          </a>
        ))}
        {items.length === 0 && <span className={styles.empty}>READING DISK...</span>}
      </div>

      <p className={styles.count}>
        {visible.length} SCRIPTS{category !== "ALL" ? ` — ${category}` : ""}
      </p>

      {open && (
        <div className={styles.lightbox} onClick={() => closeScript()}>
          <article className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <header className={styles.sheetHead}>
              <span className={styles.sheetMeta}>
                {open.category}
                {open.date && <> · {displayDate(open.date)}</>}
              </span>
              <button type="button" className={styles.close} onClick={() => closeScript()}>
                ×
              </button>
            </header>
            <h1 className={styles.sheetTitle}>{open.title}</h1>
            <div className={styles.markdown}>
              {body === null ? (
                <p className={styles.loading}>READING...</p>
              ) : (
                <Markdown rehypePlugins={[rehypeRaw]}>{body}</Markdown>
              )}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
