import { useState, useCallback, useEffect } from "react";
import type { Employee, Post, PostWithContent } from "./types";
import { useAppData, useFilteredData, useFetchPostContent } from "./data/useAppData";
import Sidebar from "./components/Sidebar/Sidebar";
import Popup from "./components/Popup/Popup";
import PostPopup from "./components/PostPopup/PostPopup";
import ThemeToggle from "./components/ThemeToggle/ThemeToggle";
import MainPage from "./pages/MainPage";
import PortfolioPage from "./pages/PortfolioPage";
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
  const [activeCategory, setActiveCategory] = useState("");
  const [currentPage, setCurrentPage] = useState<"main" | "portfolio">("main");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostWithContent | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    if (data.sidebarItems.length > 0 && !activeCategory) {
      setActiveCategory(data.sidebarItems[0].category);
    }
  }, [data.sidebarItems, activeCategory]);

  const { sidebarItems, employees, posts, boards, playlist, timeline, disciplinary, portfolio } =
    useFilteredData(data, activeCategory);

  const activeLabel = data.sidebarItems.find((si) => si.category === activeCategory)?.label ?? "";

  const handleCategoryChange = useCallback(
    (category: string) => {
      const item = data.sidebarItems.find((si) => si.category === category);
      if (item?.page === "portfolio") {
        setCurrentPage("portfolio");
      } else {
        setCurrentPage("main");
      }
      setActiveCategory(category);
    },
    [data.sidebarItems]
  );

  const handleBackToMain = useCallback(() => {
    const firstNonPortfolio = data.sidebarItems.find((si) => !si.page);
    if (firstNonPortfolio) {
      setActiveCategory(firstNonPortfolio.category);
    }
    setCurrentPage("main");
  }, [data.sidebarItems]);

  const handleCardClick = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
  }, []);

  const handlePopupClose = useCallback(() => {
    setSelectedEmployee(null);
  }, []);

  const handlePostClick = useCallback(
    async (post: Post) => {
      const withContent = await fetchContent(post);
      setSelectedPost(withContent);
    },
    [fetchContent]
  );

  const handlePostPopupClose = useCallback(() => {
    setSelectedPost(null);
  }, []);

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
      <ThemeToggle />
      {!isMobile && (
        <Sidebar
          items={sidebarItems}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          visible={currentPage === "portfolio" || sidebarVisible}
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
            employees={employees}
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
          <PortfolioPage items={portfolio} onBack={handleBackToMain} />
        )}
      </div>

      {isMobile && (
        <Sidebar
          items={sidebarItems}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          visible={currentPage === "portfolio" || sidebarVisible}
        />
      )}

      {selectedEmployee && (
        <Popup employee={selectedEmployee} onClose={handlePopupClose} />
      )}

      {selectedPost && (
        <PostPopup post={selectedPost} onClose={handlePostPopupClose} />
      )}
    </div>
  );
}
