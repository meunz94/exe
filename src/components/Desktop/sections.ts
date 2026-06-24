import type { AppData } from "../../types";
import { useFilteredData } from "../../data/useAppData";
import iconProfile from "../../assets/windows98-icons/png/address_book-0.png";
import iconConsole from "../../assets/windows98-icons/png/console_prompt-0.png";
import iconArchive from "../../assets/windows98-icons/png/directory_closed-0.png";
import iconMusic from "../../assets/windows98-icons/png/cd_audio_cd_a-0.png";
import iconTimeline from "../../assets/windows98-icons/png/calendar-0.png";
import iconVideo from "../../assets/windows98-icons/png/media_player-0.png";
import iconGallery from "../../assets/windows98-icons/png/kodak_imaging-0.png";

export type SectionKey =
  | "profile"
  | "disciplinary"
  | "archive"
  | "music"
  | "timeline"
  | "video"
  | "gallery";

export interface SectionDef {
  key: SectionKey;
  label: string;
  icon: string;
  width: number;
}

export const SECTIONS: SectionDef[] = [
  { key: "profile", label: "profile", icon: iconProfile, width: 480 },
  { key: "disciplinary", label: "disciplinary.log", icon: iconConsole, width: 520 },
  { key: "archive", label: "archive", icon: iconArchive, width: 540 },
  { key: "music", label: "music", icon: iconMusic, width: 520 },
  { key: "timeline", label: "timeline", icon: iconTimeline, width: 520 },
  { key: "video", label: "video", icon: iconVideo, width: 540 },
  { key: "gallery", label: "gallery", icon: iconGallery, width: 560 },
];

export const SECTION_BY_KEY: Record<SectionKey, SectionDef> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s])
) as Record<SectionKey, SectionDef>;

/** How many entries a category has per section — used to hide empty folders. */
export function useSectionCounts(data: AppData, category: string): Record<SectionKey, number> {
  const f = useFilteredData(data, category);
  return {
    profile: f.agents.length,
    disciplinary: f.disciplinary.length,
    archive: f.posts.length,
    music: f.playlist.length,
    timeline: f.timeline.length,
    video: f.youtube.length,
    gallery: f.gallery.length,
  };
}
