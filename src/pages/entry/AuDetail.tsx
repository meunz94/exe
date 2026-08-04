import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { AuItem, AuPost, AuPostWithContent } from "../../types";
import { publicUrl, displayDate } from "../../utils/publicUrl";
import { fixCjkEmphasis } from "../../utils/markdown";
import { hasHangul } from "../../utils/text";
import PostReader from "./PostReader";
import shared from "../EntryPage.module.css";
import styles from "./EntryDetail.module.css";

interface AuDetailProps {
  item: AuItem;
  posts: AuPost[];
  loadingAuPostId: string | null;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
  onClose: () => void;
}

/**
 * One alternate universe: premise, cast, exchanges, logs and gallery — in the
 * same full-bleed sheet the character dossier and post reader use.
 */
export default function AuDetail({
  item,
  posts,
  loadingAuPostId,
  fetchAuContent,
  onClose,
}: AuDetailProps) {
  const [post, setPost] = useState<AuPostWithContent | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape unwinds one layer at a time.
      if (lightbox !== null) setLightbox(null);
      else if (post) setPost(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("scrollLocked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("scrollLocked");
    };
  }, [onClose, post, lightbox]);

  const openPost = useCallback(
    async (p: AuPost) => setPost(await fetchAuContent(p)),
    [fetchAuContent]
  );

  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  const gallery = item.gallery ?? [];

  return (
    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className={styles.bar}>
        <button type="button" className={styles.close} onClick={onClose}>
          ← Close
        </button>
        <span className={styles.spacer} />
        <span className={styles.meta}>AU / {item.tags.join(" · ")}</span>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroArt}>
          {item.imageUrl && (
            <img
              src={publicUrl(item.imageUrl)}
              alt=""
              style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined}
            />
          )}
        </div>
        <div className={styles.heroText}>
          <span className={styles.kicker}>{item.section === "sub" ? "Sub" : "Main"} universe</span>
          <h1 className={`${styles.name} ${hasHangul(item.title) ? styles.titleCjk : ""}`}>
            {item.title}
          </h1>
          {item.description && (
            <div className={styles.lede}>
              <p>{item.description}</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {item.members.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Cast</span>
              <span>{String(item.members.length).padStart(2, "0")}</span>
            </div>
            <div className={styles.relations}>
              {item.members.map((m) => (
                <div key={m.name} className={styles.relation}>
                  {m.imageUrl && (
                    <span className={shared.portrait}>
                      <img src={publicUrl(m.imageUrl)} alt="" loading="lazy" />
                    </span>
                  )}
                  <span className={styles.relationName}>{m.name}</span>
                  <span className={styles.relationRole}>{m.role}</span>
                  {m.descriptions?.map((d, i) => (
                    <p key={i} className={styles.relationText}>{d}</p>
                  ))}
                  {m.note && <p className={styles.relationText}>{m.note}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {item.quotes && item.quotes.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Exchange</span>
              <span>{String(item.quotes.length).padStart(2, "0")}</span>
            </div>
            <div className={styles.specs}>
              {item.quotes.map((q, i) => (
                <div key={i} className={styles.spec}>
                  <span className={styles.specKey}>
                    {item.members[q.memberIndex]?.name ?? "—"}
                  </span>
                  <span className={styles.specVal}>{q.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {item.content && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Premise</span>
              <span>⬤</span>
            </div>
            <div className={styles.article} style={{ margin: 0, padding: 0 }}>
              <Markdown rehypePlugins={[rehypeRaw]}>{fixCjkEmphasis(item.content)}</Markdown>
            </div>
          </section>
        )}

        {sorted.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Logs</span>
              <span>{String(sorted.length).padStart(2, "0")}</span>
            </div>
            <div className={shared.rows}>
              {sorted.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${shared.row} ${shared.rowInteractive}`}
                  onClick={() => openPost(p)}
                  disabled={loadingAuPostId === p.id}
                >
                  <span className={shared.rowNum}>{String(sorted.length - i).padStart(3, "0")}</span>
                  <span className={shared.rowMain}>
                    <span className={shared.rowTitle}>{p.title}</span>
                    <span className={shared.rowSub}>
                      {displayDate(p.date)}
                      {p.preview ? ` · ${p.preview}` : ""}
                    </span>
                  </span>
                  <span className={shared.rowRight}>
                    {loadingAuPostId === p.id ? "..." : "↗"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Gallery</span>
              <span>{String(gallery.length).padStart(2, "0")}</span>
            </div>
            <div className={shared.tiles}>
              {gallery.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={shared.tile}
                  onClick={() => setLightbox(i)}
                  aria-label={img.caption ?? `이미지 ${i + 1}`}
                >
                  <img src={publicUrl(img.url)} alt="" loading="lazy" />
                  <span className={shared.tileNum}>{String(i + 1).padStart(3, "0")}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {lightbox !== null && gallery[lightbox] && (
        <div className={shared.lightbox} data-dark-bg onClick={() => setLightbox(null)}>
          <div className={shared.lbBar}>
            <button type="button" className={shared.back} onClick={() => setLightbox(null)}>
              ← Close
            </button>
            <span className={shared.barSpacer} />
            <span className={shared.barMeta}>
              {String(lightbox + 1).padStart(3, "0")} / {String(gallery.length).padStart(3, "0")}
            </span>
          </div>
          <div className={shared.lbStage} onClick={(e) => e.stopPropagation()}>
            <img src={publicUrl(gallery[lightbox].url)} alt={gallery[lightbox].caption ?? ""} />
            {gallery[lightbox].caption && (
              <p className={shared.lbCaption}>{gallery[lightbox].caption}</p>
            )}
          </div>
        </div>
      )}

      {post && (
        <PostReader
          post={{ ...post, author: "", category: "", boardId: "AU" }}
          onClose={() => setPost(null)}
        />
      )}
    </div>
  );
}
