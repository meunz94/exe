import { useCallback, useState } from "react";
import type { AuItem, AuPost, AuPostWithContent } from "../../types";
import type { Route } from "../../utils/hashRouter";
import AuPage from "../../pages/AuPage";
import PostPopup from "../PostPopup/PostPopup";

interface AuWindowProps {
  items: AuItem[];
  auPosts: AuPost[];
  loadingAuPostId: string | null;
  fetchAuContent: (post: AuPost) => Promise<AuPostWithContent>;
}

/**
 * Wraps AuPage for the desktop. AuPage was built around the hash router; here we
 * give it a local route adapter so its item/post navigation works inside a
 * single window without touching the global URL.
 */
export default function AuWindow({ items, auPosts, loadingAuPostId, fetchAuContent }: AuWindowProps) {
  const [auId, setAuId] = useState<string | null>(null);
  const [selectedAuPost, setSelectedAuPost] = useState<AuPostWithContent | null>(null);

  const navigate = useCallback(
    async (route: Route) => {
      if (route.page === "au-item") {
        setAuId(route.auId);
        setSelectedAuPost(null);
      } else if (route.page === "au-post") {
        setAuId(route.auId);
        const post = auPosts.find((p) => p.id === route.postId);
        if (post) setSelectedAuPost(await fetchAuContent(post));
      } else {
        setAuId(null);
        setSelectedAuPost(null);
      }
    },
    [auPosts, fetchAuContent]
  );

  return (
    <>
      <AuPage
        items={items}
        auPosts={auPosts}
        selectedAuId={auId}
        loadingAuPostId={loadingAuPostId}
        navigate={navigate}
        onBack={() => navigate({ page: "au" })}
      />

      {selectedAuPost && (
        <PostPopup
          post={{ ...selectedAuPost, author: "", category: "", boardId: "" }}
          onClose={() => setSelectedAuPost(null)}
        />
      )}
    </>
  );
}
