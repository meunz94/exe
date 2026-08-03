import type { FloodHead, FloodLine } from "./TerminalFlood";

/** Stable-ish readout values — a plausible machine, not live telemetry. */
function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ---------------------------------------------------------------------------
 * Amber — the handshake played on the way into a document (info / prompt).
 * ------------------------------------------------------------------------- */

export function identityHead(node: string): FloodHead {
  return {
    left: [
      ["SYS.NAME", "LIMBIC_SYSTEM v0.2"],
      ["SYS.NODE", node],
    ],
    right: [
      ["TERMINAL", "TTY1"],
      ["TIME", stamp()],
    ],
  };
}

export function identityLines(node: "INFO" | "PROMPT"): FloodLine[] {
  const label = node === "INFO" ? "index of neighbours & notices" : "generation prompt archive";

  return [
    { text: `LIMBIC SYSTEM ACCESS SEQUENCE v1.3`, dim: true },
    { hr: true },
    { text: "IDENTITY PROTOCOL" },
    { hr: true },
    { text: "VISITOR SIGNATURE", leader: true, tag: "VERIFIED" },
    { text: "ACCESS LEVEL", leader: true, tag: "GUEST" },
    { text: "LINK INTEGRITY", leader: true, tag: "STABLE" },
    { text: `MOUNT /${node.toLowerCase()}`, leader: true, tag: "OK", pause: 120 },
    { hr: true },
    { text: `${node} MODULE READY`, big: true, pause: 160 },
    { text: label, dim: true },
    { text: "OPENING…", dim: true, pause: 200 },
  ];
}

/* ---------------------------------------------------------------------------
 * Green — the boot log played on the way into the site itself.
 * ------------------------------------------------------------------------- */

export function bootHead(entries: number, frames: number): FloodHead {
  return {
    left: [
      ["SYS.NAME", "LIMBIC_SYSTEM v0.2"],
      ["SYS.AUTH", "ACCESS_GRANTED"],
      ["SYS.NODE", "limbic.system"],
    ],
    right: [
      ["ENTRIES", String(entries).padStart(2, "0")],
      ["FRAMES", String(frames).padStart(2, "0")],
      ["STATUS", "200"],
    ],
  };
}

/**
 * Built from the real dataset so the log reports what actually loaded rather
 * than a fixed prop list.
 */
export function bootLines(opts: {
  entries: { label: string; category: string }[];
  posts: number;
  frames: number;
  tracks: number;
}): FloodLine[] {
  const { entries, posts, frames, tracks } = opts;

  return [
    { text: "LIMBIC_SYSTEM v0.2 -- booting…", dim: true },
    { text: "Loading kernel.pkg", leader: true, tag: "OK" },
    { text: "Loading crt_display.pkg", leader: true, tag: "OK" },
    { text: "Loading archive_index.pkg", leader: true, tag: "OK" },
    { text: "Loading galmuri_font.pkg", leader: true, tag: "OK", pause: 100 },
    { hr: true },
    ...entries.map<FloodLine>((e) => ({
      text: `Mounting /${e.category.toLowerCase()} — ${e.label}`,
      leader: true,
      tag: "LIVE",
    })),
    { hr: true },
    { text: `Indexing ${posts} archive entries`, leader: true, tag: "DONE" },
    { text: `Indexing ${frames} frames`, leader: true, tag: "DONE" },
    { text: `Indexing ${tracks} tracks`, leader: true, tag: "DONE", pause: 140 },
    { hr: true },
    { text: "WELCOME BACK", big: true, pause: 180 },
    { text: "entering limbic system…", dim: true, pause: 220 },
  ];
}
