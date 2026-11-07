import type { Line, Subject } from "../lib/types";

/** 장면의 대사 목록 — 첫 번째 subject 는 왼쪽 회색, 두 번째는 오른쪽 검정 */
export function Chat({ lines, subjects, size = "md" }: { lines: Line[]; subjects: Subject[]; size?: "md" | "sm" }) {
  const sideOf = (who?: string): "left" | "right" | "stage" => {
    if (!who) return "stage";
    const w = who.toLowerCase();
    const idx = subjects.findIndex((s) => w.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(w) || w.includes(s.big.toLowerCase()));
    return idx === 1 ? "right" : "left";
  };
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const side = sideOf(line.who);
    if (side === "stage") {
      out.push(
        <span key={i} className="bubble-stage">
          {line.text}
        </span>
      );
      return;
    }
    const prev = lines[i - 1];
    const next = lines[i + 1];
    const startsRun = !prev || prev.who !== line.who;
    const endsRun = !next || next.who !== line.who;
    if (startsRun) {
      out.push(
        <span key={`n${i}`} className={`bubble-name ${side}`}>
          {line.who}
        </span>
      );
    }
    out.push(
      <span key={i} className={`bubble ${side} ${endsRun ? "last" : ""} ${size === "sm" ? "sm" : ""}`}>
        {line.text}
      </span>
    );
  });
  return <div className="chat">{out}</div>;
}
