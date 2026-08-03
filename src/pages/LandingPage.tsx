import { Suspense, lazy, useEffect, useMemo, useRef } from "react";
import Lenis from "lenis";
import type { AppData, SidebarItem } from "../types";
import Marquee from "../components/Landing/Marquee";
import EntrySection from "../components/Landing/EntrySection";
import SkimShowcase from "../components/Landing/SkimShowcase";
import MiniVideo from "../components/Landing/MiniVideo";
import { publicUrl } from "../utils/publicUrl";
import styles from "./LandingPage.module.css";

// Purely decorative, and pulls in three.js — don't make first paint wait on it.
const HeroCanvas = lazy(() => import("../components/Landing/HeroCanvas"));

interface LandingPageProps {
  data: AppData;
  clock: string;
  /** Opens the entry in the existing window system. */
  onOpenItem: (item: SidebarItem) => void;
  /** True while a window covers the landing — pauses smooth scrolling. */
  scrollLocked: boolean;
}

const SITE_TITLE = ["Limbic", "System"];

/**
 * Scrolling front page. Replaces the desktop icon grid: each top-level entry
 * gets a numbered, colour-inverted section, and "Enter" hands off to the same
 * `openItem` the icons used to call — so the window system below is untouched.
 */
export default function LandingPage({
  data,
  clock,
  onOpenItem,
  scrollLocked,
}: LandingPageProps) {
  const lenisRef = useRef<Lenis | null>(null);

  // Smooth scrolling, matching the reference site's inertia.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenisRef.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Lenis keeps driving scroll even when `overflow: hidden` is set, so it has
  // to be stopped explicitly while a window is open.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (scrollLocked) lenis.stop();
    else lenis.start();
  }, [scrollLocked]);

  // Per-entry counts shown in the section aside. Derived from the same data the
  // windows render, so the numbers can't drift out of sync.
  const countsFor = useMemo(() => {
    return (item: SidebarItem) => {
      if (item.page === "au") {
        return [
          { label: "Universes", value: String(data.au.length).padStart(2, "0") },
          { label: "Logs", value: String(data.auPosts.length).padStart(2, "0") },
        ];
      }
      const inCategory = <T extends { category: string }>(xs: T[]) =>
        xs.filter((x) => x.category === item.category).length;
      return [
        { label: "Profiles", value: String(inCategory(data.agents)).padStart(2, "0") },
        { label: "Archive", value: String(inCategory(data.posts)).padStart(2, "0") },
        { label: "Gallery", value: String(inCategory(data.gallery)).padStart(2, "0") },
      ];
    };
  }, [data]);

  // Prefer the generated thumbnails — the source gallery PNGs are multi-MB
  // each, and the strip shows all of them at once.
  //
  // Sampled evenly rather than sliced, so every category is represented, and
  // capped so the doubled track stays a reasonable size: the strip only needs
  // to overflow the viewport, and an over-long track becomes a composited
  // layer too wide for the browser to rasterise.
  const showcaseImages = useMemo(() => {
    const MAX = 12;
    const source = data.gallery;
    const step = Math.max(1, Math.ceil(source.length / MAX));
    return source
      .filter((_, i) => i % step === 0)
      .slice(0, MAX)
      .map((g) => ({
        id: g.id,
        url: publicUrl(g.thumbUrl ?? g.url),
        caption: g.caption,
      }));
  }, [data.gallery]);

  return (
    <div className={styles.landing}>
      <div className={styles.topBanner}>
        <nav className={styles.nav}>
          <span>Index</span>
          <span className={styles.navSpacer} />
          {data.sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.navItem}
              onClick={() => onOpenItem(item)}
            >
              {item.label}
            </button>
          ))}
          <span className={styles.navClock}>{clock}</span>
        </nav>
        <Marquee text="Limbic System" duration={30} />
      </div>

      <header className={styles.hero} data-dark-bg>
        <div className={styles.heroCanvas}>
          <Suspense fallback={null}>
            <HeroCanvas />
          </Suspense>
        </div>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            {SITE_TITLE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <div className={styles.heroMeta}>
            <span>v.02 — Archive</span>
            <span>{data.sidebarItems.length} Entries</span>
            <span>{data.gallery.length} Frames</span>
          </div>
          <div className={styles.heroScroll}>↓ Scroll down to access</div>
        </div>
      </header>

      {data.sidebarItems.map((item, i) => (
        <EntrySection
          key={item.id}
          item={item}
          index={i}
          counts={countsFor(item)}
          onEnter={onOpenItem}
        />
      ))}

      <section className={styles.showcaseSection} data-dark-bg>
        <div className={styles.showcaseHeader}>
          <span>Nº{String(data.sidebarItems.length + 1).padStart(3, "0")} / Frames</span>
          <span>{data.gallery.length} items</span>
        </div>
        <SkimShowcase images={showcaseImages} />
      </section>

      <footer className={styles.footer} data-dark-bg>
        <Marquee text="Limbic System" duration={44} reverse small />
        <div className={styles.footerMeta}>
          <span>© Limbic System</span>
          <span>All works are fan-made</span>
          <span>{clock}</span>
        </div>
      </footer>

      <MiniVideo videos={data.youtube} />
    </div>
  );
}
