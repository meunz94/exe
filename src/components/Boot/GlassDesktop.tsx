import { publicUrl } from "../../utils/publicUrl";
import PixelHeart from "./PixelHeart";
import styles from "./GlassDesktop.module.css";

export type GlassTarget = "info" | "love" | "prompt";

interface GlassDesktopProps {
  onOpen: (target: GlassTarget) => void;
}

/**
 * What's on screen once the machine is warm: a bare wallpaper and three icons.
 *
 * Replaces the old account-picker dialog. `info` and `prompt` are documents;
 * `love` is the way in to the site itself.
 */
export default function GlassDesktop({ onOpen }: GlassDesktopProps) {
  return (
    <div className={styles.desktop}>
      <div className={styles.wallpaper} />

      <div className={styles.icons}>
        <button
          type="button"
          className={styles.icon}
          onClick={() => onOpen("info")}
          aria-label="info 열기"
        >
          <span className={styles.glyph}>
            <img
              className={styles.glyphImg}
              src={publicUrl("icons/network_internet_pcs_installer-2.png")}
              alt=""
            />
          </span>
          <span className={styles.label}>info</span>
        </button>

        <button
          type="button"
          className={styles.icon}
          onClick={() => onOpen("love")}
          aria-label="사이트 입장"
        >
          <span className={`${styles.glyph} ${styles.heartGlyph}`}>
            <span className={styles.heartSpin}>
              <PixelHeart />
            </span>
          </span>
          <span className={styles.label}>LOVE</span>
        </button>

        <button
          type="button"
          className={styles.icon}
          onClick={() => onOpen("prompt")}
          aria-label="prompt 열기"
        >
          <span className={styles.glyph}>
            <img
              className={styles.glyphImg}
              src={publicUrl("icons/notepad_file_gear-2.png")}
              alt=""
            />
          </span>
          <span className={styles.label}>prompt</span>
        </button>
      </div>
    </div>
  );
}
