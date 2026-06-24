import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import styles from "./Win98Window.module.css";

interface Win98WindowProps {
  title: string;
  icon?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}

export default function Win98Window({
  title,
  icon,
  x,
  y,
  z,
  width = 560,
  active,
  onFocus,
  onClose,
  onMinimize,
  onMove,
  children,
}: Win98WindowProps) {
  const [maximized, setMaximized] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onTitlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onFocus();
      if (maximized) return;
      // ignore drags that start on the control buttons
      if ((e.target as HTMLElement).closest("button")) return;
      dragRef.current = { dx: e.clientX - x, dy: e.clientY - y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [maximized, onFocus, x, y]
  );

  const onTitlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const nx = Math.max(0, e.clientX - dragRef.current.dx);
      const ny = Math.max(0, e.clientY - dragRef.current.dy);
      onMove(nx, ny);
    },
    [onMove]
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  }, []);

  const style = maximized
    ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: z }
    : { left: x, top: y, width, zIndex: z };

  return (
    <div
      className={`window ${styles.window} ${maximized ? styles.maximized : ""}`}
      style={style}
      onPointerDown={onFocus}
    >
      <div
        className={`title-bar ${active ? "" : "inactive"} ${styles.titleBar}`}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onDoubleClick={() => setMaximized((m) => !m)}
      >
        <div className={`title-bar-text ${styles.titleText}`}>
          {icon && <img src={icon} alt="" className={styles.titleIcon} />}
          {title}
        </div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={onMinimize} />
          <button aria-label="Maximize" onClick={() => setMaximized((m) => !m)} />
          <button aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className={`window-body ${styles.body}`}>{children}</div>
    </div>
  );
}
