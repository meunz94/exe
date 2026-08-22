/** The five devices on the hub desk, each opening its own section. */
export type HubSection = "pc" | "nintendo" | "papers" | "walkman" | "floppy";

export const HUB_SECTIONS: HubSection[] = ["pc", "nintendo", "papers", "walkman", "floppy"];

/** Status-bar copy for each device, shown while hovering on the hub. */
export const SECTION_TAGLINES: Record<HubSection, string> = {
  pc: "PC — BOARD",
  nintendo: "NINTENDO — CHIPS & STORIES",
  papers: "PAPERS — PERSONNEL FILES",
  walkman: "WALKMAN — PLAYLIST",
  floppy: "FLOPPY — DOCS & CREDITS",
};

/** PC 대시보드가 쓰는 게시판 이름 — 공용 게시글 DB를 이 이름으로 갈라 쓴다. */
export const PC_BOARDS = ["LOG", "OOC", "ETC"] as const;
export type PcBoard = (typeof PC_BOARDS)[number];
