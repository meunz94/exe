import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./TerminalFlood.module.css";

/** One printed row. `tag` renders right-aligned behind a dotted leader. */
export interface FloodLine {
  text?: string;
  tag?: string;
  /** dotted rule between text and tag */
  leader?: boolean;
  dim?: boolean;
  big?: boolean;
  hr?: boolean;
  /** extra pause after this line, ms */
  pause?: number;
}

export interface FloodHead {
  left: [string, string][];
  right: [string, string][];
}

interface TerminalFloodProps {
  skin: "amber" | "green";
  head: FloodHead;
  lines: FloodLine[];
  /** ms between lines */
  speed?: number;
  /** ms to hold the completed screen before handing off */
  hold?: number;
  onDone: () => void;
}

/**
 * Prints a terminal readout line by line, then calls `onDone`.
 *
 * Used as the transition between screens: the readout floods the viewport,
 * fills, holds for a beat, and the caller swaps the page underneath it.
 * Clicking (or any key) skips straight to the end.
 */
export default function TerminalFlood({
  skin,
  head,
  lines,
  speed = 90,
  hold = 550,
  onDone,
}: TerminalFloodProps) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimers();
    setLeaving(true);
    timers.current.push(window.setTimeout(onDone, 300));
  }, [clearTimers, onDone]);

  const skip = useCallback(() => {
    clearTimers();
    setShown(lines.length);
    finish();
  }, [clearTimers, lines.length, finish]);

  // Schedule every line up front rather than chaining timeouts: the total
  // duration is then deterministic, which keeps the transition predictable.
  useEffect(() => {
    let at = 0;
    lines.forEach((line, i) => {
      at += speed + (line.pause ?? 0);
      timers.current.push(window.setTimeout(() => setShown(i + 1), at));
    });
    timers.current.push(window.setTimeout(finish, at + hold));

    return clearTimers;
  }, [lines, speed, hold, finish, clearTimers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  // Keep the newest line in view on short viewports.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const visible = lines.slice(0, shown);
  const done = shown >= lines.length;

  return (
    <div
      className={`${styles.flood} ${styles[skin]} ${leaving ? styles.leaving : ""}`}
      onClick={skip}
      role="status"
      aria-live="polite"
    >
      <div className={styles.head}>
        <div className={styles.headCol}>
          {head.left.map(([k, v]) => (
            <span key={k}>
              {k} : <span className={styles.headVal}>{v}</span>
            </span>
          ))}
        </div>
        <div className={`${styles.headCol} ${styles.headRight}`}>
          {head.right.map(([k, v]) => (
            <span key={k}>
              {k} : <span className={styles.headVal}>{v}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {visible.map((line, i) =>
          line.hr ? (
            <div key={i} className={styles.hr} />
          ) : (
            <div
              key={i}
              className={`${styles.line} ${line.big ? styles.big : ""}`}
            >
              <span className={`${styles.lineText} ${line.dim ? styles.dim : ""}`}>
                {line.text}
              </span>
              {line.leader && <span className={styles.rule} />}
              {line.tag && <span className={styles.tag}>[{line.tag}]</span>}
            </div>
          )
        )}
        {!done && <span className={styles.caret} />}
      </div>

      <button type="button" className={styles.skip} onClick={skip}>
        Skip
      </button>
    </div>
  );
}
