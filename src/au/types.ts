import type { AuChip, AuMember } from "../lib/types";
import { publicUrl } from "../lib/url";

/** 카트리지 하나 (라벨·케이스 텍스처가 읽는 최소 정보) */
export interface Chip {
  id: string;
  title: string;
  description: string;
}

export type DsTab = "profile" | "gallery";

export interface ChipContent {
  profiles: { name: string; image?: string; lines: string[] }[];
  synopsis: string;
  gallery: string[];
  bg?: string;
}

export function contentFor(chip: AuChip): ChipContent {
  return {
    profiles: chip.members.map((m: AuMember) => ({
      name: m.name,
      image: m.image ? publicUrl(m.image) : undefined,
      lines: m.lines.filter(Boolean),
    })),
    synopsis: chip.synopsis || chip.description,
    gallery: chip.gallery.slice(0, 12).map(publicUrl),
    bg: chip.bg ? publicUrl(chip.bg) : undefined,
  };
}
