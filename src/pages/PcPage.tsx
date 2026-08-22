import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Agent, AppData, Post } from "../types";
import { useFetchPostContent } from "../data/useAppData";
import { displayDate, publicUrl } from "../utils/publicUrl";
import { PC_BOARDS, type PcBoard } from "../types/screens";
import styles from "./PcPage.module.css";

type Category = PcBoard;
type View = "DASHBOARD" | Category;

interface ChangeEntry {
  hash: string;
  date: string;
  tag: string;
  text: string;
  count: number;
  since?: string;
}

interface ScheduleBlock {
  start: number;
  end: number;
  label: string;
  /** where it happens — shown under the label when the block is tall enough */
  place?: string;
  /** 0–100 activity load; never rendered, but drives the live heart rate */
  load?: number;
}

interface Station {
  freq: number;
  name: string;
  lines: { who: string; text: string }[];
}

interface HeartConfig {
  agent: string;
  unit: string;
  note: string;
  /** bpm at zero load */
  restBpm: number;
  /** bpm added per load point (0–100) */
  perLoad: number;
  jitter: number;
  sampleMs: number;
  window: number;
}

type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

interface Lane {
  agent: string;
  blocks: ScheduleBlock[];
}

interface Modules {
  /** one entry per weekday, so the routine follows the calendar */
  schedule: Partial<Record<Weekday, Lane[]>>;
  stations: Station[];
  heart?: HeartConfig;
}

const WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAY_KR: Record<Weekday, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};
const WEEKDAY_FULL: Record<Weekday, string> = {
  MON: "MONDAY",
  TUE: "TUESDAY",
  WED: "WEDNESDAY",
  THU: "THURSDAY",
  FRI: "FRIDAY",
  SAT: "SATURDAY",
  SUN: "SUNDAY",
};
/** JS getDay(): 0 = Sunday */
const todayWeekday = (): Weekday => WEEKDAYS[(new Date().getDay() + 6) % 7];

const postIdFromPath = () => window.location.pathname.split("/")[2] ?? null;

/* --- instrument widgets ------------------------------------------------------ */

/** Tick-ring gauge with a big reading, after the reference's dial. */
function TickGauge({ value, label, sub }: { value: number; label: string; sub: string }) {
  const ticks = 48;
  const active = Math.round((value / 100) * ticks);
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 200 200">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
          const r2 = i % 4 === 0 ? 72 : 78;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 86}
              y1={100 + Math.sin(a) * 86}
              x2={100 + Math.cos(a) * r2}
              y2={100 + Math.sin(a) * r2}
              className={i < active ? styles.tickOn : styles.tick}
            />
          );
        })}
      </svg>
      <div className={styles.gaugeRead}>
        <strong>{value.toFixed(1)}%</strong>
        <span>{label}</span>
        <span className={styles.gaugeSub}>{sub}</span>
      </div>
    </div>
  );
}

