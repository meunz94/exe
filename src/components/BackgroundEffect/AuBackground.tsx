import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "./useTheme";
import styles from "./AuBackground.module.css";

/* ── Dark-mode orbs (canvas) ── */

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  color: string;
  phaseOffset: number;
  pulseSpeed: number;
}

const DARK_COLORS = [
  "rgba(120, 0, 255, 0.35)",
  "rgba(0, 200, 255, 0.30)",
  "rgba(180, 0, 220, 0.25)",
  "rgba(0, 255, 200, 0.20)",
  "rgba(60, 0, 180, 0.30)",
];

function createOrbs(w: number, h: number): Orb[] {
  return DARK_COLORS.map((color, i) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (0.12 + Math.random() * 0.2) * (i % 2 === 0 ? 1 : -1),
    vy: (0.08 + Math.random() * 0.15) * (i % 2 === 1 ? 1 : -1),
    baseRadius: Math.min(w, h) * (0.3 + Math.random() * 0.25),
    color,
    phaseOffset: Math.random() * Math.PI * 2,
    pulseSpeed: 0.3 + Math.random() * 0.4,
  }));
}

function DarkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef(0);
  const orbsRef = useRef<Orb[]>([]);
  const startTime = useRef(performance.now());

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    orbsRef.current = createOrbs(rect.width, rect.height);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animate = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const t = (performance.now() - startTime.current) / 1000;

      ctx.fillStyle = "#08060e";
      ctx.fillRect(0, 0, w, h);

      for (const orb of orbsRef.current) {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.baseRadius * 0.3) orb.vx = Math.abs(orb.vx);
        if (orb.x > w + orb.baseRadius * 0.3) orb.vx = -Math.abs(orb.vx);
        if (orb.y < -orb.baseRadius * 0.3) orb.vy = Math.abs(orb.vy);
        if (orb.y > h + orb.baseRadius * 0.3) orb.vy = -Math.abs(orb.vy);

        const pulse = 0.85 + 0.15 * Math.sin(t * orb.pulseSpeed + orb.phaseOffset);
        const r = orb.baseRadius * pulse;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r);
        grad.addColorStop(0, orb.color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId.current);
    };
  }, [resize]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}

/* ── Component ── */

export default function AuBackground() {
  const theme = useTheme();
  const isDark = theme === "dark";

  if (isDark) return <DarkCanvas />;
  return <div className={styles.backdrop} />;
}
