import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "./useTheme";
import styles from "./WaveBackground.module.css";

interface WaveDef {
  baseY: number;
  amplitude: number;
  frequency: number;
  speed: number;
  color: string;
  opacity: number;
  fillOpacity: number;
  lineWidth: number;
}

const WAVES: WaveDef[] = [
  {
    baseY: 0.72,
    amplitude: 0.05,
    frequency: 1.0,
    speed: 0.35,
    color: "80, 220, 60",
    opacity: 0.45,
    fillOpacity: 0.025,
    lineWidth: 2.8,
  },
  {
    baseY: 0.76,
    amplitude: 0.038,
    frequency: 1.5,
    speed: 0.5,
    color: "100, 240, 80",
    opacity: 0.35,
    fillOpacity: 0.018,
    lineWidth: 2.2,
  },
];

function drawWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wave: WaveDef,
  phase: number,
) {
  const midY = wave.baseY * h;
  const amp = wave.amplitude * h;
  const k = (wave.frequency * Math.PI * 2) / w;

  ctx.beginPath();

  for (let px = 0; px <= w; px += 2) {
    const y = midY + Math.sin(k * px - phase) * amp;
    if (px === 0) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }

  ctx.strokeStyle = `rgba(${wave.color}, ${wave.opacity})`;
  ctx.lineWidth = wave.lineWidth;
  ctx.stroke();

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = `rgba(${wave.color}, ${wave.fillOpacity})`;
  ctx.fill();
}

interface Props {
  active?: boolean;
}

export default function WaveBackground({ active = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef(0);
  const startTime = useRef(performance.now());
  const theme = useTheme();
  const visible = active && theme !== "dark";

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    if (!visible) return;

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

      ctx.clearRect(0, 0, w, h);

      for (const wave of WAVES) {
        const phase = t * wave.speed * Math.PI * 2;
        drawWave(ctx, w, h, wave, phase);
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
