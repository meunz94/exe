import { useRef, useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { Agent, Post, Board, PlaylistItem, TimelineEvent, DisciplinaryRecord } from "../types";
import AgentCard from "../components/AgentCard/AgentCard";
import Terminal from "../components/Terminal/Terminal";
import PostList from "../components/PostList/PostList";
import Playlist from "../components/Playlist/Playlist";
import Timeline from "../components/Timeline/Timeline";
import styles from "./MainPage.module.css";
import { publicUrl } from "../utils/publicUrl";

interface MainPageProps {
  activeLabel: string;
  agents: Agent[];
  posts: Post[];
  boards: Board[];
  playlist: PlaylistItem[];
  timeline: TimelineEvent[];
  disciplinary: DisciplinaryRecord[];
  onCardClick: (agent: Agent) => void;
  onPostClick: (post: Post) => void;
  loadingPostId: string | null;
  onContentVisible?: (visible: boolean) => void;
}

export default function MainPage({
  activeLabel,
  agents,
  posts,
  boards,
  playlist,
  timeline,
  disciplinary,
  onCardClick,
  onPostClick,
  loadingPostId,
  onContentVisible,
}: MainPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [noticeContent, setNoticeContent] = useState("");
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(publicUrl("data/notice.md"))
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => { if (!cancelled) setNoticeContent(text); })
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

  return (
    <div className={styles.main}>
      <section className={styles.noticeSection}>
        <h2 className={styles.noticeTitle}>TOP SECRET<br />DOCUMENTS</h2>
        <div className={styles.noticeBox}>
          {noticeContent ? (
            <div className={styles.noticeMarkdown}>
              <Markdown rehypePlugins={[rehypeRaw]}>
                {noticeContent.replace(/\n---(\n|$)/g, "\n\n---\n\n")}
              </Markdown>
            </div>
          ) : (
            <p className={styles.noticeEmpty}>등록된 공지사항이 없습니다.</p>
          )}
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
        </div>
      </section>
    </div>
  );
}
