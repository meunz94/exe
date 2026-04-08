import type { SidebarItem } from "../../types";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  items: SidebarItem[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  visible?: boolean;
}

export default function Sidebar({
  items,
  activeCategory,
  onCategoryChange,
  visible = true,
}: SidebarProps) {
  return (
    <nav
      className={styles.sidebar}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? undefined : "translateX(20px)",
      }}
    >
      {items.map((item) => {
        const isActive = item.category === activeCategory;

        return (
          <button
            key={item.id}
            className={isActive ? styles.itemActive : styles.item}
            onClick={() => onCategoryChange(item.category)}
          >
            <span
              className={isActive ? styles.dotVisible : styles.dot}
            />
            <span className={isActive ? styles.label : styles.labelMuted}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
