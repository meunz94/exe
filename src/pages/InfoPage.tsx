import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { publicUrl } from "../utils/publicUrl";
import styles from "./DocPage.module.css";

interface Neighbor {
  name: string;
  image: string;
  url: string;
  crop?: number;
  cropPosition?: number;
}

interface InfoPageProps {
  onBack: () => void;
}

/**
 * `info` — the notice/terms text that used to be the New User dialog, plus the
 * neighbour links that used to sit under Settings.
 *
 * Layout is deliberately provisional; this page gets its own design pass.
 */
export default function InfoPage({ onBack }: InfoPageProps) {
  const [notice, setNotice] = useState("불러오는 중...");
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(publicUrl("data/notice.md"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setNotice(text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""));
      })
      .catch(() => {
        if (!cancelled) setNotice("(공지를 불러올 수 없습니다.)");
      });

    fetch(publicUrl("data/neighbors.json"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setNeighbors(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page} data-dark-bg>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to desk
        </button>
        <span>Nº— / Info</span>
      </div>

      <h1 className={styles.title}>Info</h1>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span>Notice</span>
          <span>⬤</span>
        </div>
        <div className={styles.markdown}>
          <Markdown rehypePlugins={[rehypeRaw]}>{notice}</Markdown>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span>Neighbors</span>
          <span>{String(neighbors.length).padStart(2, "0")}</span>
        </div>

        {neighbors.length === 0 ? (
          <p className={styles.empty}>등록된 이웃이 없습니다.</p>
        ) : (
          <div className={styles.neighbors}>
            {neighbors.map((n, i) => (
              <a
                key={i}
                className={styles.neighbor}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.neighborFrame}>
                  {n.crop != null ? (
                    <span
                      className={styles.neighborCrop}
                      style={{ paddingBottom: `${n.crop}%` }}
                    >
                      <img
                        src={publicUrl(n.image)}
                        alt={n.name}
                        loading="lazy"
                        style={{
                          top: `${n.cropPosition ?? 50}%`,
                          transform: `translateY(-${n.cropPosition ?? 50}%)`,
                        }}
                      />
                    </span>
                  ) : (
                    <img src={publicUrl(n.image)} alt={n.name} loading="lazy" />
                  )}
                </span>
                {n.name && <span className={styles.neighborName}>{n.name}</span>}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