function BarRow({ label, sub, value, max }: { label: string; sub: string; value: number; max: number }) {
  return (
    <div className={styles.barRow}>
      <div className={styles.barHead}>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <span className={styles.barSub}>{sub}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function RingPill({
  label,
  count,
  share,
  onClick,
}: {
  label: string;
  count: number;
  share: number;
  onClick: () => void;
}) {
  const C = 2 * Math.PI * 15;
  return (
    <button type="button" className={styles.ringPill} onClick={onClick}>
      <span className={styles.ringLabel}>{label}</span>
      <span className={styles.ringWrap}>
        <svg viewBox="0 0 38 38">
          <circle cx={19} cy={19} r={15} className={styles.ringBase} />
          <circle
            cx={19}
            cy={19}
            r={15}
            className={styles.ringValue}
            strokeDasharray={`${share * C} ${C}`}
            transform="rotate(-90 19 19)"
          />
        </svg>
        <em>{count}</em>
      </span>
    </button>
  );
}

const HOUR_LABEL = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

/** Proportional day column: each block occupies exactly its own span of the
    shared hour scale, so a 10–15 block is five hours tall. */
const PX_PER_HOUR = 36;

function RoutineTimeline({
  lane,
  nowHour,
  from,
  to,
}: {
  lane: Lane;
  nowHour: number;
  from: number;
  to: number;
}) {
  const height = (to - from) * PX_PER_HOUR;
  const y = (h: number) => (h - from) * PX_PER_HOUR;

  return (
    <div className={styles.routine}>
      <span className={styles.routineName}>{lane.agent}</span>
      <div className={styles.routineTrack} style={{ height }}>
        {/* hour grid + labels */}
        {Array.from({ length: Math.floor(to - from) + 1 }, (_, i) => {
          const h = Math.ceil(from) + i;
          if (h > to) return null;
          return (
            <div key={h} className={styles.routineHour} style={{ top: y(h) }}>
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
          );
        })}

        {lane.blocks.map((b) => {
          const current = nowHour >= b.start && nowHour < b.end;
          const span = (b.end - b.start) * PX_PER_HOUR;
          return (
            <div
              key={`${b.start}-${b.label}`}
              className={`${styles.routineBlock} ${current ? styles.routineNow : ""}`}
              style={{ top: y(b.start), height: span - 4 }}
            >
              <b>{b.label}</b>
              {b.place && span > 52 && <u>{b.place}</u>}
              {span > 76 && (
                <i>
                  {HOUR_LABEL(b.start)} – {HOUR_LABEL(b.end)}
                </i>
              )}
            </div>
          );
        })}

        {nowHour >= from && nowHour <= to && (
          <div className={styles.routineNowLine} style={{ top: y(nowHour) }} />
        )}
      </div>
    </div>
  );
}

/** Live bpm monitor. The trace is driven by the load of whatever the agent
    is doing right now — training spikes, meals settle — so it reads as a
    real telemetry feed. Load itself stays out of the UI. */
function HeartMonitor({ config, load }: { config: HeartConfig; load: number }) {
  const target = config.restBpm + load * config.perLoad;
  const [samples, setSamples] = useState<number[]>(() =>
    Array.from({ length: config.window }, () => target)
  );
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const step = () =>
      setSamples((prev) => {
        const aim = config.restBpm + loadRef.current * config.perLoad;
        const last = prev[prev.length - 1] ?? aim;
        // ease toward the target, then add a little beat-to-beat variation
        const eased = last + (aim - last) * 0.28;
        const next = eased + (Math.random() - 0.5) * config.jitter * 2;
        return [...prev.slice(1), Math.max(40, Math.min(200, next))];
      });
    const id = window.setInterval(step, config.sampleMs);
    return () => window.clearInterval(id);
  }, [config]);

  const W = 480;
  const H = 150;
  const pad = { l: 6, r: 6, t: 18, b: 20 };
  const lo = Math.min(...samples) - 8;
  const hi = Math.max(...samples) + 10;

  const xy = samples.map((v, i) => [
    pad.l + (i / (samples.length - 1)) * (W - pad.l - pad.r),
    pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b),
  ] as const);

  const path = xy.reduce((acc, cur, i, arr) => {
    if (i === 0) return `M ${cur[0]} ${cur[1]}`;
    const p0 = arr[i - 2] ?? arr[i - 1];
    const p1 = arr[i - 1];
    const p3 = arr[i + 1] ?? cur;
    const c1 = [p1[0] + (cur[0] - p0[0]) / 6, p1[1] + (cur[1] - p0[1]) / 6];
    const c2 = [cur[0] - (p3[0] - p1[0]) / 6, cur[1] - (p3[1] - p1[1]) / 6];
    return `${acc} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${cur[0]} ${cur[1]}`;
  }, "");

  const head = xy[xy.length - 1];
  const current = Math.round(samples[samples.length - 1]);
  const stats = [
    ["CURRENT", current],
    ["AVERAGE", Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)],
    ["MINIMUM", Math.round(Math.min(...samples))],
    ["MAXIMUM", Math.round(Math.max(...samples))],
  ] as const;

  return (
    <div className={styles.heart}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.heartSvg}>
        <path d={path} className={styles.heartLine} />
        <line x1={head[0]} y1={head[1]} x2={head[0]} y2={H - pad.b} className={styles.heartDrop} />
        <circle cx={head[0]} cy={head[1]} r={4.5} className={styles.heartDot} />
        <text x={head[0]} y={head[1] - 9} className={styles.heartPeak} textAnchor="end">
          {current} {config.unit}
        </text>
      </svg>
      <div className={styles.heartStats}>
        {stats.map(([k, v]) => (
          <span key={k}>
            <strong>
              {v} <i>{config.unit}</i>
            </strong>
            <em>{k}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Closed radio set — the dashboard tile. Clicking it opens the tuner. */
function RadioSet({ locked, onOpen }: { locked: Station | null; onOpen: () => void }) {
  return (
    <button type="button" className={styles.radioSet} onClick={onOpen}>
      <span className={styles.radioSetGrille} aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <span className={styles.radioSetBody}>
        <span className={styles.radioSetLabel}>FM RECEIVER · LS-88</span>
        <span className={styles.radioSetRead}>
          {locked ? locked.name : "— — —"}
          <em>{locked ? `${locked.freq.toFixed(1)} MHz` : "NO SIGNAL"}</em>
        </span>
        <span className={styles.radioSetKnobs} aria-hidden>
          <i />
          <i />
        </span>
      </span>
      <span className={styles.radioSetHint}>TAP TO TUNE →</span>
    </button>
  );
}

/** The tuner popup: a slider band with station marks, plus the transcript of
    whatever station the needle is sitting on. */
function RadioModal({
  freq,
  onTune,
  stations,
  locked,
  onClose,
}: {
  freq: number;
  onTune: (f: number) => void;
  stations: Station[];
  locked: Station | null;
  onClose: () => void;
}) {
  const band = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const MIN = 87.5;
  const MAX = 108;
  const pct = ((freq - MIN) / (MAX - MIN)) * 100;

  const freqAt = (clientX: number) => {
    const rect = band.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round((MIN + t * (MAX - MIN)) * 10) / 10;
  };

  return (
    <div className={styles.lightbox} onClick={onClose}>
      <div className={styles.tunerRow}>
      <div className={styles.tuner} onClick={(e) => e.stopPropagation()}>
        <header className={styles.tunerHead}>
          <span>FM RECEIVER — LS-88</span>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={styles.tunerBody}>
          <div className={styles.tunerDisplay}>
            <span className={styles.tunerBandName}>FM · STEREO</span>
            <strong className={`${styles.tunerFreq} ${locked ? styles.tunerLocked : ""}`}>
              {freq.toFixed(1)}
              <em>MHz</em>
            </strong>
            <span className={styles.tunerStation}>
              {locked ? `▶ ${locked.name}` : "…SCANNING"}
            </span>
            <span className={styles.tunerMeter} aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} className={locked && i < 11 ? styles.meterOn : undefined} />
              ))}
            </span>
          </div>

          <div
            ref={band}
            className={styles.tunerBand}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              onTune(freqAt(e.clientX));
            }}
            onPointerMove={(e) => dragging.current && onTune(freqAt(e.clientX))}
            onPointerUp={(e) => {
              dragging.current = false;
              (e.currentTarget as Element).releasePointerCapture(e.pointerId);
            }}
          >
            {Array.from({ length: 42 }, (_, i) => (
              <span key={i} className={styles.tunerTick} style={{ left: `${(i / 41) * 100}%` }}>
                {i % 5 === 0 && <em>{Math.round(MIN + (i / 41) * (MAX - MIN))}</em>}
              </span>
            ))}
            {stations.map((st) => (
              <span
                key={st.freq}
                className={styles.tunerMark}
                style={{ left: `${((st.freq - MIN) / (MAX - MIN)) * 100}%` }}
                title={`${st.name} ${st.freq}`}
              />
            ))}
            <span className={styles.tunerNeedle} style={{ left: `${pct}%` }} />
          </div>
          <p className={styles.tunerHint}>다이얼을 끌어 주파수를 맞추세요 · 파란 점이 방송국</p>
        </div>
      </div>

      {/* a separate signal window standing beside the receiver */}
      <aside
        className={`${styles.signal} ${locked ? styles.signalOn : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {locked ? (
          <>
            <span className={styles.signalHead}>
              {locked.freq.toFixed(1)} · {locked.name}
            </span>
            {locked.lines.map((line, i) => (
              <p
                key={i}
                className={`${styles.bubble} ${line.who === "V" ? styles.bubbleV : styles.bubbleB}`}
              >
                <em>{line.who}</em>
                {line.text}
              </p>
            ))}
          </>
        ) : (
          <p className={styles.tunerNoise}>
            ▚▚ ▚ ▚▚▚ ▚ ▚▚
            <br />
            잡음만 들립니다
            <br />
            ▚▚ ▚▚▚ ▚ ▚▚
          </p>
        )}
      </aside>
      </div>
    </div>
  );
}

/** Live HH:MM:SS under a ruler of ticks, after the Aeonik Fono reference. */
function BigClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={styles.clock}>
      <svg viewBox="0 0 400 26" className={styles.clockRuler}>
        {Array.from({ length: 41 }, (_, i) => (
          <line
            key={i}
            x1={10 + i * 9.5}
            y1={i % 5 === 0 ? 2 : 8}
            x2={10 + i * 9.5}
            y2={22}
            className={styles.tick}
          />
        ))}
        <circle cx={10 + (now.getSeconds() / 59) * 380} cy={12} r={5} className={styles.clockDot} />
      </svg>
      <span className={styles.clockCaption}>LIMBIC SYSTEM — LOCAL</span>
      <strong className={styles.clockTime}>
        {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </strong>
    </div>
  );
}

/* --- the page ------------------------------------------------------------------ */

interface PcPageProps {
  data: AppData;
  onBack: () => void;
}

export default function PcPage({ data, onBack }: PcPageProps) {
  const [view, setView] = useState<View>("DASHBOARD");
  const [query, setQuery] = useState("");
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [modules, setModules] = useState<Modules>({ schedule: {}, stations: [] });
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const { fetchContent } = useFetchPostContent();
  const [scriptCount, setScriptCount] = useState(0);
  const [profile, setProfile] = useState<Agent | null>(null);
  const [freq, setFreq] = useState(95.2);
  const [radioOpen, setRadioOpen] = useState(false);
  const [toast, setToast] = useState(true);

  useEffect(() => {
    const grab = <T,>(file: string, fallback: T, set: (v: T) => void) =>
      fetch(publicUrl(file))
        .then((r) => (r.ok ? r.json() : fallback))
        .then(set)
        .catch(() => set(fallback));

    grab<ChangeEntry[]>("data/changelog.json", [], setChanges);
    grab<Modules>("data/pc-modules.json", { schedule: {}, stations: [] }, setModules);
    grab<unknown[]>("data/scripts.json", [], (s) => setScriptCount(s.length));
  }, []);

  /** posts whose 게시판 is one of the PC boards */
  const posts = useMemo(
    () => data.posts.filter((p) => (PC_BOARDS as readonly string[]).includes(p.boardId)),
    [data.posts]
  );

  const counts = useMemo(() => {
    const by = { LOG: 0, OOC: 0, ETC: 0 };
    posts.forEach((p) => {
      by[p.boardId as Category]++;
    });
    return by;
  }, [posts]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.boardId.toLowerCase().includes(q) ||
        (p.preview ?? "").toLowerCase().includes(q)
    );
  }, [posts, query]);

  /** Tuning within 0.3 MHz of a station locks onto it. */
  const locked = useMemo(
    () => modules.stations.find((s) => Math.abs(s.freq - freq) <= 0.3) ?? null,
    [modules.stations, freq]
  );

  /** the routine follows the calendar — only today's lane is shown */
  const day = todayWeekday();

  const chips = data.sidebarItems.length + data.au.length;
  /** Held steady on purpose — the panel reads as a calibrated instrument. */
  const sync = 98.9;
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;

  const profiles = useMemo(() => {
    const vb = data.agents.filter((a) => a.category === "VB");
    return (vb.length >= 2 ? vb : data.agents).slice(0, 2);
  }, [data.agents]);

  const openPostById = useCallback(
    (post: Post, pushUrl = true) => {
      setView(post.boardId as Category);
      setOpenPost(post);
      setBody(null);
      if (pushUrl) window.history.pushState(null, "", `/pc/${post.id}`);
      fetchContent(post).then((full) => setBody(full.content));
    },
    [fetchContent]
  );

  const closePost = useCallback((pushUrl = true) => {
    setOpenPost(null);
    if (pushUrl && postIdFromPath()) window.history.pushState(null, "", "/pc");
  }, []);

  const consumedDeepLink = useRef(false);
  useEffect(() => {
    if (consumedDeepLink.current || posts.length === 0) return;
    consumedDeepLink.current = true;
    const wanted = postIdFromPath();
    const post = wanted ? posts.find((p) => p.id === wanted) : null;
    if (!post) return;
    const t = window.setTimeout(() => openPostById(post, false), 0);
    return () => window.clearTimeout(t);
  }, [posts, openPostById]);

  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.startsWith("/pc")) return;
      const wanted = postIdFromPath();
      const post = wanted ? posts.find((p) => p.id === wanted) : null;
      if (post) openPostById(post, false);
      else setOpenPost(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [posts, openPostById]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (profile) setProfile(null);
      else if (radioOpen) setRadioOpen(false);
      else if (openPost) closePost();
      else if (query) setQuery("");
      else if (view !== "DASHBOARD") setView("DASHBOARD");
      else onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile, radioOpen, openPost, query, view, closePost, onBack]);

  /** Both agents share one hour scale so the columns line up. */
  const dayRange = useMemo(() => {
    const lanes = modules.schedule[day] ?? [];
    const blocks = lanes.flatMap((l) => l.blocks);
    if (blocks.length === 0) return { from: 6, to: 24 };
    return {
      from: Math.floor(Math.min(...blocks.map((b) => b.start))),
      to: Math.ceil(Math.max(...blocks.map((b) => b.end))),
    };
  }, [modules.schedule, day]);

  /** load of the block the heart-rate agent is inside right now */
  const heartLoad = useMemo(() => {
    const lane = (modules.schedule[day] ?? []).find((l) => l.agent === modules.heart?.agent);
    const block = lane?.blocks.find((b) => nowHour >= b.start && nowHour < b.end);
    return block?.load ?? 12;
  }, [modules.schedule, modules.heart, day, nowHour]);

  const listOf = (c: Category) => posts.filter((p) => p.boardId === c);

  const postList = (rows: Post[], showCategory = false) => (
    <ol className={styles.list}>
      {rows.map((post, i) => (
        <li key={post.id}>
          <button type="button" className={styles.postRow} onClick={() => openPostById(post)}>
            <span className={styles.postNum}>
              {showCategory ? post.boardId : String(i + 1).padStart(2, "0")}
            </span>
            <span className={styles.postTitle}>{post.title}</span>
            <span className={styles.postDate}>{displayDate(post.date)}</span>
          </button>
        </li>
      ))}
      {rows.length === 0 && <li className={styles.emptyList}>NO ENTRIES</li>}
    </ol>
  );

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack}>
          ←
        </button>
        <h1 className={styles.title}>Control Panel</h1>
        <label className={styles.search}>
          <span aria-hidden>⌕</span>
          <input
            type="search"
            value={query}
            placeholder="SEARCH POSTS"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="검색 초기화">
              ×
            </button>
          )}
        </label>
      </header>

      <nav className={styles.tabs}>
        {(["DASHBOARD", ...PC_BOARDS] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${!query && view === t ? styles.tabOn : ""}`}
            onClick={() => {
              setQuery("");
              setView(t);
              closePost();
            }}
          >
            {t}
            {t !== "DASHBOARD" && <sup>{counts[t]}</sup>}
          </button>
        ))}
      </nav>

      <div className={styles.grid}>
        <main className={styles.main}>
          {results ? (
            <>
              <p className={styles.resultHead}>
                SEARCH “{query}” — {results.length} RESULTS
              </p>
              {postList(results, true)}
            </>
          ) : view === "DASHBOARD" ? (
            <div className={styles.dash}>
              <section className={`${styles.card} ${styles.cardGauge}`}>
                <span className={styles.cardDots}>•••</span>
                <TickGauge value={sync} label="SYNC RATE" sub="HARMONY / STABLE" />
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>ARCHIVE</h2>
                <p className={styles.cardCopy}>You relax, we'll do the math. Here's your recap.</p>
                <BarRow label="CHIPS" sub="Cartridges on shelf" value={chips} max={20} />
                <BarRow label="SCRIPTS" sub="Papers, flowing" value={scriptCount} max={100} />
                <BarRow label="TRACKS" sub="On the walkman" value={data.playlist.length} max={30} />
              </section>

              <section className={styles.cardBare}>
                {PC_BOARDS.map((c) => (
                  <RingPill
                    key={c}
                    label={c}
                    count={counts[c]}
                    share={posts.length ? counts[c] / posts.length : 0}
                    onClick={() => setView(c)}
                  />
                ))}
              </section>

              <section className={`${styles.card} ${styles.cardWide}`}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>ROUTINE</h2>
                  <span className={styles.cardBadge}>{WEEKDAY_FULL[day]}</span>
                </div>
                <p className={styles.cardCopy}>
                  {WEEKDAY_KR[day]}요일 · 파란 테두리가 현재 진행 중인 일과입니다.
                </p>
                <div className={styles.routines}>
                  {(modules.schedule[day] ?? []).map((lane) => (
                    <RoutineTimeline
                      key={lane.agent}
                      lane={lane}
                      nowHour={nowHour}
                      from={dayRange.from}
                      to={dayRange.to}
                    />
                  ))}
                  {(modules.schedule[day] ?? []).length === 0 && (
                    <p className={styles.emptyList}>등록된 일정이 없습니다</p>
                  )}
                </div>
              </section>

              {modules.heart && (
                <section className={`${styles.card} ${styles.cardTwo}`}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>HEART RATE — {modules.heart.agent.toUpperCase()}</h2>
                    <span className={styles.cardBadge}>● LIVE</span>
                  </div>
                  <p className={styles.cardCopy}>{modules.heart.note}</p>
                  <HeartMonitor config={modules.heart} load={heartLoad} />
                </section>
              )}

              <section className={styles.cardBare}>
                <RadioSet locked={locked} onOpen={() => setRadioOpen(true)} />
              </section>

              <section className={`${styles.card} ${styles.cardWide}`}>
                <h2 className={styles.cardTitle}>SYSTEM UPDATES</h2>
                <p className={styles.cardCopy}>최근 변경 사항 — 커밋 기록에서 자동 생성됩니다.</p>
                <ol className={styles.changes}>
                  {changes.map((c) => (
                    <li key={c.hash}>
                      <span className={styles.changeDate}>{displayDate(c.date)}</span>
                      <span className={styles.changeTag} data-tag={c.tag}>
                        {c.tag}
                      </span>
                      <span className={styles.changeText}>
                        {c.text}
                        {c.count > 1 && <em> ×{c.count}</em>}
                      </span>
                    </li>
                  ))}
                  {changes.length === 0 && <li className={styles.emptyList}>NO HISTORY</li>}
                </ol>
              </section>


              <section className={`${styles.cardBare} ${styles.clockCard}`}>
                <BigClock />
              </section>

            </div>
          ) : openPost ? (
            <article className={styles.reader}>
              <header className={styles.readerHead}>
                <button type="button" className={styles.readerBack} onClick={() => closePost()}>
                  ← {view}
                </button>
                <span className={styles.readerMeta}>{displayDate(openPost.date)}</span>
              </header>
              <h2 className={styles.readerTitle}>{openPost.title}</h2>
              <div className={styles.markdown}>
                {body === null ? (
                  <p className={styles.loading}>LOADING...</p>
                ) : (
                  <Markdown rehypePlugins={[rehypeRaw]}>{body}</Markdown>
                )}
              </div>
            </article>
          ) : (
            postList(listOf(view))
          )}
        </main>

        <aside className={styles.side}>
          {profiles.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={styles.profile}
              onClick={() => setProfile(agent)}
            >
              <span className={styles.profilePhoto}>
                {agent.imageUrl && <img src={publicUrl(agent.imageUrl)} alt={agent.name} loading="lazy" />}
              </span>
              <strong className={styles.profileName}>{agent.name}</strong>
              <span className={styles.profileRows}>
                <span>
                  <i>소속</i>
                  <b>{agent.description[0] ?? "—"}</b>
                </span>
                <span>
                  <i>직책</i>
                  <b>{agent.description[1] ?? agent.detail?.subtitle ?? "—"}</b>
                </span>
                <span>
                  <i>특이사항</i>
                  <b>{(agent.detail?.profile?.evaluation ?? "—").slice(0, 40)}…</b>
                </span>
              </span>
              <span className={styles.profileMore}>FULL RECORD →</span>
            </button>
          ))}

        </aside>
      </div>

      {toast && (
        <div className={styles.toast}>
          <div className={styles.toastHead}>
            <span>
              {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")}
            </span>
            <button type="button" onClick={() => setToast(false)} aria-label="알림 닫기">
              ×
            </button>
          </div>
          <p>훈련실 온도가 정상 범위로 돌아왔습니다. 오늘의 오버클럭 발생 횟수: 1회.</p>
          <p className={styles.toastSign}>책임자님, 오늘도 좋은 하루 되세요!</p>
        </div>
      )}

      {radioOpen && (
        <RadioModal
          freq={freq}
          onTune={setFreq}
          stations={modules.stations}
          locked={locked}
          onClose={() => setRadioOpen(false)}
        />
      )}

      {/* full personnel record */}
      {profile && (
        <div className={styles.lightbox} onClick={() => setProfile(null)}>
          <article className={styles.record} onClick={(e) => e.stopPropagation()}>
            <header className={styles.recordHead}>
              <span>PERSONNEL RECORD — {profile.category}</span>
              <button type="button" onClick={() => setProfile(null)} aria-label="닫기">
                ×
              </button>
            </header>
            <div className={styles.recordBody}>
              <div className={styles.recordPhoto}>
                {profile.imageUrl && <img src={publicUrl(profile.imageUrl)} alt={profile.name} />}
              </div>
              <div className={styles.recordText}>
                <h2>{profile.name}</h2>
                <p className={styles.recordSub}>{profile.detail?.subtitle}</p>
                <dl className={styles.recordFields}>
                  {Object.entries(profile.detail?.profile ?? {}).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {profile.detail?.appearance && (
                  <dl className={styles.recordFields}>
                    {Object.entries(profile.detail.appearance).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {profile.detail?.ability && (
                  <>
                    <h3>ABILITY</h3>
                    <p>{profile.detail.ability.overview}</p>
                    <ul>
                      {profile.detail.ability.skills.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                {profile.detail?.relations?.length ? (
                  <>
                    <h3>RELATIONS</h3>
                    <ul>
                      {profile.detail.relations.map((r) => (
                        <li key={r.name}>
                          <b>{r.name}</b> — {r.relation}. {r.description}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
