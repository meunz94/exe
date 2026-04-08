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
                  <svg className={styles.placeholderIcon} viewBox="0 0 32 32" width="40" height="40" fill="none">
                    <path d="M16 28V16" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <path d="M16 16c0-7 7-12 12-8-2 5-7 8-12 8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M16 20c0-7-7-12-12-8 2 5 7 8 12 8z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
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
