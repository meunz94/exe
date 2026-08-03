import { useCallback, useEffect, useState } from "react";
import type {
  AppData,
  AuPost,
  AuPostWithContent,
  Post,
  PostWithContent,
  SidebarItem,
} from "../types";
import LandingPage from "./LandingPage";
import EntryPage from "./EntryPage";
import AuEntry from "./entry/AuEntry";
import WordWipe from "../components/Transition/WordWipe";
import { WIPE_INKS } from "../components/Transition/wipeInks";
import styles from "./SitePage.module.css";

interface SitePageProps {
  data: AppData;
  loadingPostId: string | null;
  loadingAuPostId: string | null;
  fetchContent: (post: Post) => Promise<PostWithContent>;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
  onBackToDesk: () => void;
}

/**
 * The archive shell: the scrolling index, and the entry page you land on from
 * it. Replaces the Win98 desktop — entries are full pages now, not windows, so
 * there's no taskbar, start menu or window manager left.
 */
export default function SitePage({
  data,
  loadingPostId,
  loadingAuPostId,
  fetchContent,
  fetchAuContent,
  onBackToDesk,
}: SitePageProps) {
  const [entry, setEntry] = useState<SidebarItem | null>(null);
  /** Destination held while the opening transition runs. */
  const [wiping, setWiping] = useState<SidebarItem | null>(null);
  const [wipeKey, setWipeKey] = useState(0);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  // No scroll lock here. The index and the entry pages are both ordinary
  // document-flow pages, so the document has to keep scrolling; only the
  // full-bleed sheets (dossier, reader, lightbox) lock it, and each of those
  // owns its own `overflow-y: auto` and manages the class itself.

  useEffect(() => {
    const hash = entry ? `#/main/${entry.category.toLowerCase()}` : "#/main";
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [entry]);

  const openEntry = useCallback(
    (item: SidebarItem) => {
      if (wiping) return;
      setWipeKey((k) => k + 1);
      setWiping(item);
    },
    [wiping]
  );

  const closeEntry = useCallback(() => setEntry(null), []);

  const indexOf = (item: SidebarItem) =>
    data.sidebarItems.findIndex((s) => s.id === item.id) + 1;

  return (
    <>
      {entry === null && (
        <LandingPage
          data={data}
          clock={clock}
          onOpenItem={openEntry}
          scrollLocked={wiping !== null}
        />
      )}

      {entry !== null &&
        (entry.page === "au" ? (
          <AuEntry
            items={data.au}
            auPosts={data.auPosts}
            loadingAuPostId={loadingAuPostId}
            fetchAuContent={fetchAuContent}
            onBack={closeEntry}
          />
        ) : (
          <EntryPage
            data={data}
            item={entry}
            index={indexOf(entry)}
            loadingPostId={loadingPostId}
            fetchContent={fetchContent}
            onBack={closeEntry}
          />
        ))}

      {wiping && (
        <WordWipe
          key={wipeKey}
          word={wiping.label}
          ink={WIPE_INKS.entry}
          note={`Nº${String(indexOf(wiping)).padStart(3, "0")} — entering`}
          onCovered={() => {
            setEntry(wiping);
            window.scrollTo({ top: 0, behavior: "instant" });
          }}
          onDone={() => setWiping(null)}
        />
      )}

      {/* kept reachable so there's a way back to the boot desk */}
      {entry === null && (
        <button type="button" className={styles.deskButton} onClick={onBackToDesk}>
          ← Desk
        </button>
      )}
    </>
  );
}
