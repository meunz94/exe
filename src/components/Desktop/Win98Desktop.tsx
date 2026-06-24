import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent, AppData, Post, PostWithContent, AuPost, AuPostWithContent, SidebarItem } from "../../types";
import { useWin98Styles } from "../Boot/useWin98Styles";
import Win98Window from "./Win98Window";
import FolderWindow from "./FolderWindow";
import SectionWindow from "./SectionWindow";
import AuWindow from "./AuWindow";
import Popup from "../Popup/Popup";
import PostPopup from "../PostPopup/PostPopup";
import { type SectionDef, type SectionKey } from "./sections";
import iconChannels from "../../assets/windows98-icons/png/channels-0.png";
import iconFolder from "../../assets/windows98-icons/png/directory_closed-0.png";
import iconGlobe from "../../assets/windows98-icons/png/globe_map-0.png";
import iconStart from "../../assets/windows98-icons/png/windows-0.png";
import iconLogoff from "../../assets/windows98-icons/png/key_win-0.png";
import styles from "./Win98Desktop.module.css";

interface Win98DesktopProps {
  data: AppData;
  loadingPostId: string | null;
  loadingAuPostId: string | null;
  fetchContent: (post: Post) => Promise<PostWithContent>;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
  onLogout: () => void;
}

interface OpenWindow {
  id: string;
  kind: "folder" | "section" | "au";
  title: string;
  icon: string;
  category: string;
  label: string;
  synopsis: string;
  sectionKey?: SectionKey;
  width: number;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
}

function iconFor(item: SidebarItem): string {
  if (item.page === "au") return iconGlobe;
  if (item.category === "VB") return iconChannels;
  return iconFolder;
}

