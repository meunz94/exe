import { useEffect, useState, useCallback } from "react";
import LoginWindow from "./LoginWindow";
import NewUserDialog from "./NewUserDialog";
import SettingsDialog from "./SettingsDialog";
import MemoDialog from "./MemoDialog";
import NeighborsDialog from "./NeighborsDialog";
import { useWin98Styles } from "./useWin98Styles";
import styles from "./BootScreen.module.css";

export type AuthUser = "vance" | "guest";

type WinId = "newUser" | "settings" | "memo" | "neighbors";

interface BootScreenProps {
  onLogin: (user: AuthUser) => void;
}

export default function BootScreen({ onLogin }: BootScreenProps) {
  const [selected, setSelected] = useState<AuthUser>("vance");
  const [stack, setStack] = useState<WinId[]>([]);

  const open = useCallback(
    (id: WinId) => setStack((s) => [...s.filter((w) => w !== id), id]),
    []
  );
  const close = useCallback(
    (id: WinId) => setStack((s) => s.filter((w) => w !== id)),
    []
  );

  // Scope 98.css + retro cursors to the boot subtree only.
  useWin98Styles();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setStack((s) => s.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.stage} data-win98-root>
      <div className={styles.mac}>
        <div className={styles.bezel}>
          <div className={styles.screen}>
            <div className={styles.desktop}>
              <LoginWindow
                selected={selected}
                onSelect={setSelected}
                onOk={() => onLogin(selected)}
                onCancel={() => setSelected("vance")}
                onNewUser={() => open("newUser")}
                onSettings={() => open("settings")}
              />
            </div>
          </div>
        </div>

        <div className={styles.chin}>
          <span className={styles.brandGroup}>
            <span className={styles.rainbow} />
            <span className={styles.brand}>Macintosh</span>
          </span>
          <span className={styles.slot} />
        </div>
      </div>

      {/* windows overlay the whole stage (not the small CRT) so they never clip;
          each stacks above the previous with a small cascade offset */}
      {stack.length > 0 && (
        <div className={styles.modalLayer}>
          {stack.map((id, i) => (
            <div
              key={id}
              className={styles.windowSlot}
              style={{ transform: `translate(calc(-50% + ${i * 18}px), calc(-50% + ${i * 18}px))` }}
            >
              {id === "newUser" && <NewUserDialog onClose={() => close("newUser")} />}
              {id === "settings" && (
                <SettingsDialog
                  onOpenMemo={() => open("memo")}
                  onOpenNeighbors={() => open("neighbors")}
                  onClose={() => close("settings")}
                />
              )}
              {id === "memo" && <MemoDialog onClose={() => close("memo")} />}
              {id === "neighbors" && <NeighborsDialog onClose={() => close("neighbors")} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
