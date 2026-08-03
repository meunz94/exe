import { useCallback, useMemo, useState } from "react";
import type { AppData, Post, PostWithContent, SidebarItem } from "../types";
import { useFilteredData } from "../data/useAppData";
import WordWipe from "../components/Transition/WordWipe";
import { WIPE_INKS } from "../components/Transition/wipeInks";
import ProfileSection from "./entry/ProfileSection";
import ArchiveSection from "./entry/ArchiveSection";
import MusicSection from "./entry/MusicSection";
import GallerySection from "./entry/GallerySection";
import styles from "./EntryPage.module.css";

export type SectionId = "profile" | "archive" | "music" | "gallery";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "profile", label: "profile" },
  { id: "archive", label: "archive" },
  { id: "music", label: "music" },
  { id: "gallery", label: "gallery" },
];

interface EntryPageProps {
  data: AppData;
  item: SidebarItem;
  /** 1-based position of this entry on the landing page. */
  index: number;
  loadingPostId: string | null;
  fetchContent: (post: Post) => Promise<PostWithContent>;
  onBack: () => void;
}

/**
 * One archive entry, split into four sections.
 *
 * Switching sections plays a `WordWipe`: the destination's name scales up until
 * it covers the screen, the section swaps underneath, then the plate lifts. The
 * swap is deferred to `onCovered` so the change is never visible mid-flight.
 */
export default function EntryPage({
  data,
  item,
  index,
  loadingPostId,
  fetchContent,
  onBack,
}: EntryPageProps) {
  const f = useFilteredData(data, item.category);

  const [section, setSection] = useState<SectionId>("profile");
  /** Non-null while a transition is running; carries the destination. */
  const [wiping, setWiping] = useState<SectionId | null>(null);
  /** Bumped per transition so WordWipe remounts and restarts its animation. */
  const [wipeKey, setWipeKey] = useState(0);

  const counts = useMemo<Record<SectionId, number>>(
    () => ({
      profile: f.agents.length + f.timeline.length + f.disciplinary.length,
      archive: f.posts.length,
      music: f.playlist.length + f.youtube.length,
      gallery: f.gallery.length,
    }),
    [f]
  );

  const go = useCallback(
    (next: SectionId) => {
      if (next === section || wiping) return;
      setWipeKey((k) => k + 1);
      setWiping(next);
    },
    [section, wiping]
  );

  return (
    <div className={styles.page} data-dark-bg>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Index
        </button>
        <span className={styles.barSpacer} />
        <span className={styles.barMeta}>
          {item.category} / {section}
        </span>
      </div>

      <header className={styles.masthead}>
        <span className={styles.index}>
          {String(index).padStart(8, "0")}
        </span>
        <h1 className={styles.title}>{item.label}</h1>
        {item.synopsis && <p className={styles.synopsis}>{item.synopsis}</p>}
      </header>

      <nav className={styles.nav}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={[
              styles.navBtn,
              section === s.id ? styles.navBtnActive : "",
              counts[s.id] === 0 ? styles.navBtnEmpty : "",
            ].join(" ")}
            onClick={() => go(s.id)}
            aria-current={section === s.id}
          >
            {s.label}
            <span className={styles.navCount}>
              {String(counts[s.id]).padStart(2, "0")}
            </span>
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        <div className={styles.sectionHead}>
          <span>
            {item.label} / {section}
          </span>
          <span>{String(counts[section]).padStart(2, "0")} items</span>
        </div>

        {section === "profile" && (
          <ProfileSection
            agents={f.agents}
            timeline={f.timeline}
            disciplinary={f.disciplinary}
          />
        )}
        {section === "archive" && (
          <ArchiveSection
            posts={f.posts}
            boards={f.boards}
            loadingPostId={loadingPostId}
            fetchContent={fetchContent}
          />
        )}
        {section === "music" && (
          <MusicSection playlist={f.playlist} videos={f.youtube} />
        )}
        {section === "gallery" && <GallerySection images={f.gallery} />}
      </div>

      {wiping && (
        <WordWipe
          key={wipeKey}
          word={wiping}
          ink={WIPE_INKS[wiping]}
          note={`${item.label} — ${wiping}`}
          onCovered={() => setSection(wiping)}
          onDone={() => setWiping(null)}
        />
      )}
    </div>
  );
}
