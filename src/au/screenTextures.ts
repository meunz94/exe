import * as THREE from "three";
import type { ChipContent, DsTab } from "./types";

/**
 * The DS's two screens are canvases redrawn on demand: the bottom screen is
 * the touch menu, the top screen renders the active tab. Drawn at 2× the
 * DS's native ratio so the top screen stays crisp when the camera zooms
 * into it.
 *
 * 그림 규칙은 사이트 디자인 시스템을 따른다 — 흰 종이 바탕, Archivo 디스플레이 제목,
 * IBM Plex Mono 라벨, Pretendard 본문, 페어 강조색 점.
 */

export const TABS: { id: DsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "gallery", label: "Gallery" },
];

const W = 512;
const H = 384;
const SCALE = 2;

/* 사이트 토큰(라이트) — DS 화면은 테마와 무관하게 종이처럼 밝게 그린다 */
const PAPER = "#ffffff";
const INK = "#23242a";
const MUTED = "#515462";
const FAINT = "#8f93a3";
const FILL = "#eceef1";
const HAIR = "rgba(35, 36, 42, 0.12)";
const LINE = "rgba(35, 36, 42, 0.4)";
let ACCENT = "#1821cf";

const DISPLAY = (size: number, weight = 700) => `${weight} ${size}px "Archivo", "Pretendard Variable", sans-serif`;
const MONO = (size: number, weight = 400) => `${weight} ${size}px "IBM Plex Mono", ui-monospace, monospace`;
const SANS = (size: number, weight = 400) => `${weight} ${size}px "Pretendard Variable", "IBM Plex Sans KR", system-ui, sans-serif`;

const redraws = new Set<() => void>();
/** 페어 강조색 — AuChips 가 페어에 맞춰 호출한다 */
export function setScreenAccent(color: string) {
  if (color && color !== ACCENT) {
    ACCENT = color;
    redraws.forEach((d) => d());
  }
}
// 웹폰트가 늦게 오면 기본 글꼴로 먼저 그려지므로, 로드가 끝나면 한 번 더 그린다
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.ready.then(() => redraws.forEach((d) => d()));
}

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

function letterSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x - spacing;
}

/* --- bottom: touch menu ---------------------------------------------------- */

/** Menu rows as fractions of screen height — mirrored by the UV hit test. */
export const MENU_TOP = 0.09;
export const MENU_ROW = 0.41;

