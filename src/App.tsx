import { useState, useCallback, useEffect, useRef } from "react";
import type { Agent, Post, PostWithContent } from "./types";
import { useAppData, useFilteredData, useFetchPostContent } from "./data/useAppData";
import { useHashRoute } from "./utils/hashRouter";
import Sidebar from "./components/Sidebar/Sidebar";
import Popup from "./components/Popup/Popup";
import PostPopup from "./components/PostPopup/PostPopup";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle";
import MainPage from "./pages/MainPage";
import AuPage from "./pages/AuPage";
import WaveBackground from "./components/BackgroundEffect/WaveBackground";
import DarkBackground from "./components/BackgroundEffect/DarkBackground";
import AuBackground from "./components/BackgroundEffect/AuBackground";
import appStyles from "./App.module.css";
import "./index.css";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const { data, loading, error } = useAppData();
  const { fetchContent, loadingPostId } = useFetchPostContent();
  const [route, navigate] = useHashRoute();

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostWithContent | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const lastCategoryRef = useRef("");

  const activeCategory = (() => {
    if (route.page === "main" && route.category) {
      return route.category;
    }
    if (route.page === "au") {
      const item = data.sidebarItems.find((si) => si.page === "au");
      return item?.category ?? "";
    }
    if (route.page === "item") {
      return route.category;
    }
    return data.sidebarItems[0]?.category ?? "";
  })();

  const currentPage = route.page === "au" ? "au" as const : "main" as const;

  useEffect(() => {
    if (route.page === "main" && activeCategory) {
      lastCategoryRef.current = activeCategory;
    }
  }, [route.page, activeCategory]);

  useEffect(() => {
    if (!loading && data.sidebarItems.length > 0 && route.page === "main" && !route.category) {
      navigate({ page: "main", category: data.sidebarItems[0].category }, true);
    }
  }, [loading, data.sidebarItems, route, navigate]);

  useEffect(() => {
    if (loading) return;
    let ignore = false;

    if (route.page === "item") {
      const post = data.posts.find((p) => p.id === route.itemId);
      const agent = data.agents.find((a) => a.id === route.itemId);

      if (post) {
        setSelectedAgent(null);
        fetchContent(post).then((withContent) => {
          if (!ignore) setSelectedPost(withContent);
        });
      } else if (agent) {
        setSelectedPost(null);
        setSelectedAgent(agent);
      } else {
        setSelectedAgent(null);
        setSelectedPost(null);
        navigate({ page: "main", category: route.category }, true);
      }
    } else {
      setSelectedAgent(null);
      setSelectedPost(null);
    }

    return () => { ignore = true; };
  }, [route, data, loading, fetchContent, navigate]);

  const { sidebarItems, agents, posts, boards, playlist, timeline, disciplinary, au } =
    useFilteredData(data, activeCategory);

  const activeLabel = data.sidebarItems.find((si) => si.category === activeCategory)?.label ?? "";

  const handleCategoryChange = useCallback(
    (category: string) => {
      const item = data.sidebarItems.find((si) => si.category === category);
      if (item?.page === "au") {
        navigate({ page: "au" });
      } else {
        navigate({ page: "main", category });
      }
    },
    [data.sidebarItems, navigate]
  );

  const handleBackToMain = useCallback(() => {
    const firstNonAu = data.sidebarItems.find((si) => !si.page);
    navigate({ page: "main", category: firstNonAu?.category });
  }, [data.sidebarItems, navigate]);

  const handleCardClick = useCallback((agent: Agent) => {
    navigate({ page: "item", category: agent.category, itemId: agent.id });
  }, [navigate]);

  const handlePopupClose = useCallback(() => {
    navigate({ page: "main", category: lastCategoryRef.current || activeCategory }, true);
  }, [navigate, activeCategory]);

  const handlePostClick = useCallback(
    (post: Post) => {
      navigate({ page: "item", category: post.category, itemId: post.id });
    },
    [navigate]
  );

  const handlePostPopupClose = useCallback(() => {
    navigate({ page: "main", category: lastCategoryRef.current || activeCategory }, true);
  }, [navigate, activeCategory]);

  const handleContentVisible = useCallback((visible: boolean) => {
    setSidebarVisible(visible);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#999" }}>
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#e55" }}>
        데이터 로드 실패: {error}
      </div>
    );
  }

  return (
    <div className={currentPage === "main" ? appStyles.snapContainer : appStyles.normalContainer}>
      {currentPage === "au" ? (
        <AuBackground />
      ) : (
        <>
          <WaveBackground />
          <DarkBackground />
        </>
      )}
      <ThemeToggle />
      {!isMobile && (
        <Sidebar
          items={sidebarItems}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          visible={currentPage === "au" || sidebarVisible}
        />
      )}

      <div
        style={{
          marginRight: isMobile ? 0 : "var(--sidebar-width)",
        }}
      >
        {currentPage === "main" ? (
          <MainPage
            activeLabel={activeLabel}
            agents={agents}
            posts={posts}
            boards={boards}
            playlist={playlist}
            timeline={timeline}
            disciplinary={disciplinary}
            onCardClick={handleCardClick}
            onPostClick={handlePostClick}
            loadingPostId={loadingPostId}
            onContentVisible={handleContentVisible}
          />
        ) : (
          <AuPage items={au} onBack={handleBackToMain} />
        )}
      </div>

      {isMobile && (
        <Sidebar
          items={sidebarItems}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          visible={currentPage === "au" || sidebarVisible}
        />
      )}

      {selectedAgent && (
        <Popup agent={selectedAgent} onClose={handlePopupClose} />
      )}

      {selectedPost && (
        <PostPopup post={selectedPost} onClose={handlePostPopupClose} />
      )}
    </div>
  );
}
