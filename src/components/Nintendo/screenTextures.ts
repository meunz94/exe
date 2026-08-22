import * as THREE from "three";
import type { ChipContent, DsTab } from "../../types/nintendo";

/**
 * The DS's two screens are canvases redrawn on demand: the bottom screen is
 * the touch menu, the top screen renders the active tab. Drawn at 2× the
 * DS's native ratio so the top screen stays crisp when the camera zooms
 * into it.
 */

export const TABS: { id: DsTab; label: string }[] = [
  { id: "profile", label: "프로필" },
  { id: "logs", label: "로그" },
  { id: "gallery", label: "갤러리" },
];

const W = 512;
const H = 384;
const SCALE = 2;

export interface ScreenHandle {
  texture: THREE.CanvasTexture;
  /** redraw; cheap enough to call on every state change */
  draw: () => void;
}

export interface TopScreenHandle extends ScreenHandle {
  /** scroll the content area; clamped, triggers a redraw */
  scrollBy: (dy: number) => void;
  resetScroll: () => void;
  /** the backing canvas — mountable straight into the DOM for the zoom view */
  canvas: HTMLCanvasElement;
}

function makeScreen(): {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
} {
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { ctx, texture, canvas };
}

/* --- bottom: touch menu ---------------------------------------------------- */

/** Menu rows as fractions of screen height — mirrored by the UV hit test. */
export const MENU_TOP = 0.24;
export const MENU_ROW = 0.19;

export function bottomScreen(getTab: () => DsTab): ScreenHandle {
  const { ctx, texture } = makeScreen();

  const draw = () => {
    const active = getTab();
    ctx.fillStyle = "#cdd6c9"; // DS LCD sage
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#3a4438";
    ctx.font = "600 22px 'Galmuri11', monospace";
    ctx.fillText("SELECT MODE", 26, 50);
    ctx.fillRect(26, 62, W - 52, 2);

    TABS.forEach((tab, i) => {
      const y = (MENU_TOP + i * MENU_ROW) * H;
      const h = MENU_ROW * H - 10;
      const isActive = tab.id === active;
      ctx.fillStyle = isActive ? "#2438c8" : "rgba(58, 68, 56, 0.14)";
      ctx.fillRect(26, y, W - 52, h);
      ctx.fillStyle = isActive ? "#ffffff" : "#3a4438";
      ctx.font = "600 28px 'Galmuri11', sans-serif";
      ctx.fillText(`${isActive ? "▶ " : "  "}${tab.label}`, 44, y + h / 2 + 10);
    });

    ctx.fillStyle = "rgba(58, 68, 56, 0.55)";
    ctx.font = "400 17px 'Galmuri11', monospace";
    ctx.fillText("십자키: 이동 · A/터치: 보기 · B: 뒤로", 26, H - 20);

    texture.needsUpdate = true;
  };

  return { texture, draw };
}

/** Maps a UV hit on the bottom screen to a tab, or null on dead space. */
export function tabFromUv(uv: THREE.Vector2): DsTab | null {
  const v = 1 - uv.y; // canvas y grows downward
  for (let i = 0; i < TABS.length; i++) {
    const top = MENU_TOP + i * MENU_ROW;
    if (v >= top && v <= top + MENU_ROW - 10 / H) return TABS[i].id;
  }
  return null;
}

/* --- top: tab content -------------------------------------------------------- */

