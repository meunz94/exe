import { useState } from "react";
import type { Agent, TimelineEvent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import AgentDetail from "./AgentDetail";
import styles from "../EntryPage.module.css";

interface ProfileSectionProps {
  agents: Agent[];
  timeline: TimelineEvent[];
}

/**
 * Cast and chronology.
 *
 * The timeline lives here rather than as its own tab — it's per-character
 * record material without the volume to carry a section of its own.
 */
export default function ProfileSection({ agents, timeline }: ProfileSectionProps) {
  const [open, setOpen] = useState<Agent | null>(null);

  const sorted = [...timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (agents.length === 0 && timeline.length === 0) {
    return <p className={styles.empty}>등록된 프로필이 없습니다</p>;
  }

  return (
    <>
      {agents.length > 0 && (
        <div className={styles.grid}>
          {agents.map((agent, i) => (
            <button
              key={agent.id}
              type="button"
              className={styles.card}
              onClick={() => setOpen(agent)}
            >
              {agent.imageUrl && (
                <span className={styles.portrait}>
                  <img src={publicUrl(agent.imageUrl)} alt="" loading="lazy" />
                </span>
              )}
              <span className={styles.cardTop}>
                <span className={styles.cardNum}>
                  {String(i + 1).padStart(8, "0")}
                </span>
                <span>↗</span>
              </span>
              <h3 className={styles.cardTitle}>{agent.name}</h3>
              {agent.detail?.subtitle && (
                <span className={styles.cardSub}>{agent.detail.subtitle}</span>
              )}
              {agent.detail?.profile?.classification && (
                <span className={styles.chips}>
                  <span className={styles.chip}>
                    ■ {agent.detail.profile.classification}
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div className={styles.block}>
          <div className={styles.blockHead}>
            <span>Timeline</span>
            <span>{String(sorted.length).padStart(2, "0")}</span>
          </div>
          <div className={styles.rows}>
            {sorted.map((e) => (
              <div key={e.id} className={styles.row}>
                <span className={styles.rowNum}>{e.date.slice(2, 10)}</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{e.title}</span>
                  <span className={styles.rowSub}>{e.description}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && <AgentDetail agent={open} onClose={() => setOpen(null)} />}
    </>
  );
}