export default function Win98Desktop({
  data,
  loadingPostId,
  loadingAuPostId,
  fetchContent,
  fetchAuContent,
  onLogout,
}: Win98DesktopProps) {
  useWin98Styles();

  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [startOpen, setStartOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostWithContent | null>(null);
  const [clock, setClock] = useState("");
  const zRef = useRef(10);
  const nextZ = () => (zRef.current += 1);
  const postSeqRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  // open (or focus/restore) a window with a stable id
  const openWindow = useCallback((win: Omit<OpenWindow, "x" | "y" | "z" | "minimized">) => {
    setStartOpen(false);
    setWindows((ws) => {
      const existing = ws.find((w) => w.id === win.id);
      if (existing) {
        return ws.map((w) => (w.id === win.id ? { ...w, minimized: false, z: nextZ() } : w));
      }
      const offset = ws.length * 26;
      return [...ws, { ...win, x: 48 + offset, y: 36 + offset, z: nextZ(), minimized: false }];
    });
  }, []);

  const openItem = useCallback(
    (item: SidebarItem) => {
      if (item.page === "au") {
        openWindow({
          id: "au",
          kind: "au",
          title: item.label,
          icon: iconGlobe,
          category: item.category,
          label: item.label,
          synopsis: item.synopsis ?? "",
          width: 640,
        });
      } else {
        openWindow({
          id: `folder:${item.category}`,
          kind: "folder",
          title: item.label,
          icon: iconFor(item),
          category: item.category,
          label: item.label,
          synopsis: item.synopsis ?? "",
          width: 420,
        });
      }
    },
    [openWindow]
  );

  const openSection = useCallback(
    (parent: OpenWindow, section: SectionDef) => {
      openWindow({
        id: `section:${parent.category}:${section.key}`,
        kind: "section",
        title: section.label,
        icon: section.icon,
        category: parent.category,
        label: parent.label,
        synopsis: parent.synopsis,
        sectionKey: section.key,
        width: section.width,
      });
    },
    [openWindow]
  );

  const focusWin = useCallback((id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: nextZ() } : w)));
  }, []);

  const closeWin = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const minimizeWin = useCallback((id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const moveWin = useCallback((id: string, x: number, y: number) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const activeId = windows
    .filter((w) => !w.minimized)
    .reduce<OpenWindow | null>((top, w) => (!top || w.z > top.z ? w : top), null)?.id;

  const onTaskBtn = useCallback(
    (w: OpenWindow) => {
      if (w.minimized) {
        setWindows((ws) => ws.map((x) => (x.id === w.id ? { ...x, minimized: false, z: nextZ() } : x)));
      } else if (w.id === activeId) {
        minimizeWin(w.id);
      } else {
        focusWin(w.id);
      }
    },
    [activeId, focusWin, minimizeWin]
  );

  const handleCardClick = useCallback((agent: Agent) => setSelectedAgent(agent), []);

  // archive post windows branch the URL, numbered from 1 as they're opened
  const handlePostClick = useCallback(
    async (post: Post) => {
      const withContent = await fetchContent(post);
      const n = (postSeqRef.current += 1);
      window.history.pushState(null, "", `#/main/archive/${n}`);
      setSelectedPost(withContent);
    },
    [fetchContent]
  );

  const closePost = useCallback(() => {
    // pop the pushed history entry; the popstate handler clears the post
    if (window.location.hash.includes("/archive/")) {
      window.history.back();
    } else {
      setSelectedPost(null);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!window.location.hash.includes("/archive/")) setSelectedPost(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className={styles.desktop} data-win98-root onPointerDown={() => setStartOpen(false)}>
      {/* desktop icons */}
      <div className={styles.iconLayer}>
        {data.sidebarItems.map((item) => (
          <button
            key={item.id}
            className={styles.icon}
            onDoubleClick={() => openItem(item)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <img src={iconFor(item)} alt="" className={styles.iconImg} />
            <span className={styles.iconLabel}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* open windows */}
      <div className={styles.windowLayer}>
        {windows.map((w) => (
          <div key={w.id} style={{ display: w.minimized ? "none" : undefined }}>
            <Win98Window
              title={w.title}
              icon={w.icon}
              x={w.x}
              y={w.y}
              z={w.z}
              width={w.width}
              active={w.id === activeId}
              onFocus={() => focusWin(w.id)}
              onClose={() => closeWin(w.id)}
              onMinimize={() => minimizeWin(w.id)}
              onMove={(x, y) => moveWin(w.id, x, y)}
            >
              {w.kind === "folder" && (
                <FolderWindow
                  data={data}
                  category={w.category}
                  onOpenSection={(section) => openSection(w, section)}
                />
              )}
              {w.kind === "section" && w.sectionKey && (
                <SectionWindow
                  data={data}
                  category={w.category}
                  sectionKey={w.sectionKey}
                  synopsis={w.synopsis}
                  loadingPostId={loadingPostId}
                  onCardClick={handleCardClick}
                  onPostClick={handlePostClick}
                />
              )}
              {w.kind === "au" && (
                <AuWindow
                  items={data.au}
                  auPosts={data.auPosts}
                  loadingAuPostId={loadingAuPostId}
                  fetchAuContent={fetchAuContent}
                />
              )}
            </Win98Window>
          </div>
        ))}
      </div>

      {/* profile / post modals */}
      {selectedAgent && <Popup agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
      {selectedPost && <PostPopup post={selectedPost} onClose={closePost} />}

      {/* start menu */}
      {startOpen && (
        <div className={styles.startMenu} onPointerDown={(e) => e.stopPropagation()}>
          <div className={styles.startBanner}>Limbic&nbsp;OS</div>
          <div className={styles.startItems}>
            {data.sidebarItems.map((item) => (
              <button key={item.id} className={styles.startItem} onClick={() => openItem(item)}>
                <img src={iconFor(item)} alt="" className={styles.startItemIcon} />
                <span>{item.label}</span>
              </button>
            ))}
            <div className={styles.startDivider} />
            <button className={styles.startItem} onClick={onLogout}>
              <img src={iconLogoff} alt="" className={styles.startItemIcon} />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      )}

      {/* taskbar */}
      <div className={styles.taskbar} onPointerDown={(e) => e.stopPropagation()}>
        <button
          className={`${styles.startBtn} ${startOpen ? styles.startBtnActive : ""}`}
          onClick={() => setStartOpen((s) => !s)}
        >
          <img src={iconStart} alt="" className={styles.startBtnIcon} />
          Start
        </button>
        <div className={styles.taskButtons}>
          {windows.map((w) => (
            <button
              key={w.id}
              className={`${styles.taskBtn} ${w.id === activeId && !w.minimized ? styles.taskBtnActive : ""}`}
              onClick={() => onTaskBtn(w)}
            >
              <img src={w.icon} alt="" className={styles.taskBtnIcon} />
              <span className={styles.taskBtnLabel}>{w.title}</span>
            </button>
          ))}
        </div>
        <div className={styles.clock}>{clock}</div>
      </div>
    </div>
  );
}
