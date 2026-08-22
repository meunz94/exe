import { useEffect } from "react";
import labelImg from "../assets/label.png";
import styles from "./EntryScreen.module.css";

interface EntryScreenProps {
  onEnter: () => void;
}

/**
 * First contact: a dark room with the archive's warning label stuck in the
 * middle. Clicking the label boots the machine (blue load flood → hub).
 */
export default function EntryScreen({ onEnter }: EntryScreenProps) {
  // The label is the only thing on screen, so use the idle time to warm up
  // the heavy hub chunk (three.js + models) behind it.
  useEffect(() => {
    import("../components/Hub/HubScene");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  return (
    <div className={styles.entry}>
      <button type="button" className={styles.label} onClick={onEnter}>
        <img src={labelImg} alt="Limbic System — click to boot" draggable={false} />
      </button>
    </div>
  );
}
