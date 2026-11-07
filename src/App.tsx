import { useEffect, useMemo, useState } from "react";
import { PairRippleProvider, usePairRipple } from "./components/PairRipple";
import { BgmProvider } from "./lib/bgm";
import { useJson } from "./lib/data";
import { pairPath } from "./lib/site";
import type { Track } from "./lib/types";
import { loadJson } from "./lib/data";
import { RouterProvider, useRouter } from "./lib/router";
import { SiteProvider, useSite } from "./lib/site";
import { useTheme } from "./lib/theme";
import type { Pair, Site } from "./lib/types";
import { Landing } from "./pages/Landing";
import { Profile } from "./pages/Profile";
import { SubjectPage } from "./pages/Subject";
import { Timeline } from "./pages/Timeline";
import { Story } from "./pages/Story";
import { StoryView } from "./pages/StoryView";
import { Log } from "./pages/Log";
import { LogView } from "./pages/LogView";
import { Diary } from "./pages/Diary";
import { Au } from "./pages/Au";
import { AuChips } from "./pages/AuChips";
import { Gallery } from "./pages/Gallery";
import { Links } from "./pages/Links";

export default function App() {
  const [site, setSite] = useState<Site | null>(null);
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    Promise.all([loadJson<Site>("site.json"), loadJson<Pair[]>("pairs.json")])
      .then(([s, p]) => {
        setSite(s);
        setPairs(p);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const pairIds = useMemo(() => (pairs ?? []).map((p) => p.id), [pairs]);

  if (error) return <p className="mono" style={{ padding: 48 }}>데이터를 불러오지 못했어요 — {error}</p>;
  if (!site || !pairs || pairs.length === 0) return null;

  return (
    <RouterProvider pairIds={pairIds} defaultPair={site.defaultPair}>
      <SiteProvider site={site} pairs={pairs} theme={theme} toggleTheme={toggleTheme}>
        <Shell />
      </SiteProvider>
    </RouterProvider>
  );
}

function Shell() {
  const { route } = useRouter();
  const { pair, theme } = useSite();
  const accent = theme === "dark" ? pair.accentDark : pair.accent;
  // BGM 은 앱 전체에서 하나 — 페이지를 옮겨도 이어지고, 페어가 바뀌면 그 페어의 목록으로 넘어간다
  const playlist = useJson<Track[]>(pairPath(pair, "playlist.json"), []);

  let page: React.ReactNode;
  switch (route.section) {
    case "":
      page = <Landing key={pair.id} />;
      break;
    case "profile":
      page = route.id ? <SubjectPage key={route.id} id={route.id} /> : <Profile />;
      break;
    case "timeline":
      page = <Timeline />;
      break;
    case "story":
      page = route.id ? <StoryView id={route.id} /> : <Story />;
      break;
    case "log":
      page = route.id ? <LogView id={route.id} /> : <Log />;
      break;
    case "diary":
      page = <Diary id={route.id} />;
      break;
    case "au":
      page = route.id === "chips" ? <AuChips chipId={route.sub} /> : <Au />;
      break;
    case "gallery":
      page = <Gallery />;
      break;
    case "links":
      page = <Links />;
      break;
    default:
      page = <NotFound />;
  }

  return (
    <BgmProvider tracks={playlist}>
      <PairRippleProvider>
        <div className="app" style={{ "--accent": accent } as React.CSSProperties} data-section={route.section || "landing"}>
          <PageFade routeKey={`${route.pairId}/${route.section}/${route.id}`} path={route.path}>
            {page}
          </PageFade>
        </div>
      </PairRippleProvider>
    </BgmProvider>
  );
}

/** 페이지 전환 페이드인. 페어 전환 파동으로 들어온 페이지는 파동이 대신하므로 페이드하지 않는다 */
function PageFade({ routeKey, path, children }: { routeKey: string; path: string; children: React.ReactNode }) {
  const { noFadePath } = usePairRipple();
  return (
    <div key={routeKey} className={noFadePath === path ? "page-fade no-fade" : "page-fade"}>
      {children}
    </div>
  );
}

function NotFound() {
  return (
    <div className="page center-page">
      <h1 className="page-title">404</h1>
      <span className="page-sub">없는 페이지예요.</span>
    </div>
  );
}
