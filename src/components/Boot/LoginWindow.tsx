import type { AuthUser } from "./BootScreen";
import vanceIcon from "../../assets/windows98-icons/png/key_win-0.png";
import guestIcon from "../../assets/windows98-icons/png/globe_map-0.png";
import styles from "./BootScreen.module.css";

interface UserEntry {
  id: AuthUser;
  icon: string;
  name: string;
  desc: string;
}

const USERS: UserEntry[] = [
  { id: "vance", icon: vanceIcon, name: "vance", desc: "Administrator" },
  { id: "guest", icon: guestIcon, name: "guest", desc: "Limited account" },
];

interface LoginWindowProps {
  selected: AuthUser;
  onSelect: (user: AuthUser) => void;
  onOk: () => void;
  onCancel: () => void;
  onNewUser: () => void;
  onSettings: () => void;
}

export default function LoginWindow({
  selected,
  onSelect,
  onOk,
  onCancel,
  onNewUser,
  onSettings,
}: LoginWindowProps) {
  return (
    <div className="window" style={{ width: 300 }}>
      <div className="title-bar">
        <div className="title-bar-text">Welcome</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onCancel} />
        </div>
      </div>

      <div className="window-body">
        <p style={{ marginBottom: 4 }}>Type a user name and password to log on.</p>

        <ul className={`sunken-panel ${styles.userList}`}>
          {USERS.map((u) => (
            <li
              key={u.id}
              role="button"
              className={`${styles.userRow} ${
                selected === u.id ? styles.userRowSelected : ""
              }`}
              onClick={() => onSelect(u.id)}
              onDoubleClick={onOk}
            >
              <img className={styles.userIcon} src={u.icon} alt="" />
              <span className={styles.userMeta}>
                <span className={styles.userName}>{u.name}</span>
                <span className={styles.userDesc}>{u.desc}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.fieldRow}>
          <label htmlFor="boot-password">Password:</label>
          <input
            id="boot-password"
            type="password"
            value="••••••"
            readOnly
          />
        </div>

        <div className={`${styles.buttonRow} ${styles.loginButtons}`}>
          <button className="default" onClick={onOk}>
            Ok
          </button>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onNewUser}>New User</button>
          <button onClick={onSettings}>Settings</button>
        </div>
      </div>
    </div>
  );
}
