import { useRef, useEffect, useState, useCallback } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Agent, Post, Board, PlaylistItem, TimelineEvent, DisciplinaryRecord, GalleryImage, YoutubeVideo } from "../types";
import type { Components } from "react-markdown";
import { fixCjkEmphasis } from "../utils/markdown";
import AgentCard from "../components/AgentCard/AgentCard";
import Terminal from "../components/Terminal/Terminal";
import PostList from "../components/PostList/PostList";
import Playlist from "../components/Playlist/Playlist";
import Timeline from "../components/Timeline/Timeline";
import YoutubePlayer from "../components/YoutubePlayer/YoutubePlayer";
import Gallery from "../components/Gallery/Gallery";
import styles from "./MainPage.module.css";
import { publicUrl } from "../utils/publicUrl";

function getScrollParent(el: HTMLElement): HTMLElement {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}

interface MainPageProps {
  activeLabel: string;
  activeSynopsis: string;
  agents: Agent[];
  posts: Post[];
  boards: Board[];
  playlist: PlaylistItem[];
  timeline: TimelineEvent[];
  disciplinary: DisciplinaryRecord[];
  gallery: GalleryImage[];
  youtube: YoutubeVideo[];
  onCardClick: (agent: Agent) => void;
  onPostClick: (post: Post) => void;
  loadingPostId: string | null;
  onContentVisible?: (visible: boolean) => void;
}

