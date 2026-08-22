import type { AppData } from "./index";
import { publicUrl } from "../utils/publicUrl";

/** One cartridge on the carousel. */
export interface Chip {
  id: string;
  title: string;
  kind: "series" | "au-main" | "au-sub";
  description: string;
}

/** Tabs on the DS touch menu — the synopsis lives in the floating popup. */
export type DsTab = "profile" | "logs" | "gallery";

/** Everything the DS shows for one inserted chip. */
export interface ChipContent {
  profiles: { name: string; image?: string; lines: string[] }[];
  synopsis: string;
  logs: { title: string; date?: string }[];
  gallery: string[];
  /** detail-mode backdrop */
  bg?: string;
}

export function chipsFrom(data: AppData): Chip[] {
  return [
    ...data.sidebarItems.map<Chip>((item) => ({
      id: item.id,
      title: item.label,
      kind: "series",
      description: item.synopsis ?? "",
    })),
    ...data.au.map<Chip>((au) => ({
      id: au.id,
      title: au.title,
      kind: au.section === "main" ? "au-main" : "au-sub",
      description: au.description,
    })),
  ];
}

export function contentFor(chip: Chip, data: AppData): ChipContent {
  if (chip.kind === "series") {
    const item = data.sidebarItems.find((s) => s.id === chip.id);
    const category = item?.category ?? "";
    const agents = data.agents.filter((a) => a.category === category);
    return {
      profiles: agents.map((a) => ({
        name: a.name,
        image: a.imageUrl ? publicUrl(a.imageUrl) : undefined,
        lines: a.description,
      })),
      synopsis: item?.synopsis ?? "",
      // 로그는 시리즈·AU 모두 '칩 게시글' 에서 칩 ID 로 갈린다.
      logs: data.auPosts
        .filter((p) => p.auId === chip.id)
        .map((p) => ({ title: p.title, date: p.date })),
      gallery: data.gallery
        .filter((g) => g.category === category)
        .slice(0, 12)
        .map((g) => publicUrl(g.thumbUrl ?? g.url)),
      bg: agents[0]?.detail.heroImageUrl ? publicUrl(agents[0].detail.heroImageUrl) : undefined,
    };
  }

  const au = data.au.find((a) => a.id === chip.id);
  return {
    profiles: (au?.members ?? []).map((m) => ({
      name: m.name,
      image: m.imageUrl ? publicUrl(m.imageUrl) : undefined,
      lines: m.descriptions,
    })),
    synopsis: [au?.description, au?.content].filter(Boolean).join("\n\n"),
    logs: data.auPosts
      .filter((p) => p.auId === chip.id)
      .map((p) => ({ title: p.title, date: p.date })),
    gallery: (au?.gallery ?? []).slice(0, 12).map((g) => publicUrl(g.url)),
    bg: au?.imageUrl ? publicUrl(au.imageUrl) : undefined,
  };
}
