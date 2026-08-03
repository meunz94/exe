import styles from "./CRTOverlay.module.css";

/**
 * Global CRT treatment: film grain, scanlines, a defocus haze and a tube
 * vignette. Mount once near the root — every layer is `position: fixed` and
 * `pointer-events: none`, so it tints the whole app without intercepting
 * input or participating in layout.
 */
export default function CRTOverlay() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.noise} />
      <div className={styles.scanlines} />
      <div className={styles.gloom} />
      <div className={styles.vignette} />
    </div>
  );
}
