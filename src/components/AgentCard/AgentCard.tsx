import { useRef, useState, useCallback, useMemo } from "react";
import type { Agent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import AgentCard3D from "./AgentCard3D";
import styles from "./AgentCard.module.css";

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const result: number[] = [];
    for (let i = 0; i < 28; i++) {
      hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
      result.push(hash % 3 === 0 ? 2 : 1);
    }
    return result;
  }, [seed]);

  return (
    <div className={styles.barcode}>
      {bars.map((w, i) => (
        <span
          key={i}
          className={styles.bar}
          style={{ height: `${w === 2 ? 3 : 1.5}px` }}
        />
      ))}
    </div>
  );
}

const ATTR_MAP: Record<string, { cls: string; icon: string }> = {
  "풀": { cls: styles.attrGrass, icon: "🌿" },
  "얼음": { cls: styles.attrIce, icon: "❄️" },
  "번개": { cls: styles.attrElectric, icon: "⚡" },
};

function getAttrStyle(attribute: string) {
  for (const key of Object.keys(ATTR_MAP)) {
    if (attribute.includes(key)) return ATTR_MAP[key];
  }
  return { cls: "", icon: "" };
}

export default function AgentCard({ agent, onClick }: AgentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const agentIdNum = agent.id.startsWith("vance") ? "1223" : "0904";

  const attr = getAttrStyle(agent.detail.profile.attribute);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotation({ x: y * 12, y: -x * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotation({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  return (
    <div
      ref={cardRef}
      className={styles.cardWrapper}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={() => onClick(agent)}
      style={{
        transform: `perspective(800px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${isHovered ? 1.02 : 1})`,
      }}
    >
      <div className={styles.card}>
        <div className={styles.badgeHeader}>
          <div className={styles.orgBlock}>
            <span className={styles.orgLabel}>ARCH</span>
            <span className={styles.orgSlogan}>AEGIS OF MANKIND</span>
          </div>
          <span className={`${styles.clearance} ${attr.cls}`}>S-CLASS</span>
        </div>

        <div className={styles.badgeBody}>
          <div className={styles.photoColumn}>
            <div className={styles.canvasArea}>
              {agent.imageUrl ? (
                <img
                  className={styles.photo}
                  src={publicUrl(agent.imageUrl)}
                  alt={agent.name}
                />
              ) : (
                <AgentCard3D rotationX={rotation.x} rotationY={rotation.y} />
              )}
            </div>
          </div>
          <Barcode seed={agent.id + agent.name} />
        </div>

        <div className={styles.chipRow}>
          <div className={styles.chip}>
            <div className={styles.chipLines} />
          </div>
          <span className={styles.idNumber}>ID S-{agentIdNum}</span>
        </div>

        <div className={styles.dividerLine} />

        <div className={styles.info}>
          <h3 className={styles.name}>{agent.name}</h3>
          {agent.description.map((desc, i) => (
            <p key={i} className={styles.description}>
              {desc}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
