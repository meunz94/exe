import { useRevealOnScroll } from "../../hooks/useSplitReveal";
import styles from "./Marquee.module.css";

interface MarqueeProps {
  /** Repeated phrase, e.g. "LIMBIC SYSTEM". */
  text: string;
  /** How many copies fill one group. Needs to overflow the viewport width. */
  repeat?: number;
  /** Seconds for one full loop. Larger = slower. */
  duration?: number;
  reverse?: boolean;
  /** Smaller type for secondary banners. */
  small?: boolean;
}

/**
 * Seamless scrolling banner. Renders two identical groups and translates the
 * track by -50%, so when the animation restarts the second group is already
 * sitting exactly where the first was — no jump, no measurement needed.
 */
export default function Marquee({
  text,
  repeat = 6,
  duration = 24,
  reverse = false,
  small = false,
}: MarqueeProps) {
  const ref = useRevealOnScroll<HTMLDivElement>(styles.revealed, 0.05);
  const items = Array.from({ length: repeat });

  const group = (key: string) => (
    <div className={styles.group} key={key}>
      {items.map((_, i) => (
        <span className={styles.item} key={i}>
          <span className={styles.symbol}>●</span>
          {text}
        </span>
      ))}
    </div>
  );

  return (
    <div
      ref={ref}
      className={`${styles.marquee} ${small ? styles.small : ""}`}
      data-direction={reverse ? "reverse" : "forward"}
      style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.track}>
        {group("a")}
        {group("b")}
      </div>
    </div>
  );
}
