import { useEffect, useState, useCallback, useRef } from "react";
import GlassDesktop, { type GlassTarget } from "./GlassDesktop";
import { useRetroCursors } from "./useRetroCursors";
import deskScene from "../../assets/boot-desk.webp";
import styles from "./BootScreen.module.css";

/**
 * off      — the desk is dark; the monitor's glass is empty
 * warming  — CRT strike: a hot line blooms open into a full raster
 * on       — the scene has pushed in on the monitor; icons are usable
 * entering — LOVE was picked; the camera dives into the glass
 */
type Power = "off" | "warming" | "on" | "entering";

const WARMUP_MS = 700;
/** Matches the dive transition in BootScreen.module.css. */
const ENTER_MS = 800;

/**
 * The glass desktop is laid out in `em`, so one number drives its whole scale.
 * The icon row measures ~16.4em wide; dividing the glass by 18 leaves a margin
 * either side at every viewport size.
 */
const GLASS_EM_DIVISOR = 18;

/** The glass is this fraction of the scene's width (measured off the photo). */
const GLASS_FRACTION = 0.18242;

/**
 * How wide we want the glass to end up on screen. Everything else follows:
 * the push-in is whatever zoom hits this, and the desktop is then scaled to
 * fill it. Hardcoding a zoom instead would over-magnify narrow viewports,
 * where "cover" has already cropped in hard.
 */
function targetGlassWidth() {
  const byWidth = window.innerWidth * 0.46;
  const byHeight = window.innerHeight * 0.62;
  return Math.max(272, Math.min(byWidth, byHeight, 520));
}

interface BootScreenProps {
  /** Fired after the dive-in completes (LOVE). */
  onEnter: () => void;
  /** Fired immediately on click (info / prompt) — caller plays the transition. */
  onOpenDoc: (target: "info" | "prompt") => void;
  /**
   * Skip the power-on. Set when coming back from a document: the machine was
   * already running, so making the visitor switch it on again reads as a bug.
   */
  alreadyOn?: boolean;
}

export default function BootScreen({ onEnter, onOpenDoc, alreadyOn = false }: BootScreenProps) {
  const [power, setPower] = useState<Power>(alreadyOn ? "on" : "off");
  const [glassEm, setGlassEm] = useState(16);
  const [zoom, setZoom] = useState(1.6);

  const sceneRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const powerOn = useCallback(() => {
    if (power !== "off") return;
    setPower("warming");
    timers.current.push(window.setTimeout(() => setPower("on"), WARMUP_MS));
  }, [power]);

  const openTarget = useCallback(
    (target: GlassTarget) => {
      if (power !== "on") return;
      if (target === "love") {
        // Dive through the glass, then hand off to the boot log.
        setPower("entering");
        timers.current.push(window.setTimeout(onEnter, ENTER_MS));
        return;
      }
      // Documents don't zoom — the terminal flood covers the cut instead.
      onOpenDoc(target);
    },
    [power, onEnter, onOpenDoc]
  );

  // Retro pointer pair, scoped to the boot subtree.
  useRetroCursors();

  // The boot gate owns the whole viewport. Now that the document scrolls for
  // the landing page, pin it while we're mounted so nothing drifts behind the
  // fixed stage.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("viewportLocked");
    return () => root.classList.remove("viewportLocked");
  }, []);

  // Derive the push-in and the chrome scale from the actual layout: how much
  // the photo had to be blown up to cover this viewport decides how much
  // further we need to go to reach a readable glass.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const fit = () => {
      // offsetWidth, not getBoundingClientRect — the latter includes our own
      // zoom transform and would feed back into the next measurement.
      const base = scene.offsetWidth * GLASS_FRACTION;
      if (base <= 0) return;

      const target = targetGlassWidth();
      // Cap the magnification: the source is 1672px wide, and pushing much
      // past ~1.8x starts to visibly soften the photo.
      setZoom(Math.max(1, Math.min(target / base, 1.8)));

      // From `base`, the glass's *layout* width — not its on-screen size. The
      // desktop sits inside the scene, so the zoom already applies to it;
      // measuring the zoomed width here would compound the two scales.
      setGlassEm(base / GLASS_EM_DIVISOR);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scene);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (power === "off" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        powerOn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [power, powerOn]);

  return (
    <div className={`${styles.stage} ${styles[power]}`} data-win98-root data-power={power}>
      <div
        className={styles.scene}
        ref={sceneRef}
        style={{ "--zoom": zoom } as React.CSSProperties}
      >
        <img className={styles.photo} src={deskScene} alt="" draggable={false} />

        {/* light the CRT throws back onto the desk once it's running */}
        <span className={styles.glow} aria-hidden="true" />

        <div className={styles.glass}>
          {/* CRT strike, painted above the content while warming */}
          <span className={styles.warmup} aria-hidden="true" />
          <span className={styles.scanlines} aria-hidden="true" />

          <div className={styles.screenContent} style={{ fontSize: glassEm }}>
            <GlassDesktop onOpen={openTarget} />
          </div>

          {power === "off" && (
            <button
              type="button"
              className={styles.powerHit}
              onClick={powerOn}
              aria-label="전원 켜기"
            />
          )}
        </div>
      </div>

      {power === "off" && (
        <p className={styles.prompt}>
          <span className={styles.promptDot} />
          Click the screen to power on
        </p>
      )}
    </div>
  );
}
