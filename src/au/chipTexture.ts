import * as THREE from "three";
import { publicUrl } from "../lib/url";

/**
 * Cartridge-label and box-cover textures. Each starts as a generated mock
 * and is replaced automatically when the real art exists:
 *   label — 노션 `라벨` 파일 (정사각 1024×1024)
 *   box   — public/images/boxes/<id>.webp (또는 .png, 세로 ≈1:1.09)
 */

const LABEL_CACHE = new Map<string, THREE.CanvasTexture>();
const BOX_CACHE = new Map<string, THREE.CanvasTexture>();

export interface ChipStyle {
  id: string;
  title: string;
  /** 노션에서 내려온 라벨·박스아트 경로 (있으면 저장소 파일보다 우선) */
  label?: string;
  box?: string;
}

/** 라벨·박스아트에 찍히는 브랜드명 — 페어 이름으로 바꿔 쓴다 */
let BRAND = "LIMBIC";
export function setChipBrand(name: string) {
  const first = name.trim().split(/\s+/)[0] || "LIMBIC";
  if (first !== BRAND) {
    BRAND = first.toUpperCase();
    LABEL_CACHE.clear();
    BOX_CACHE.clear();
  }
}

/** 라벨·박스아트 상단 띠 색 */
const BAND = "#0a0a0a";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = [...text];
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function barcode(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#0a0a0a";
  let cx = x;
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  while (cx < x + w) {
    const bw = 3 + ((seed = (seed * 137 + 71) % 9973) % 8);
    if (seed % 3 !== 0) ctx.fillRect(cx, y, bw, h);
    cx += bw + 4;
  }
}

/** Replaces the mock with the first of `urls` that actually loads. */
function overrideWhenReal(
  ctx: CanvasRenderingContext2D,
  texture: THREE.CanvasTexture,
  urls: string[],
  w: number,
  h: number
) {
  const [url, ...rest] = urls;
  if (!url) return;
  const img = new Image();
  img.onload = () => {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    texture.needsUpdate = true;
  };
  img.onerror = () => overrideWhenReal(ctx, texture, rest, w, h);
  img.src = publicUrl(url);
}

export function chipLabelTexture(chip: ChipStyle): THREE.CanvasTexture {
  const cached = LABEL_CACHE.get(chip.id);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // paper
  ctx.fillStyle = "#f4f2ea";
  ctx.fillRect(0, 0, size, size);

  // band
  ctx.fillStyle = BAND;
  ctx.fillRect(0, 0, size, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px 'Galmuri11', monospace";
  ctx.fillText(`${BRAND} AU`, 28, 60);

  // title
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "700 44px 'Galmuri11', sans-serif";
  wrapText(ctx, chip.title, size - 72).forEach((line, i) => ctx.fillText(line, 32, 186 + i * 58));

  barcode(ctx, chip.id, 32, size - 110, size - 72, 70);
  ctx.font = "600 20px 'Galmuri11', monospace";
  ctx.fillText(chip.id.toUpperCase().padStart(8, "0"), 32, size - 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  LABEL_CACHE.set(chip.id, texture);
  // webp 를 먼저 — 원본 PNG(4K) 는 저장소에 두지 않는다
  overrideWhenReal(
    ctx,
    texture,
    [chip.label ?? "", `images/chips/${chip.id}.webp`, `images/chips/${chip.id}.png`].filter(Boolean),
    size,
    size
  );
  return texture;
}

/** DS-case front cover, mocked in the style of retail box art. */
export function boxArtTexture(chip: ChipStyle): THREE.CanvasTexture {
  const cached = BOX_CACHE.get(chip.id);
  if (cached) return cached;

  const w = 512;
  const h = 558;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // cover ground + platform band across the top, like retail packaging
  ctx.fillStyle = "#eceadf";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = BAND;
  ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px 'Galmuri11', sans-serif";
  ctx.fillText(`${BRAND}:DS`, 20, 44);

  // key art placeholder: halftone-ish diagonal stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(24, 92, w - 48, 300);
  ctx.clip();
  ctx.fillStyle = "rgba(26, 46, 200, 0.09)";
  for (let i = -20; i < 40; i++) {
    ctx.fillRect(i * 26, 92, 12, 300);
  }
  ctx.restore();
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 92, w - 48, 300);

  // title over the art
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "700 40px 'Galmuri11', sans-serif";
  wrapText(ctx, chip.title, w - 110).forEach((line, i) => ctx.fillText(line, 44, 170 + i * 54));

  ctx.font = "400 20px 'Galmuri11', monospace";
  ctx.fillStyle = "rgba(10, 10, 10, 0.6)";
  ctx.fillText("ALTERNATE UNIVERSE", 44, 360);

  // bottom strip: rating box + barcode
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(24, h - 120, 84, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px 'Galmuri11', sans-serif";
  ctx.fillText("M", 52, h - 55);
  barcode(ctx, chip.id, 132, h - 112, 240, 66);
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "600 18px 'Galmuri11', monospace";
  ctx.fillText(chip.id.toUpperCase().padStart(8, "0"), 132, h - 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  BOX_CACHE.set(chip.id, texture);
  // no box art? fall back to the chip's label art before the generated mock
  overrideWhenReal(
    ctx,
    texture,
    [
      chip.box ?? "",
      `images/boxes/${chip.id}.webp`,
      `images/boxes/${chip.id}.png`,
      chip.label ?? "",
      `images/chips/${chip.id}.webp`,
      `images/chips/${chip.id}.png`,
    ].filter(Boolean),
    w,
    h
  );
  return texture;
}
