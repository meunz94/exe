import type { SidebarItem } from "../../types";
import { useRevealOnScroll } from "../../hooks/useSplitReveal";
import { titleLines } from "../../utils/text";
import styles from "../../pages/LandingPage.module.css";

/**
 * Colour-inversion classes, cycled so consecutive sections always differ.
 * These are global class names from `styles/tokens.css` (imported by index.css),
 * not CSS-module locals — hence the bare strings.
 */
const TONES = ["sectionDefault", "sectionGreen", "sectionBlue"] as const;

interface EntrySectionProps {
  item: SidebarItem;
  index: number;
  counts: { label: string; value: string }[];
  onEnter: (item: SidebarItem) => void;
}

/**
 * One numbered landing section per top-level entry. Renders the entry's
 * romanised title as display type and its Korean synopsis as body copy — the
 * condensed display face has no Hangul glyphs, so the two never mix.
 */
export default function EntrySection({ item, index, counts, onEnter }: EntrySectionProps) {
  const tone = TONES[index % TONES.length];
  const number = String(index + 1).padStart(3, "0");
  const synopsisRef = useRevealOnScroll<HTMLParagraphElement>(
    styles.entrySynopsisRevealed
  );

  // Green is the light fill of the pair, so it needs the dark-on-light cursors.
  const isLightTone = tone === "sectionGreen";

  return (
    <section
      className={`${styles.section} ${tone}`}
      {...(isLightTone ? { "data-light-bg": "" } : { "data-dark-bg": "" })}
    >
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <span>
            Nº{number} / {item.label}
          </span>
          <span className={styles.bullet}>⬤</span>
        </div>

        <h2 className={styles.entryTitle}>
          {titleLines(item.label).map((line) => (
            <span key={line} className={styles.entryTitleLine}>
              {line}
            </span>
          ))}
        </h2>

        <div className={styles.entryBody}>
          <p className={styles.entrySynopsis} ref={synopsisRef}>
            {item.synopsis}
          </p>

          <div className={styles.entryAside}>
            {counts.map((c) => (
              <div className={styles.entryAsideRow} key={c.label}>
                <span>{c.label}</span>
                <span>{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className={styles.enter} onClick={() => onEnter(item)}>
          <span className={styles.enterLabel}>Enter</span>
          <span className={styles.enterArrow}>↗</span>
        </button>
      </div>
    </section>
  );
}
