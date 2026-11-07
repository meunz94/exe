import { useEffect, useState } from "react";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { pad2 } from "../lib/format";
import { pairPath, useSite } from "../lib/site";
import type { GalleryItem } from "../lib/types";
import { publicUrl } from "../lib/url";

/** § 07 Gallery — 그림 격자. 누르면 크게 본다 */
export function Gallery() {
  const { pair } = useSite();
  useTitle(`Gallery — ${pair.name}`);
  const items = useJson<GalleryItem[]>(pairPath(pair, "gallery.json"), []);
  const [open, setOpen] = useState<number | null>(null);
  const cur = open !== null ? items[open] : null;

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? null : Math.min(items.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? null : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, items.length]);

  return (
    <div className="page gallery">
      <Header />
      <div className="ga-wrap">
        <div className="ga-head">
          <div className="tl-head-text">
            <h1 className="page-title">
              Gallery<sup>[{pad2(items.length)}]</sup>
            </h1>
          </div>
        </div>
        <div className="ga-grid">
          {items.map((g, i) => (
            <button key={g.id} type="button" className="ga-card" onClick={() => setOpen(i)} aria-label={`${g.title} 크게 보기`}>
              <span className="ga-thumb">
                {g.image ? <img src={publicUrl(g.image)} alt="" loading="lazy" /> : <span className="mono muted">[이미지]</span>}
                {/* 제목은 호버했을 때만 — 사진이 흐려지며 그 위에 뜬다 */}
                <span className="ga-cap">
                  <span className="ga-title">{g.title}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        {items.length === 0 ? <p className="muted center-note">아직 등록된 그림이 없어요.</p> : null}
      </div>

      {cur ? (
        <div className="ga-view" role="dialog" aria-label={cur.title} onClick={() => setOpen(null)}>
          <div className="ga-view-head" onClick={(e) => e.stopPropagation()}>
            <span className="mono muted">
              {pad2((open ?? 0) + 1)} / {pad2(items.length)}
            </span>
            <button type="button" className="ga-close display" onClick={() => setOpen(null)}>
              Close <span>×</span>
            </button>
          </div>
          <figure className="ga-view-fig" onClick={(e) => e.stopPropagation()}>
            {cur.image ? <img src={publicUrl(cur.image)} alt={cur.title} /> : null}
            <figcaption>
              <span className="ga-view-title display">{cur.title}</span>
              {cur.caption ? <span className="muted ga-view-cap">{cur.caption}</span> : null}
            </figcaption>
          </figure>
          <div className="ga-view-nav" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mono" disabled={open === 0} onClick={() => setOpen((i) => Math.max(0, (i ?? 0) - 1))}>
              ← PREV
            </button>
            <button type="button" className="mono" disabled={open === items.length - 1} onClick={() => setOpen((i) => Math.min(items.length - 1, (i ?? 0) + 1))}>
              NEXT →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
