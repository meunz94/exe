import { useAppData, useFetchPostContent, useFetchAuPostContent } from "../data/useAppData";
import Win98Desktop from "../components/Desktop/Win98Desktop";

interface GuestPageProps {
  onLogout: () => void;
}

/**
 * Guest desktop — same Win98 desktop as the main (vance) page, but its
 * sidebar/agents come from data/guest.json. Posts, playlist, timeline, and
 * gallery are shared with the main data pipeline and filtered by the guest
 * categories (G1, G2).
 */
export default function GuestPage({ onLogout }: GuestPageProps) {
  const { data, loading, error } = useAppData("data/guest.json");
  const { fetchContent, loadingPostId } = useFetchPostContent();
  const { fetchAuContent, loadingAuPostId } = useFetchAuPostContent();

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
      onLogout={onLogout}
      routeBase="guest"
    />
  );
}
