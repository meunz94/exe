import { useEffect, useCallback } from "react";
import type { Agent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import styles from "./Popup.module.css";

interface PopupProps {
  agent: Agent;
  onClose: () => void;
}

const ATTR_MAP: Record<string, string> = {
  "풀": styles.attrGrass,
  "얼음": styles.attrIce,
  "번개": styles.attrElectric,
};

function getAttrClass(attribute: string) {
  for (const key of Object.keys(ATTR_MAP)) {
    if (attribute.includes(key)) return ATTR_MAP[key];
  }
  return "";
}

export default function Popup({ agent, onClose }: PopupProps) {
  const { detail } = agent;
  const { profile, ability, appearance, tmi, relations } = detail;
  const attrCls = getAttrClass(profile.attribute);

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
            <div
              className={styles.heroBackground}
              style={
                detail.heroImageUrl
                  ? { backgroundImage: `url(${publicUrl(detail.heroImageUrl)})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : undefined
              }
            />
            <div className={styles.heroGradient} />
            <button className={styles.closeButton} onClick={onClose}>✕</button>
            <div className={styles.heroContent}>
              <span className={`${styles.subtitleTag} ${attrCls}`}>{detail.subtitle}</span>
              <h2 className={styles.title}>{detail.title}</h2>
              <div className={styles.descriptions}>
                {detail.descriptions.map((desc, i) => (
                  <p key={i} className={styles.descriptionLine}>{desc}</p>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.dossier} data-light-bg>
            {/* SECTION 1: PROFILE */}
            <section className={styles.section}>
              <h3 className={styles.sectionHeader}>PROFILE</h3>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>CODENAME</span>
                  <span className={styles.fieldValue}>{profile.codename}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>CLASSIFICATION</span>
                  <span className={styles.fieldValue}>{profile.classification}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>ATTRIBUTE</span>
                  <span className={styles.fieldValue}>{profile.attribute}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>AGE / NATIONALITY</span>
                  <span className={styles.fieldValue}>{profile["age & nationality"]}</span>
                </div>
              </div>
              <div className={styles.evalBox}>
                <span className={styles.fieldLabel}>OFFICIAL EVALUATION</span>
                <p className={styles.evalText}>{profile.evaluation}</p>
              </div>
            </section>

            {/* SECTION 2: ABILITY */}
            <section className={styles.section}>
              <h3 className={styles.sectionHeader}>ABILITY</h3>
              <p className={styles.abilityOverview}>{ability.overview}</p>
              <div className={styles.skillsList}>
                {ability.skills.map((skill, i) => (
                  <div key={i} className={styles.skillItem}>
                    <span className={styles.skillBullet}>▸</span>
                    <span className={styles.skillText}>{skill}</span>
                  </div>
                ))}
              </div>
              {ability.berserkSign && (
                <div className={styles.berserkBox}>
                  <span className={styles.berserkLabel}>⚠ 폭주 징후</span>
                  <p className={styles.berserkText}>{ability.berserkSign}</p>
                </div>
              )}
            </section>

            {/* SECTION 3: APPEARANCE */}
            <section className={styles.section}>
              <h3 className={styles.sectionHeader}>APPEARANCE</h3>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>HEIGHT / BUILD</span>
                  <span className={styles.fieldValue}>{appearance["height & build"]}</span>
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>HAIR / EYES</span>
                  <span className={styles.fieldValue}>{appearance["hair & eyes"]}</span>
                </div>
                <div className={styles.fieldFull}>
                  <span className={styles.fieldLabel}>OUTFIT</span>
                  <span className={styles.fieldValue}>{appearance.outfit}</span>
                </div>
              </div>
            </section>

            {/* SECTION 4: TMI */}
            {tmi && tmi.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionHeader}>TMI</h3>
                <div className={styles.tmiList}>
                  {tmi.map((item, i) => (
                    <div key={i} className={styles.tmiItem}>
                      <span className={styles.tmiTitle}>{item.title}</span>
                      <p className={styles.tmiText}>{item.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 5: RELATIONS */}
            <section className={styles.section}>
              <h3 className={styles.sectionHeader}>RELATIONSHIP</h3>
              <div className={styles.relationsList}>
                {relations.map((rel, i) => (
                  <div key={i} className={styles.relationCard}>
                    <div className={styles.relationTop}>
                      <span className={styles.relationName}>{rel.name}</span>
                      <span className={styles.relationTag}>{rel.relation}</span>
                    </div>
                    <p className={styles.relationDesc}>{rel.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
