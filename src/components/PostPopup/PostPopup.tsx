import { useEffect, useCallback, useRef, useLayoutEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PostWithContent } from "../../types";
import { publicUrl } from "../../utils/publicUrl";
import { fixCjkEmphasis } from "../../utils/markdown";
import styles from "./PostPopup.module.css";

interface PostPopupProps {
  post: PostWithContent;
  onClose: () => void;
}

function parseColor(color: string): [number, number, number] | null {
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  if (color.startsWith("rgb")) {
    const m = color.match(/(\d+)/g);
    if (!m || m.length < 3) return null;
    return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])];
  }
  return null;
}

function boostColorLightness(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  l = l + (1 - l) * 0.5;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p2 = 2 * l - q2;
    r2 = hue2rgb(p2, q2, h + 1 / 3);
    g2 = hue2rgb(p2, q2, h);
    b2 = hue2rgb(p2, q2, h - 1 / 3);
  }

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

export default function PostPopup({ post, onClose }: PostPopupProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const elements = bodyRef.current.querySelectorAll<HTMLElement>("[style]");
    elements.forEach((el) => {
      const inlineColor = el.style.color;
      if (!inlineColor) return;
      if (isDark) {
        if (!el.dataset.originalColor) el.dataset.originalColor = inlineColor;
        el.style.color = boostColorLightness(el.dataset.originalColor);
      } else if (el.dataset.originalColor) {
        el.style.color = el.dataset.originalColor;
        delete el.dataset.originalColor;
      }
    });
  }, [isDark, post.content]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleScrollClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const heroSrc = post.imageUrl ? publicUrl(post.imageUrl) : null;

  return (
    <div className={styles.overlay} data-dark-bg onClick={handleOverlayClick}>
      <div className={styles.scrollArea} onClick={handleScrollClick}>
        <div className={styles.popup} data-light-bg>
          {heroSrc && (
            <div className={styles.heroImage}>
              <img src={heroSrc} alt="" />
            </div>
          )}

          <div className={styles.header}>
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
            <span className={styles.date}>{post.date}</span>
            <h2 className={styles.title}>{post.title}</h2>
          </div>

          <div ref={bodyRef} className={styles.body}>
            <Markdown rehypePlugins={[rehypeRaw]}>
              {fixCjkEmphasis(post.content.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
