import { useState, useCallback, useEffect } from "react";
import type { GalleryImage } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import styles from "./Gallery.module.css";

interface GalleryProps {
  images: GalleryImage[];
}

export default function Gallery({ images }: GalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (images.length > 1) {
        if (e.key === "ArrowLeft") setLightboxIdx((i) => (i! - 1 + images.length) % images.length);
        if (e.key === "ArrowRight") setLightboxIdx((i) => (i! + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIdx, images.length]);

  const closeLightbox = useCallback(() => setLightboxIdx(null), []);

  if (images.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>GALLERY</h3>
      <div className={styles.masonry}>
        {images.map((img, idx) => (
          <div
            key={img.id}
            className={styles.thumb}
            onClick={() => setLightboxIdx(idx)}
          >
            <img src={publicUrl(img.url)} alt={img.caption ?? ""} loading="lazy" />
          </div>
        ))}
      </div>

      {lightboxIdx !== null && images[lightboxIdx] && (
        <div className={styles.lightbox} data-dark-bg onClick={closeLightbox}>
          {images.length > 1 && (
            <button
              className={styles.lbPrev}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((i) => (i! - 1 + images.length) % images.length);
              }}
            >
              ‹
            </button>
          )}
          <div className={styles.lbCenter} onClick={(e) => e.stopPropagation()}>
            <img
              src={publicUrl(images[lightboxIdx].url)}
              alt={images[lightboxIdx].caption ?? ""}
              className={styles.lbImage}
            />
            {images[lightboxIdx].caption && (
              <p className={styles.lbCaption}>{images[lightboxIdx].caption}</p>
            )}
            <span className={styles.lbCounter}>
              {lightboxIdx + 1} / {images.length}
            </span>
          </div>
          {images.length > 1 && (
            <button
              className={styles.lbNext}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx((i) => (i! + 1) % images.length);
              }}
            >
              ›
            </button>
          )}
          <button className={styles.lbClose} onClick={closeLightbox}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
