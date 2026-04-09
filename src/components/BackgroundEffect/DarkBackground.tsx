import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "./useTheme";
import styles from "./DarkBackground.module.css";

interface Column {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  opacity: number;
  chars: string[];
  trailLen: number;
}

const HEX = "0123456789ABCDEF";
const COL_COUNT = 40;
const BASE_COLOR = "0, 170, 255";

function randomChar() {
  return HEX[Math.floor(Math.random() * HEX.length)];
}

function createColumns(w: number, h: number): Column[] {
  return Array.from({ length: COL_COUNT }, () => {
    const fontSize = 14 + Math.random() * 6;
    const trailLen = 8 + Math.floor(Math.random() * 14);
    return {
      x: Math.random() * w,
      y: -Math.random() * h,
      speed: 0.3 + Math.random() * 0.8,
      fontSize,
      opacity: 0.12 + Math.random() * 0.18,
      chars: Array.from({ length: trailLen }, randomChar),
      trailLen,
    };
  });
}

interface Props {
  active?: boolean;
}

export default function DarkBackground({ active = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef(0);
  const columnsRef = useRef<Column[]>([]);
  const theme = useTheme();
  const visible = active && theme === "dark";

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    columnsRef.current = createColumns(rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (!visible) return;

    resize();
    window.addEventListener("resize", resize);

    const canvas = canvasRef.current;
    if (!canvas) return;

    let tick = 0;

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.clearRect(0, 0, w, h);
      tick++;

      for (const col of columnsRef.current) {
        col.y += col.speed;

        if (tick % 6 === 0 && Math.random() < 0.3) {
          const idx = Math.floor(Math.random() * col.chars.length);
          col.chars[idx] = randomChar();
        }

        ctx.font = `${col.fontSize}px "Courier New", monospace`;

        for (let i = 0; i < col.chars.length; i++) {
          const charY = col.y - i * col.fontSize * 1.2;
          if (charY < -col.fontSize || charY > h + col.fontSize) continue;

          const fade = 1 - i / col.chars.length;
          let alpha: number;

          if (i === 0) {
            alpha = col.opacity * 2.5;
          } else {
            alpha = col.opacity * fade * fade;
          }

          if (alpha < 0.01) continue;

          if (i === 0) {
            ctx.shadowColor = `rgba(${BASE_COLOR}, ${alpha})`;
            ctx.shadowBlur = 8;
          } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
          }

          ctx.fillStyle = `rgba(${BASE_COLOR}, ${alpha})`;
          ctx.fillText(col.chars[i], col.x, charY);
        }

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        const totalHeight = col.chars.length * col.fontSize * 1.2;
        if (col.y - totalHeight > h) {
          col.y = -Math.random() * h * 0.5;
          col.x = Math.random() * w;
          col.speed = 0.3 + Math.random() * 0.8;
          col.opacity = 0.12 + Math.random() * 0.18;
        }
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId.current);
    };
  }, [visible, resize]);

  if (!visible) return null;

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
