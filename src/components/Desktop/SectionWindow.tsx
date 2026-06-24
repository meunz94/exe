import type { Agent, AppData, Post } from "../../types";
import { useFilteredData } from "../../data/useAppData";
import AgentCard from "../AgentCard/AgentCard";
import Terminal from "../Terminal/Terminal";
import PostList from "../PostList/PostList";
import Playlist from "../Playlist/Playlist";
import Timeline from "../Timeline/Timeline";
import YoutubePlayer from "../YoutubePlayer/YoutubePlayer";
import Gallery from "../Gallery/Gallery";
import type { SectionKey } from "./sections";
import styles from "./Win98Desktop.module.css";

interface SectionWindowProps {
  data: AppData;
  category: string;
  sectionKey: SectionKey;
  synopsis: string;
  loadingPostId: string | null;
  onCardClick: (agent: Agent) => void;
  onPostClick: (post: Post) => void;
}

/** Renders a single category section as standalone window content. */
export default function SectionWindow({
  data,
  category,
  sectionKey,
  synopsis,
  loadingPostId,
  onCardClick,
  onPostClick,
}: SectionWindowProps) {
  const f = useFilteredData(data, category);

  switch (sectionKey) {
    case "profile":
      return (
        <div className={styles.profileSection}>
          {synopsis && <p className={styles.profileSynopsis}>{synopsis}</p>}
          <div className={styles.profileCards}>
            {f.agents.map((a) => (
              <AgentCard key={a.id} agent={a} onClick={onCardClick} />
            ))}
          </div>
        </div>
      );
    case "disciplinary":
      return <Terminal records={f.disciplinary} />;
    case "archive":
      return (
        <PostList
          posts={f.posts}
          boards={f.boards}
          onPostClick={onPostClick}
          loadingPostId={loadingPostId}
        />
      );
    case "music":
      return <Playlist items={f.playlist} />;
    case "timeline":
      return (
        <div className={styles.sectionPad}>
          <Timeline events={f.timeline} />
        </div>
      );
    case "video":
      return (
        <div className={styles.sectionPad}>
          <YoutubePlayer videos={f.youtube} />
        </div>
      );
    case "gallery":
      return <Gallery images={f.gallery} />;
    default:
      return null;
  }
}
