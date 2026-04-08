import type { TimelineEvent } from "../../types";
import styles from "./Timeline.module.css";

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>TIMELINE</h3>
      <div className={styles.timeline}>
        {sorted.map((event, idx) => (
          <div
            key={event.id}
            className={styles.event}
          >
            <div className={styles.marker}>
              <span className={styles.dot} />
              {idx < sorted.length - 1 && <span className={styles.line} />}
            </div>
            <div className={styles.content}>
              <span className={styles.date}>{event.date}</span>
              <span className={styles.title}>{event.title}</span>
              <p className={styles.desc}>{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
