import type { DisciplinaryRecord } from "../../types";
import styles from "./Terminal.module.css";

interface TerminalProps {
  records: DisciplinaryRecord[];
}

function levelClass(level: string) {
  switch (level) {
    case "CRITICAL":
      return styles.critical;
    case "WARNING":
      return styles.warning;
    default:
      return styles.notice;
  }
}

export default function Terminal({ records }: TerminalProps) {
  if (records.length === 0) return null;

  return (
    <div className={styles.window}>
      <div className={styles.glitchLayer}>
        <div className={styles.titleBar}>
          <span className={styles.titleIcon}>▸</span>
          <span className={styles.titleText}>DISCIPLINARY_LOG.sh</span>
          <div className={styles.titleButtons}>
            <span className={styles.btn}>─</span>
            <span className={styles.btn}>□</span>
            <span className={styles.btn}>✕</span>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.output}>
            {records.map((rec) => (
              <div key={rec.id} className={styles.record}>
                <div className={styles.recordHeader}>
                  <span className={`${styles.level} ${levelClass(rec.level)}`}>
                    [{rec.level}]
                  </span>
                  <span className={styles.recordDate}>{rec.date}</span>
                </div>
                <div className={styles.recordBody}>
                  <span className={styles.recordSubject}>{rec.subject}</span>
                  <span className={styles.recordReason}>{rec.reason}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.prompt}>
            <span className={styles.promptUser}>root@dr-vance</span>
            <span className={styles.promptSep}>:</span>
            <span className={styles.promptPath}>~/disciplinary</span>
            <span className={styles.promptChar}>$</span>
            <span className={styles.cursor}>▌</span>
          </div>
        </div>
      </div>
    </div>
  );
}
