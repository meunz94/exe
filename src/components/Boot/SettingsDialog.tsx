import { publicUrl } from "../../utils/publicUrl";
import styles from "./BootScreen.module.css";

interface SettingsDialogProps {
  onOpenMemo: () => void;
  onOpenNeighbors: () => void;
  onClose: () => void;
}

interface IconEntry {
  icon: string;
  label: string;
  onOpen: () => void;
}

export default function SettingsDialog({
  onOpenMemo,
  onOpenNeighbors,
  onClose,
}: SettingsDialogProps) {
  const icons: IconEntry[] = [
    { icon: publicUrl("icons/notepad_file_gear-2.png"), label: "Prompt", onOpen: onOpenMemo },
    { icon: publicUrl("icons/network_internet_pcs_installer-2.png"), label: "Neighbors", onOpen: onOpenNeighbors },
  ];

  return (
    <div className={`window ${styles.dialog}`} style={{ maxWidth: 320 }}>
      <div className="title-bar">
        <div className="title-bar-text">Settings</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body">
        <p className={styles.dialogText} style={{ marginBottom: 8 }}>
          아이콘을 더블클릭하세요.
        </p>
        <div className={`sunken-panel ${styles.iconGrid}`}>
          {icons.map((it) => (
            <div
              key={it.label}
              role="button"
              tabIndex={0}
              className={styles.iconItem}
              onDoubleClick={it.onOpen}
              onKeyDown={(e) => {
                if (e.key === "Enter") it.onOpen();
              }}
            >
              <img className={styles.iconImg} src={it.icon} alt="" />
              <span className={styles.iconLabel}>{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
