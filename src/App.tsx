import { useState, useEffect } from "react";
import { useAppData, useFetchPostContent, useFetchAuPostContent } from "./data/useAppData";
import GuestPage from "./pages/GuestPage";
import BootScreen, { type AuthUser } from "./components/Boot/BootScreen";
import Win98Desktop from "./components/Desktop/Win98Desktop";
import "./index.css";

export default function App() {
  const { data, loading, error } = useAppData();
  const { fetchContent, loadingPostId } = useFetchPostContent();
  const { fetchAuContent, loadingAuPostId } = useFetchAuPostContent();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // reflect the auth stage in the URL so boot / vance / guest are distinct
  useEffect(() => {
    const hash = authUser === "vance" ? "#/main" : authUser === "guest" ? "#/guest" : "#/";
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [authUser]);

  if (!authUser) {
    return <BootScreen onLogin={setAuthUser} />;
  }

  if (authUser === "guest") {
    return <GuestPage />;
  }

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
    <Win98Desktop
      data={data}
      loadingPostId={loadingPostId}
      loadingAuPostId={loadingAuPostId}
      fetchContent={fetchContent}
      fetchAuContent={fetchAuContent}
      onLogout={() => setAuthUser(null)}
    />
  );
}
