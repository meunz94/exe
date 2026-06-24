import { useEffect, useState } from "react";
import { publicUrl } from "../../utils/publicUrl";
import styles from "./BootScreen.module.css";

interface Neighbor {
  name: string;
  image: string;
  url: string;
  crop?: number;
  cropPosition?: number;
}

interface NeighborsDialogProps {
  onClose: () => void;
}

export default function NeighborsDialog({ onClose }: NeighborsDialogProps) {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);

  useEffect(() => {
    let cancelled = false;
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
    <div className={`window ${styles.dialog}`} style={{ maxWidth: 360 }}>
      <div className="title-bar">
        <div className="title-bar-text">Neighbors</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body">
        <div className={styles.dialogBody}>
          {neighbors.length > 0 ? (
            <div className={styles.neighborsGrid}>
              {neighbors.map((n, i) => (
                <a
                  key={i}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.neighborItem}
                >
                  {n.crop != null ? (
                    <div
                      className={styles.neighborImgCrop}
                      style={{ paddingBottom: `${n.crop}%` }}
                    >
                      <img
                        src={publicUrl(n.image)}
                        alt={n.name}
                        className={styles.neighborImgCropped}
                        style={{
                          top: `${n.cropPosition ?? 50}%`,
                          transform: `translateY(-${n.cropPosition ?? 50}%)`,
                        }}
                      />
                    </div>
                  ) : (
                    <img
                      src={publicUrl(n.image)}
                      alt={n.name}
                      className={styles.neighborImg}
                    />
                  )}
                  {n.name && <span className={styles.neighborName}>{n.name}</span>}
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.dialogText}>등록된 이웃이 없습니다.</p>
          )}
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
