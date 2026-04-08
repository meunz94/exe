import { useState, useCallback } from "react";
import type { PortfolioItem } from "../types";
import PortfolioPopup from "../components/PortfolioPopup/PortfolioPopup";
import { publicUrl } from "../utils/publicUrl";
import styles from "./PortfolioPage.module.css";

interface PortfolioPageProps {
  items: PortfolioItem[];
  onBack: () => void;
}

export default function PortfolioPage({ items, onBack }: PortfolioPageProps) {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  const handleCardClick = useCallback((item: PortfolioItem) => {
    setSelectedItem(item);
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← BACK
        </button>
        <h1 className={styles.title}>ANOTHER UNIVERSE</h1>
        <p className={styles.subtitle}>Archive of Memory Fragment</p>
      </header>

      <div className={styles.gallery}>
        {items.map((item) => (
          <div
            key={item.id}
            className={styles.card}
            onClick={() => handleCardClick(item)}
          >
            <div className={styles.cardImage}>
              {item.imageUrl ? (
                <img src={publicUrl(item.imageUrl)} alt={item.title} />
              ) : (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderIcon}>◆</span>
                </div>
              )}
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardDesc}>{item.description}</p>
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className={styles.empty}>
          아직 등록된 포트폴리오가 없습니다.
        </div>
      )}

      {selectedItem && (
        <PortfolioPopup item={selectedItem} onClose={handlePopupClose} />
      )}
    </div>
  );
}
