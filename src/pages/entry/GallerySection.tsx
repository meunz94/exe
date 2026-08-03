import { useCallback, useEffect, useState } from "react";
import type { GalleryImage } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import styles from "../EntryPage.module.css";

interface GallerySectionProps {
  images: GalleryImage[];
}

export default function GallerySection({ images }: GallerySectionProps) {
  const [idx, setIdx] = useState<number | null>(null);

  const close = useCallback(() => setIdx(null), []);
  const step = useCallback(
    (d: number) => setIdx((i) => (i === null ? i : (i + d + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (images.length < 2) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("scrollLocked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("scrollLocked");
    };
  }, [idx, images.length, close, step]);

  if (images.length === 0) {
    return <p className={styles.empty}>등록된 이미지가 없습니다</p>;
  }

  const current = idx === null ? null : images[idx];

  return (
    <>
      <div className={styles.tiles}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className={styles.tile}
            onClick={() => setIdx(i)}
            aria-label={img.caption ?? `이미지 ${i + 1}`}
          >
            {/* thumbnails for the grid; the lightbox loads the full frame */}
            <img src={publicUrl(img.thumbUrl ?? img.url)} alt="" loading="lazy" />
            <span className={styles.tileNum}>{String(i + 1).padStart(3, "0")}</span>
          </button>
        ))}
      </div>

      {current && (
        <div className={styles.lightbox} data-dark-bg onClick={close}>
          <div className={styles.lbBar}>
            <button type="button" className={styles.back} onClick={close}>
              ← Close
            </button>
            <span className={styles.barSpacer} />
            <span className={styles.barMeta}>
              {String((idx ?? 0) + 1).padStart(3, "0")} / {String(images.length).padStart(3, "0")}
            </span>
          </div>

          <div className={styles.lbStage} onClick={(e) => e.stopPropagation()}>
            <img src={publicUrl(current.url)} alt={current.caption ?? ""} />
            {current.caption && <p className={styles.lbCaption}>{current.caption}</p>}
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.lbNav} ${styles.lbPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="이전"
              >
                ←
              </button>
              <button
                type="button"
                className={`${styles.lbNav} ${styles.lbNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="다음"
              >
                →
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
