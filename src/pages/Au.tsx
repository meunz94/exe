import { Suspense, lazy, useEffect } from "react";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { useRouter } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { AuChip } from "../lib/types";

const MonitorScene = lazy(() => import("../au/MonitorScene"));

/** § 06 AU — 흰 바탕에 PC 한 대. 호버하면 조명이 비치고 화면이 켜진다. 누르면 칩 라이브러리로. */
export function Au() {
  const { pair, to, theme } = useSite();
  const { navigate } = useRouter();
  useTitle(`AU — ${pair.name}`);
  const chips = useJson<AuChip[]>(pairPath(pair, "au.json"), []);
  const accent = theme === "dark" ? pair.accentDark : pair.accent;

  // 모니터를 누르면 바로 카트리지 화면이 뜨도록, 이 페이지에 있는 동안 칩 화면의 코드와 3D 모델(DS·카트리지·케이스)을 미리 받아 둔다
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => void import("../au/NintendoScene"));
  }, []);

  return (
    <div className="page au">
      <Header />
      <div className="au-stage">
        <div className="au-canvas">
          <Suspense fallback={<div className="au-loading mono muted">LOADING…</div>}>
            <MonitorScene
              label={pair.name}
              sub={`${String(chips.length).padStart(2, "0")} CHIPS`}
              accent={accent}
              onHover={() => {}}
              onPick={() => navigate(to("au", "chips"))}
            />
          </Suspense>
        </div>
        <div className="au-caption">
          <h1 className="page-title">
            AU<sup>[{String(chips.length).padStart(2, "0")}]</sup>
          </h1>
        </div>
      </div>
    </div>
  );
}