export function topScreen(getState: () => { tab: DsTab; content: ChipContent | null }): TopScreenHandle {
  const { ctx, texture, canvas } = makeScreen();
  // Async image draws re-trigger; cache elements per url.
  const images = new Map<string, HTMLImageElement>();

  const image = (url: string, onReady: () => void): HTMLImageElement | null => {
    const found = images.get(url);
    if (found) return found.complete && found.naturalWidth > 0 ? found : null;
    const el = new Image();
    el.src = url;
    el.onload = onReady;
    images.set(url, el);
    return null;
  };

  let scroll = 0;
  let maxScroll = 0;

  /** opaque header band drawn over the scrolled content */
  const header = (title: string) => {
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, W, 58);
    ctx.fillStyle = "#8fa8ff";
    ctx.font = "600 20px 'Galmuri11', monospace";
    ctx.fillText(title, 24, 40);
    ctx.fillRect(24, 52, W - 48, 2);
    if (maxScroll > 0) {
      // slim scrollbar so the reader knows there's more
      ctx.fillStyle = "rgba(143, 168, 255, 0.25)";
      ctx.fillRect(W - 10, 62, 4, H - 74);
      const barH = Math.max(28, (H - 74) * ((H - 70) / (H - 70 + maxScroll)));
      const barY = 62 + ((H - 74 - barH) * scroll) / (maxScroll || 1);
      ctx.fillStyle = "#8fa8ff";
      ctx.fillRect(W - 10, barY, 4, barH);
    }
  };

  const wrap = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
    let line = "";
    let cy = y;
    let count = 0;
    for (const ch of [...text]) {
      if (ch === "\n" || (ctx.measureText(line + ch).width > maxWidth && line)) {
        ctx.fillText(line, x, cy);
        line = ch === "\n" || ch === " " ? "" : ch;
        cy += lineHeight;
        if (++count >= maxLines) return;
      } else {
        line += ch;
      }
    }
    if (line && count < maxLines) ctx.fillText(line, x, cy);
  };

  const cover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
  };

  const draw = () => {
    const { tab, content } = getState();
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, W, H);
    if (!content) {
      maxScroll = 0;
      header("NO CARTRIDGE");
      texture.needsUpdate = true;
      return;
    }

    let contentBottom = 0;
    ctx.save();
    ctx.translate(0, -scroll);

    if (tab === "profile") {
      content.profiles.forEach((p, i) => {
        const x = 24 + (i % 2) * ((W - 48) / 2 + 8);
        const w = (W - 48) / 2 - 8;
        const rowY = 70 + Math.floor(i / 2) * 330;
        const img = p.image ? image(p.image, draw) : null;
        if (img) cover(img, x, rowY, w, 176);
        else {
          ctx.fillStyle = "rgba(143, 168, 255, 0.15)";
          ctx.fillRect(x, rowY, w, 176);
        }
        ctx.fillStyle = "#e8ecff";
        ctx.font = "600 21px 'Galmuri11', sans-serif";
        ctx.fillText(p.name.slice(0, 13), x, rowY + 204);
        ctx.fillStyle = "rgba(232, 236, 255, 0.65)";
        ctx.font = "400 15px 'Galmuri11', sans-serif";
        wrap(p.lines.join(" ") || "", x, rowY + 230, w, 22, 4);
        contentBottom = Math.max(contentBottom, rowY + 320);
      });
      if (content.profiles.length === 0) {
        ctx.fillStyle = "rgba(232, 236, 255, 0.5)";
        ctx.font = "400 18px 'Galmuri11', sans-serif";
        ctx.fillText("등록된 프로필이 없습니다.", 24, 92);
        contentBottom = 100;
      }
    }

    if (tab === "logs") {
      ctx.font = "400 18px 'Galmuri11', sans-serif";
      content.logs.forEach((log, i) => {
        const y = 92 + i * 36;
        ctx.fillStyle = "#8fa8ff";
        ctx.fillText(String(i + 1).padStart(2, "0"), 24, y);
        ctx.fillStyle = "#e8ecff";
        ctx.fillText(log.title.slice(0, 22), 62, y);
        if (log.date) {
          ctx.fillStyle = "rgba(232, 236, 255, 0.45)";
          ctx.fillText(log.date.split("T")[0], W - 130, y);
        }
        contentBottom = y + 16;
      });
      if (content.logs.length === 0) {
        ctx.fillStyle = "rgba(232, 236, 255, 0.5)";
        ctx.fillText("기록이 없습니다.", 24, 92);
        contentBottom = 100;
      }
    }

    if (tab === "gallery") {
      content.gallery.forEach((url, i) => {
        const x = 24 + (i % 3) * ((W - 48) / 3 + 2);
        const y = 70 + Math.floor(i / 3) * 144;
        const img = image(url, draw);
        if (img) cover(img, x, y, (W - 48) / 3 - 6, 136);
        else {
          ctx.fillStyle = "rgba(143, 168, 255, 0.12)";
          ctx.fillRect(x, y, (W - 48) / 3 - 6, 136);
        }
        contentBottom = y + 144;
      });
      if (content.gallery.length === 0) {
        ctx.fillStyle = "rgba(232, 236, 255, 0.5)";
        ctx.font = "400 18px 'Galmuri11', sans-serif";
        ctx.fillText("이미지가 없습니다.", 24, 92);
        contentBottom = 100;
      }
    }

    ctx.restore();
    maxScroll = Math.max(0, contentBottom - (H - 16));

    const title =
      tab === "profile"
        ? "PROFILE"
        : tab === "logs"
          ? `LOGS — ${content.logs.length}`
          : `GALLERY — ${content.gallery.length}`;
    header(title);
    texture.needsUpdate = true;
  };

  return {
    texture,
    canvas,
    draw,
    scrollBy: (dy: number) => {
      const next = Math.max(0, Math.min(maxScroll, scroll + dy));
      if (next === scroll) return;
      scroll = next;
      draw();
    },
    resetScroll: () => {
      scroll = 0;
    },
  };
}