export function bottomScreen(getTab: () => DsTab): ScreenHandle {
  const { ctx, texture } = makeScreen();

  const draw = () => {
    const active = getTab();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // 블록 두 장 — 랜딩의 LATEST 상자처럼, 현재 항목은 강조색 채움 + 흰 글자, 나머지는 종이 + 1px 선.
    // 왼쪽 위 번호(모노), 오른쪽 위 한글 라벨, 왼쪽 아래 큰 제목(디스플레이).
    TABS.forEach((tab, i) => {
      const x = 26;
      const y = (MENU_TOP + i * MENU_ROW) * H;
      const w = W - 52;
      const h = MENU_ROW * H - 10;
      const isActive = tab.id === active;
      if (isActive) {
        ctx.fillStyle = ACCENT;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
      const fg = isActive ? "#ffffff" : INK;
      const sub = isActive ? "rgba(255,255,255,0.7)" : MUTED;
      ctx.fillStyle = sub;
      ctx.font = MONO(11);
      ctx.fillText(String(i + 1).padStart(2, "0"), x + 16, y + 26);
      ctx.textAlign = "right";
      ctx.fillText(tab.id === "profile" ? "프로필" : "갤러리", x + w - 16, y + 26);
      ctx.textAlign = "left";
      ctx.fillStyle = fg;
      ctx.font = DISPLAY(46, 600);
      letterSpaced(ctx, tab.label.toUpperCase(), x + 14, y + h - 18, -1.4);
      if (isActive) {
        // 오른쪽 아래 화살표 — 사이트 카드의 → 와 같은 역할
        ctx.font = MONO(18);
        ctx.textAlign = "right";
        ctx.fillText("→", x + w - 16, y + h - 20);
        ctx.textAlign = "left";
      }
    });

    texture.needsUpdate = true;
  };

  redraws.add(draw);
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

const HEAD = 58;

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

  /** 스크롤된 내용 위에 덮는 머리글 — 사이트 섹션 헤더처럼 제목 + 개수 + 가는 선 */
  const header = (title: string, count?: number) => {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, HEAD);
    ctx.fillStyle = INK;
    ctx.font = DISPLAY(22, 600);
    const w = letterSpaced(ctx, title.toUpperCase(), 24, 38, -0.4);
    if (count != null) {
      ctx.fillStyle = MUTED;
      ctx.font = MONO(11);
      ctx.fillText(`[${String(count).padStart(2, "0")}]`, 24 + w + 8, 26);
    }
    ctx.fillStyle = LINE;
    ctx.fillRect(24, HEAD - 6, W - 48, 1);
    if (maxScroll > 0) {
      // 가는 스크롤바
      ctx.fillStyle = HAIR;
      ctx.fillRect(W - 9, HEAD + 6, 2, H - HEAD - 18);
      const track = H - HEAD - 18;
      const barH = Math.max(28, track * ((H - HEAD) / (H - HEAD + maxScroll)));
      const barY = HEAD + 6 + ((track - barH) * scroll) / (maxScroll || 1);
      ctx.fillStyle = INK;
      ctx.fillRect(W - 9, barY, 2, barH);
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

  /** 사이트의 이미지 자리표시(연한 채움 + 모노 라벨) */
  const placeholder = (x: number, y: number, w: number, h: number, label: string) => {
    ctx.fillStyle = FILL;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = FAINT;
    ctx.font = MONO(10);
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y + h / 2 + 4);
    ctx.textAlign = "left";
  };

  const empty = (text: string) => {
    ctx.fillStyle = FAINT;
    ctx.font = SANS(14);
    ctx.fillText(text, 24, HEAD + 40);
  };

  const draw = () => {
    const { tab, content } = getState();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (!content) {
      maxScroll = 0;
      header("No cartridge");
      texture.needsUpdate = true;
      return;
    }

    let contentBottom = 0;
    ctx.save();
    ctx.translate(0, -scroll);

    if (tab === "profile") {
      // 프로필 페이지의 미니 카드처럼: 사진 · 이름(디스플레이) · 한 줄들(본문)
      content.profiles.forEach((p, i) => {
        const x = 24 + (i % 2) * ((W - 48) / 2 + 8);
        const w = (W - 48) / 2 - 8;
        const rowY = HEAD + 14 + Math.floor(i / 2) * 320;
        const img = p.image ? image(p.image, draw) : null;
        if (img) cover(img, x, rowY, w, 176);
        else placeholder(x, rowY, w, 176, "[IMAGE]");
        ctx.fillStyle = FAINT;
        ctx.font = MONO(10);
        ctx.fillText(String(i + 1).padStart(2, "0"), x, rowY + 196);
        ctx.fillStyle = INK;
        ctx.font = DISPLAY(19, 600);
        ctx.fillText(p.name.slice(0, 14), x + 22, rowY + 197);
        ctx.fillStyle = MUTED;
        ctx.font = SANS(13);
        wrap(p.lines.join(" ") || "", x, rowY + 222, w, 21, 4);
        contentBottom = Math.max(contentBottom, rowY + 310);
      });
      if (content.profiles.length === 0) {
        empty("등록된 프로필이 없습니다.");
        contentBottom = 100;
      }
    }

    if (tab === "gallery") {
      content.gallery.forEach((url, i) => {
        const cw = (W - 48 - 12) / 3;
        const x = 24 + (i % 3) * (cw + 6);
        const y = HEAD + 14 + Math.floor(i / 3) * (cw + 6);
        const img = image(url, draw);
        if (img) cover(img, x, y, cw, cw);
        else placeholder(x, y, cw, cw, "[IMG]");
        contentBottom = y + cw + 6;
      });
      if (content.gallery.length === 0) {
        empty("이미지가 없습니다.");
        contentBottom = 100;
      }
    }

    ctx.restore();
    maxScroll = Math.max(0, contentBottom - (H - 16));

    if (tab === "profile") header("Profile", content.profiles.length);
    else header("Gallery", content.gallery.length);
    texture.needsUpdate = true;
  };

  redraws.add(draw);
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
