import { useEffect } from "react";
import type { Agent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import styles from "./EntryDetail.module.css";

interface AgentDetailProps {
  agent: Agent;
  onClose: () => void;
}

/** Renders a key/value row, skipping blanks so sparse records stay tidy. */
function Spec({ label, children }: { label: string; children?: React.ReactNode }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div className={styles.spec}>
      <span className={styles.specKey}>{label}</span>
      <span className={styles.specVal}>{children}</span>
    </div>
  );
}

/**
 * Character dossier, replacing the old Win98 popup. Every field the data model
 * carries is surfaced here — profile, ability, appearance, TMI and relations.
 */
export default function AgentDetail({ agent, onClose }: AgentDetailProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("scrollLocked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("scrollLocked");
    };
  }, [onClose]);

  const d = agent.detail;
  const hero = d?.heroImageUrl || agent.imageUrl;

  return (
    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={agent.name}>
      <div className={styles.bar}>
        <button type="button" className={styles.close} onClick={onClose}>
          ← Close
        </button>
        <span className={styles.spacer} />
        <span className={styles.meta}>Profile / {agent.category}</span>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroArt}>
          {hero && <img src={publicUrl(hero)} alt="" />}
        </div>
        <div className={styles.heroText}>
          {d?.subtitle && <span className={styles.kicker}>{d.subtitle}</span>}
          <h1 className={styles.name}>{agent.name}</h1>
          {/* the data often repeats the name here; only show a real tagline */}
          {d?.title && d.title.trim().toLowerCase() !== agent.name.trim().toLowerCase() && (
            <p className={styles.tagline}>{d.title}</p>
          )}

          {(d?.descriptions?.length || agent.description?.length) && (
            <div className={styles.lede}>
              {(d?.descriptions ?? agent.description).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {d?.profile && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Profile</span>
              <span>01</span>
            </div>
            <div className={styles.specs}>
              <Spec label="Codename">{d.profile.codename}</Spec>
              <Spec label="Classification">{d.profile.classification}</Spec>
              <Spec label="Attribute">{d.profile.attribute}</Spec>
              <Spec label="Age & Nationality">{d.profile["age & nationality"]}</Spec>
              <Spec label="Evaluation">{d.profile.evaluation}</Spec>
            </div>
          </section>
        )}

        {d?.ability && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Ability</span>
              <span>02</span>
            </div>
            <div className={styles.specs}>
              <Spec label="Overview">{d.ability.overview}</Spec>
              {d.ability.skills?.length > 0 && (
                <Spec label="Skills">
                  <span className={styles.skills}>
                    {d.ability.skills.map((s) => (
                      <span key={s} className={styles.chip}>■ {s}</span>
                    ))}
                  </span>
                </Spec>
              )}
              <Spec label="Berserk Sign">{d.ability.berserkSign}</Spec>
            </div>
          </section>
        )}

        {d?.appearance && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Appearance</span>
              <span>03</span>
            </div>
            <div className={styles.specs}>
              <Spec label="Height & Build">{d.appearance["height & build"]}</Spec>
              <Spec label="Hair & Eyes">{d.appearance["hair & eyes"]}</Spec>
              <Spec label="Outfit">{d.appearance.outfit}</Spec>
            </div>
          </section>
        )}

        {d?.tmi && d.tmi.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>TMI</span>
              <span>{String(d.tmi.length).padStart(2, "0")}</span>
            </div>
            <div className={styles.specs}>
              {d.tmi.map((t) => (
                <Spec key={t.title} label={t.title}>{t.text}</Spec>
              ))}
            </div>
          </section>
        )}

        {d?.relations && d.relations.length > 0 && (
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <span>Relations</span>
              <span>{String(d.relations.length).padStart(2, "0")}</span>
            </div>
            <div className={styles.relations}>
              {d.relations.map((r) => (
                <div key={r.name} className={styles.relation}>
                  <span className={styles.relationName}>{r.name}</span>
                  <span className={styles.relationRole}>{r.relation}</span>
                  <p className={styles.relationText}>{r.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
