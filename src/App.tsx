import { useState, useEffect } from "react";
import { useAppData } from "./data/useAppData";
import TerminalFlood from "./components/Boot/TerminalFlood";
import { loadLines } from "./components/Boot/floodScripts";
import CRTOverlay from "./components/CRT/CRTOverlay";
import EntryScreen from "./pages/EntryScreen";
import HubPage from "./pages/HubPage";
import FloppyPage from "./pages/FloppyPage";
import WalkmanPage from "./pages/WalkmanPage";
import PapersPage from "./pages/PapersPage";
import NintendoPage from "./pages/NintendoPage";
import PcPage from "./pages/PcPage";
import { HUB_SECTIONS, type HubSection } from "./types/screens";
import "./index.css";

/**
 * entry   — dark room, the warning label; click to boot
 * loading — Win98-blue load readout covering the cut to the hub
 * hub     — the 3D desk; pick a device
 * <section> — one per device (placeholders until their builds land)
 */
type Screen = "entry" | "loading" | "hub" | HubSection;

function screenFromPath(pathname: string): Screen {
  const seg = pathname.replace(/^\/+/, "").split("/")[0];
  if (seg === "hub") return "hub";
  if ((HUB_SECTIONS as string[]).includes(seg)) return seg as HubSection;
  return "entry";
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function useClock(): string {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock(new Date())), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return clock;
}

export default function App() {
  const { data } = useAppData();
  const clock = useClock();

  const [screen, setScreen] = useState<Screen>(() =>
    screenFromPath(window.location.pathname)
  );

  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // Each screen is its own history entry so the browser back button walks
  // the site instead of leaving it. `loading` is transient and never gets an
  // entry of its own.
  useEffect(() => {
    if (screen === "loading") return;
    const path = screen === "entry" ? "/" : `/${screen}`;
    // /nintendo/<chipId> deep paths belong to NintendoPage — don't clobber
    // them from here.
    const current = window.location.pathname;
    const covered =
      screen === "nintendo" || screen === "papers" || screen === "pc"
        ? current.startsWith(path)
        : current === path;
    if (!covered) {
      window.history.pushState(null, "", path);
    }
  }, [screen]);

  useEffect(() => {
    const onPop = () => setScreen(screenFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  let content;
  if (screen === "entry") {
    content = <EntryScreen onEnter={() => setScreen("loading")} />;
  } else if (screen === "loading") {
    content = (
      <TerminalFlood
        skin="blue"
        lines={loadLines({
          chips: data.sidebarItems.length + data.au.length,
          tracks: data.playlist.length,
          frames: data.gallery.length,
          posts: data.posts.length,
        })}
        speed={80}
        onDone={() => setScreen("hub")}
      />
    );
  } else if (screen === "hub") {
    content = <HubPage clock={clock} onOpen={setScreen} />;
  } else if (screen === "floppy") {
    content = <FloppyPage onBack={() => setScreen("hub")} />;
  } else if (screen === "walkman") {
    content = <WalkmanPage playlist={data.playlist} onBack={() => setScreen("hub")} />;
  } else if (screen === "papers") {
    content = <PapersPage onBack={() => setScreen("hub")} />;
  } else if (screen === "nintendo") {
    content = <NintendoPage data={data} onBack={() => setScreen("hub")} />;
  } else {
    content = <PcPage data={data} onBack={() => setScreen("hub")} />;
  }

  return (
    <>
      {content}
      <CRTOverlay />
    </>
  );
}
