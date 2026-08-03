import { useCallback, useState } from "react";
import type { AuItem, AuPost, AuPostWithContent } from "../../types";
import type { Route } from "../../utils/routes";
import AuPage from "../AuPage";
import PostReader from "./PostReader";
import styles from "../EntryPage.module.css";

interface AuEntryProps {
  items: AuItem[];
  auPosts: AuPost[];
  loadingAuPostId: string | null;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
  onBack: () => void;
}

/**
 * The AU entry. Unlike the other entries this one has its own page rather than
 * the four-section split — it's a browsable set of universes, not one story's
 * material.
 *
 * AuPage was written against the old router, so it gets a local route adapter:
 * navigation stays inside this component instead of touching the global URL.
 */
export default function AuEntry({
  items,
  auPosts,
  loadingAuPostId,
  fetchAuContent,
  onBack,
}: AuEntryProps) {
  const [auId, setAuId] = useState<string | null>(null);
  const [post, setPost] = useState<AuPostWithContent | null>(null);

  const navigate = useCallback(
    async (route: Route) => {
      if (route.page === "au-item") {
        setAuId(route.auId);
        setPost(null);
      } else if (route.page === "au-post") {
        setAuId(route.auId);
        const found = auPosts.find((p) => p.id === route.postId);
        if (found) setPost(await fetchAuContent(found));
      } else {
        setAuId(null);
        setPost(null);
      }
    },
    [auPosts, fetchAuContent]
  );

  return (
    <div className={styles.page} data-dark-bg>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Index
        </button>
        <span className={styles.barSpacer} />
        <span className={styles.barMeta}>AU / {items.length} universes</span>
      </div>

      <AuPage
        items={items}
        auPosts={auPosts}
        selectedAuId={auId}
        loadingAuPostId={loadingAuPostId}
        navigate={navigate}
        onBack={() => navigate({ page: "au" })}
      />

      {post && (
        <PostReader
          post={{ ...post, author: "", category: "", boardId: "AU" }}
          onClose={() => setPost(null)}
        />
      )}
    </div>
  );
}