export default function MainPage({
  activeLabel,
  activeSynopsis,
  agents,
  posts,
  boards,
  playlist,
  timeline,
  disciplinary,
  gallery,
  youtube,
  onCardClick,
  onPostClick,
  loadingPostId,
  onContentVisible,
}: MainPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [noticeContent, setNoticeContent] = useState("");
  const [contentVisible, setContentVisible] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoContent, setMemoContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [neighborsOpen, setNeighborsOpen] = useState(false);
  const [neighbors, setNeighbors] = useState<{ name: string; image: string; url: string }[]>([]);

  const handleCopySection = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const h3 = btn.parentElement;
    if (!h3) return;

    let text = "";
    let sibling = h3.nextElementSibling;
    while (sibling && sibling.tagName !== "H3" && sibling.tagName !== "HR") {
      text += (sibling.textContent || "") + "\n";
      sibling = sibling.nextElementSibling;
    }
    text = text.trim();

    navigator.clipboard.writeText(text).then(() => {
      const span = h3.querySelector("span");
      setCopiedId(span?.textContent || "");
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const memoComponents: Components = {
    h3: ({ children, ...props }) => (
      <h3 {...props} className={styles.memoH3}>
        <span>{children}</span>
        <button
          className={`${styles.memoCopyBtn} ${copiedId === String(children) ? styles.memoCopyBtnDone : ""}`}
          onClick={handleCopySection}
          type="button"
        >
          {copiedId === String(children) ? "복사됨!" : "복사하기"}
        </button>
      </h3>
    ),
  };

  useEffect(() => {
    let cancelled = false;
    fetch(publicUrl("data/notice.md"))
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => { if (!cancelled) setNoticeContent(text); })
      .catch(() => {});
    fetch(publicUrl("data/memo.md"))
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => { if (!cancelled) setMemoContent(text); })
      .catch(() => {});
    fetch(publicUrl("data/neighbors.json"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setNeighbors(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!onContentVisible || !contentRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setContentVisible(entry.isIntersecting);
        onContentVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [onContentVisible]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const scrollEl = getScrollParent(contentEl);
    let lastY = scrollEl.scrollTop;
    let locked = false;
    let snapped = false;

    const onScroll = () => {
      if (locked) return;
      const y = scrollEl.scrollTop;
      const down = y > lastY;
      lastY = y;

      const { top } = contentEl.getBoundingClientRect();

      if (down && !snapped && top < window.innerHeight - 60) {
        locked = true;
        snapped = true;
        contentEl.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => { locked = false; }, 800);
        return;
      }

      if (!down && snapped && top > window.innerHeight + 50) {
        snapped = false;
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={styles.main}>
      <section className={styles.noticeSection}>
        <h2 className={styles.noticeTitle}>TOP SECRET<br />DOCUMENTS</h2>
        <div className={styles.noticeBox}>
          {noticeContent ? (
            <div className={styles.noticeMarkdown}>
              <Markdown rehypePlugins={[rehypeRaw]}>
                {fixCjkEmphasis(noticeContent.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
              </Markdown>
            </div>
          ) : (
            <p className={styles.noticeEmpty}>등록된 공지사항이 없습니다.</p>
          )}
        </div>

        <div className={styles.memoToggle}>
          <button
            className={`${styles.memoToggleBtn} ${memoOpen ? styles.memoToggleBtnOpen : ""}`}
            onClick={() => setMemoOpen((v) => !v)}
          >
            <span className={styles.memoToggleIcon}>{memoOpen ? "▲" : "▼"}</span>
            <span>{memoOpen ? "닫기" : "프롬프트"}</span>
          </button>
          <button
            className={`${styles.memoToggleBtn} ${neighborsOpen ? styles.memoToggleBtnOpen : ""}`}
            onClick={() => setNeighborsOpen((v) => !v)}
          >
            <span className={styles.memoToggleIcon}>{neighborsOpen ? "▲" : "▼"}</span>
            <span>{neighborsOpen ? "닫기" : "이웃집 둘러보기"}</span>
          </button>
        </div>

        <div className={`${styles.memoPanel} ${memoOpen ? styles.memoPanelOpen : ""}`}>
          <div className={styles.memoContent}>
            {memoContent ? (
              <div className={styles.noticeMarkdown}>
                <Markdown rehypePlugins={[rehypeRaw]} components={memoComponents}>
                  {fixCjkEmphasis(memoContent.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
                </Markdown>
              </div>
            ) : (
              <p className={styles.noticeEmpty}>등록된 메모가 없습니다.</p>
            )}
          </div>
        </div>

        <div className={`${styles.memoPanel} ${neighborsOpen ? styles.memoPanelOpen : ""}`}>
          <div className={styles.memoContent}>
            {neighbors.length > 0 ? (
              <div className={styles.neighborsGrid}>
                {neighbors.map((n, i) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.neighborItem}
                  >
                    <img
                      src={publicUrl(n.image)}
                      alt={n.name}
                      className={styles.neighborImg}
                    />
                    {n.name && <span className={styles.neighborName}>{n.name}</span>}
                  </a>
                ))}
              </div>
            ) : (
              <p className={styles.noticeEmpty}>등록된 이웃이 없습니다.</p>
            )}
          </div>
        </div>
      </section>

      <div className={`${styles.scrollHint} ${contentVisible ? styles.scrollHintHidden : ""}`}>
        <span>SCROLL</span>
        <div className={styles.scrollArrow} />
      </div>

      <section ref={contentRef} className={styles.contentSection}>
        <div className={styles.contentInner}>
          <div className={styles.cardsWrapper}>
            <div className={styles.cardsLabel}>
              <span className={styles.cardsLabelLine} />
              <span className={styles.cardsLabelText}>{activeLabel}</span>
              <span className={styles.cardsLabelLine} />
            </div>
            {activeSynopsis && (
              <p className={styles.cardsSynopsis}>{activeSynopsis}</p>
            )}
            <div className={styles.cardsSection}>
              {agents.map((a) => (
                <AgentCard key={a.id} agent={a} onClick={onCardClick} />
              ))}
            </div>
            <div className={styles.cardsLabelBottom}>
              <span className={styles.cardsLabelLine} />
              <span className={styles.cardsBottomText}>CLICK TO VIEW FULL PROFILE</span>
              <span className={styles.cardsLabelLine} />
            </div>
          </div>

          <div className={styles.terminalSection}>
            <Terminal records={disciplinary} />
          </div>

          <div className={styles.postsSection}>
            <PostList
              posts={posts}
              boards={boards}
              onPostClick={onPostClick}
              loadingPostId={loadingPostId}
            />
          </div>

          <div className={styles.playlistSection}>
            <Playlist items={playlist} />
          </div>

          <div className={styles.timelineSection}>
            <Timeline events={timeline} />
          </div>

          <div className={styles.youtubeSection}>
            <YoutubePlayer videos={youtube} />
          </div>

          <div className={styles.gallerySection}>
            <Gallery images={gallery} />
          </div>
        </div>
      </section>
    </div>
  );
}
