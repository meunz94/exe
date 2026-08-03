import { useState, useEffect, useCallback } from "react";
import { useAppData, useFetchPostContent, useFetchAuPostContent } from "./data/useAppData";
import BootScreen from "./components/Boot/BootScreen";
import SitePage from "./pages/SitePage";
import TerminalFlood from "./components/Boot/TerminalFlood";
import {
  bootHead,
  bootLines,
  identityHead,
  identityLines,
} from "./components/Boot/floodScripts";
import InfoPage from "./pages/InfoPage";
import PromptPage from "./pages/PromptPage";
import CRTOverlay from "./components/CRT/CRTOverlay";
import "./index.css";

/**
 * boot   — the desk; pick an icon
 * flood  — a terminal readout covering the cut to `pending`
 * info   — the notice + neighbours document
 * prompt — the generation-prompt document
 * site   — the archive itself
 */
type Screen = "boot" | "flood" | "info" | "prompt" | "site";

export default function App() {
  const { data, loading, error } = useAppData();
  const { fetchContent, loadingPostId } = useFetchPostContent();
  const { fetchAuContent, loadingAuPostId } = useFetchAuPostContent();

  const [screen, setScreen] = useState<Screen>("boot");
  /** Where the running flood is headed. */
  const [pending, setPending] = useState<Exclude<Screen, "boot" | "flood">>("site");
  /** Once the machine has been switched on, it stays on for the session. */
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // Reflect the current screen in the URL so each one is distinct in history.
  useEffect(() => {
    const path =
      screen === "site" ? "/main" : screen === "boot" || screen === "flood" ? "/" : `/${screen}`;
    if (!window.location.pathname.startsWith(path)) {
      window.history.replaceState(null, "", path);
    }
  }, [screen]);

  const runFlood = useCallback((to: Exclude<Screen, "boot" | "flood">) => {
    setBooted(true);
    setPending(to);
    setScreen("flood");
  }, []);

  const backToDesk = useCallback(() => setScreen("boot"), []);

  if (screen === "flood") {
    const toSite = pending === "site";
    return (
      <>
        <TerminalFlood
          skin={toSite ? "green" : "amber"}
          head={
            toSite
              ? bootHead(data.sidebarItems.length, data.gallery.length)
              : identityHead(pending.toUpperCase())
          }
          lines={
            toSite
              ? bootLines({
                  entries: data.sidebarItems.map((s) => ({
                    label: s.label,
                    category: s.category,
                  })),
                  posts: data.posts.length,
                  frames: data.gallery.length,
                  tracks: data.playlist.length,
                })
              : identityLines(pending === "info" ? "INFO" : "PROMPT")
          }
          speed={toSite ? 85 : 95}
          onDone={() => setScreen(pending)}
        />
        <CRTOverlay />
      </>
    );
  }

  let content;
  if (screen === "boot") {
    content = (
      <BootScreen
        alreadyOn={booted}
        // LOVE dives through the glass, then the boot log plays.
        onEnter={() => runFlood("site")}
        onOpenDoc={runFlood}
      />
    );
  } else if (screen === "info") {
    content = <InfoPage onBack={backToDesk} />;
  } else if (screen === "prompt") {
    content = <PromptPage onBack={backToDesk} />;
  } else if (loading) {
    content = <StatusScreen>불러오는 중...</StatusScreen>;
  } else if (error) {
    content = <StatusScreen tone="error">데이터 로드 실패: {error}</StatusScreen>;
  } else {
    content = (
      <SitePage
        data={data}
        loadingPostId={loadingPostId}
        loadingAuPostId={loadingAuPostId}
        fetchContent={fetchContent}
        fetchAuContent={fetchAuContent}
        onBackToDesk={backToDesk}
      />
    );
  }

  return (
    <>
      {content}
      <CRTOverlay />
    </>
  );
}

function StatusScreen({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: "0.75rem",
        color: tone === "error" ? "var(--px-red)" : "var(--color-text-muted)",
      }}
    >
      {children}
    </div>
  );
}
