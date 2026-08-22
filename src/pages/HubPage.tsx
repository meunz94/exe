import { Suspense, lazy, useState } from "react";
import { SECTION_TAGLINES, type HubSection } from "../types/screens";
import styles from "./HubPage.module.css";

const HubScene = lazy(() => import("../components/Hub/HubScene"));

interface HubPageProps {
  clock: string;
  onOpen: (section: HubSection) => void;
}

/**
 * The desk: five devices floating over a retro white/blue/black gradient.
 * All interaction lives in the 3D scene; this shell only frames it and
 * narrates the hovered device in the status bar.
 */
export default function HubPage({ clock, onOpen }: HubPageProps) {
  const [hovered, setHovered] = useState<HubSection | null>(null);

  return (
    <div className={styles.hub}>
      <div className={styles.canvas}>
        <Suspense fallback={<div className={styles.loading}>LOADING DEVICES...</div>}>
          <HubScene onPick={onOpen} onHover={setHovered} />
        </Suspense>
      </div>

      <header className={styles.top}>
        <span className={styles.logo}>LIMBIC SYSTEM®</span>
        <span className={styles.clock}>{clock}</span>
      </header>

      <footer className={styles.status} aria-live="polite">
        {hovered ? `▸ ${SECTION_TAGLINES[hovered]}` : "SELECT A DEVICE"}
      </footer>
    </div>
  );
}
