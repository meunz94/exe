import { useEffect, useCallback } from "react";
import type { PortfolioItem } from "../../types";
import styles from "./PortfolioPopup.module.css";

interface PortfolioPopupProps {
  item: PortfolioItem;
  onClose: () => void;
}

export default function PortfolioPopup({ item, onClose }: PortfolioPopupProps) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleScrollAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className={styles.overlay} data-dark-bg onClick={handleOverlayClick}>
      <div className={styles.popupScroll} onClick={handleScrollAreaClick}>
        <div className={styles.popup}>
          <div className={styles.hero} data-dark-bg>
            <div className={styles.heroBackground} />
            <div className={styles.heroGradient} />
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
            <div className={styles.heroContent}>
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <h2 className={styles.title}>{item.title}</h2>
              <p className={styles.subtitle}>{item.description}</p>
            </div>
          </div>

          <div className={styles.membersSection} data-light-bg>
            <h3 className={styles.sectionTitle}>PROFILE</h3>
            <div className={styles.membersList}>
              {item.members.map((member, idx) => (
                <div key={idx} className={styles.memberCard}>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberRole}>{member.role}</span>
                    <span className={styles.memberName}>{member.name}</span>
                    <div className={styles.memberDescs}>
                      {member.descriptions.map((desc, i) => (
                        <p key={i} className={styles.memberDesc}>{desc}</p>
                      ))}
                    </div>
                  </div>
                  {member.note && (
                    <div className={styles.memberNote}>
                      <p className={styles.memberNoteText}>{member.note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.contentSection}>
            <h3 className={styles.sectionTitle}>ABOUT</h3>
            <p className={styles.content}>{item.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
