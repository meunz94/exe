import type { FloodLine } from "./TerminalFlood";

/**
 * The DOS-style load sequence shown between the entry label and the hub.
 * Numbers come from the live archive data so the readout never drifts from
 * what actually loads.
 */
export interface LoadStats {
  /** series + AU cartridges */
  chips: number;
  tracks: number;
  frames: number;
  posts: number;
}

const dim = (text: string): FloodLine => ({ text, dim: true });
const pad = (label: string, value: string) => `  ${label.padEnd(18, " ")}${value}`;

export function loadLines(stats: LoadStats): FloodLine[] {
  return [
    { text: "LIMBIC SYSTEM(TM) LS-DOS 4.10.2222" },
    dim("(C)Copyright Yeonzzang Corp 2012-2026."),
    { text: "" },
    { text: "HIMEM is testing devotion...done.", pause: 120 },
    { text: "" },
    { text: "C:\\>LIMBIC.SYS /load", pause: 60 },
    { text: "YUME.DRV loaded in upper memory." },
    { text: "HEART.386 loaded in lower memory.", pause: 100 },
    { text: "" },
    { text: "C:\\>MOUNT ARCHIVE /ALL", pause: 60 },
    { text: pad("CHIPS.DAT", `${stats.chips} cartridges ... ok`) },
    { text: pad("TRACKS.M3U", `${stats.tracks} songs ....... ok`) },
    { text: pad("FRAMES.BMP", `${stats.frames} images ...... ok`) },
    { text: pad("LOGS.TXT", `${stats.posts} entries ..... ok`), pause: 100 },
    { text: "" },
    { text: "C:\\>INIT3D /desk", pause: 60 },
    { text: pad("MONITOR.GLB", "ok") },
    { text: pad("NINTENDO.GLB", "ok") },
    { text: pad("WALKMAN.GLB", "ok") },
    { text: pad("FLOPPY.GLB", "ok") },
    { text: pad("PAPERS.GLB", "ok"), pause: 140 },
    { text: "" },
    { text: "WARNING: This yumeship is highly addictive.", pause: 60 },
    dim("Proceed at your own risk."),
    { text: "" },
    { text: "Welcome back, ARCH-PARTNER-0212", big: true, pause: 260 },
    dim("_"),
  ];
}
