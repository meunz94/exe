import { useMemo, useState } from "react";
import type { AuItem, AuPost, AuPostWithContent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import { hasHangul } from "../../utils/text";
import AuDetail from "./AuDetail";
import styles from "../EntryPage.module.css";

/** Tag vocabulary, matching what the AU records actually use. */
const FILTER_TAGS = [
  "현대",
  "시대극",
  "장르 기반",
  "NSFW",
  "고등학교",
  "대학교",
  "연예계",
] as const;

interface AuSectionProps {
  items: AuItem[];
  auPosts: AuPost[];
  loadingAuPostId: string | null;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
}

/**
 * The alternate-universe set, as a tab on the entry it belongs to.
 *
 * Rebuilt in the entry page's own layout language — bordered cards, index
 * numbers, inverted chips — replacing the standalone AU page it used to be.
 */
export default function AuSection({
  items,
  auPosts,
  loadingAuPostId,
  fetchAuContent,
}: AuSectionProps) {
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<AuItem | null>(null);

  const toggle = (tag: string) =>
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  // Only offer tags that some record actually carries.
  const available = useMemo(() => {
    const used = new Set(items.flatMap((i) => i.tags));
    return FILTER_TAGS.filter((t) => used.has(t));
  }, [items]);

  const visible = useMemo(() => {
    const base =
      tags.size === 0
        ? items
        : items.filter((i) => [...tags].every((t) => i.tags.includes(t)));
    // "main" universes first, otherwise source order
    return [...base].sort(
      (a, b) =>
        ((a.section ?? "main") === "main" ? 0 : 1) -
        ((b.section ?? "main") === "main" ? 0 : 1)
    );
  }, [items, tags]);

  if (items.length === 0) {
    return <p className={styles.empty}>등록된 AU가 없습니다</p>;
  }

  return (
    <>
      {available.length > 0 && (
        <div className={styles.chipRow}>
          <button
            type="button"
            className={`${styles.chip} ${styles.chipButton} ${tags.size ? styles.chipGhost : ""}`}
            onClick={() => setTags(new Set())}
          >
            ■ ALL {String(items.length).padStart(2, "0")}
          </button>
          {available.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.chip} ${styles.chipButton} ${tags.has(t) ? "" : styles.chipGhost}`}
              onClick={() => toggle(t)}
            >
              ■ {t}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className={styles.empty}>조건에 맞는 AU가 없습니다</p>
      ) : (
        <div className={styles.grid}>
          {visible.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={styles.card}
              onClick={() => setOpen(item)}
            >
              {item.imageUrl && (
                <span className={`${styles.portrait} ${styles.portraitAu}`}>
                  <img
                    src={publicUrl(item.imageUrl)}
                    alt=""
                    loading="lazy"
                    style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined}
                  />
                </span>
              )}
              <span className={styles.cardTop}>
                <span className={styles.cardNum}>{String(i + 1).padStart(8, "0")}</span>
                <span>↗</span>
              </span>
              <h3 className={`${styles.cardTitle} ${hasHangul(item.title) ? styles.titleCjk : ""}`}>
                {item.title}
              </h3>
              {item.description && (
                <p className={styles.cardPreview}>{item.description}</p>
              )}
              {item.tags.length > 0 && (
                <span className={styles.chips}>
                  {item.tags.slice(0, 3).map((t) => (
                    <span key={t} className={styles.chip}>■ {t}</span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <AuDetail
          item={open}
          posts={auPosts.filter((p) => p.auId === open.id)}
          loadingAuPostId={loadingAuPostId}
          fetchAuContent={fetchAuContent}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
