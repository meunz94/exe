import type { AppData } from "../../types";
import { SECTIONS, useSectionCounts, type SectionDef } from "./sections";
import styles from "./Win98Desktop.module.css";

interface FolderWindowProps {
  data: AppData;
  category: string;
  onOpenSection: (section: SectionDef) => void;
}

/**
 * The contents of a category "folder" — one icon per non-empty section.
 * Double-clicking an icon opens that section's component in its own window.
 */
export default function FolderWindow({ data, category, onOpenSection }: FolderWindowProps) {
  const counts = useSectionCounts(data, category);
  const items = SECTIONS.filter((s) => counts[s.key] > 0);

  return (
    <div className={styles.folderGrid}>
      {items.map((s) => (
        <div
          key={s.key}
          role="button"
          tabIndex={0}
          className={styles.folderItem}
          onDoubleClick={() => onOpenSection(s)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpenSection(s);
          }}
        >
          <img src={s.icon} alt="" className={styles.folderIcon} />
          <span className={styles.folderLabel}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
