/**
 * 방명록 쓰기 프록시 — Cloudflare Worker.
 *
 * 정적 사이트는 노션에 직접 쓸 수 없으므로(CORS·토큰 노출) 이 워커가 대신
 * 방명록 DB 에 행(pages.create)을 하나 만들고, 배포 워크플로우를 깨운다.
 *
 * Variables and Secrets:
 *   NOTION_TOKEN      노션 내부 통합 토큰 (방명록 DB 에 연결돼 있어야 함)
 *   GUESTBOOK_DB      notion.config.json 의 databases.guestbook
 *   ALLOW_ORIGIN      https://vance.zip  (여러 개면 쉼표로)
 *   PUBLISH_DEFAULT   "true" 면 바로 공개, 아니면 노션에서 공개 체크 후 노출
 *   GITHUB_TOKEN      (선택) repository_dispatch 로 즉시 재배포하려면
 *   GITHUB_REPO       (선택) meunz94/exe
 *
 * 사이트 쪽: public/data/site.json 의 guestbookEndpoint 에 이 워커 URL 을 넣는다.
 */
const MAX_NAME = 40;
const MAX_TEXT = 500;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const recent = new Map(); // ip → [timestamps] (워커 인스턴스 단위의 간단한 레이트 리밋)

function cors(env, req) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (env.ALLOW_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin || "*" : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

export default {
  async fetch(req, env) {
    const headers = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "json" }), { status: 400, headers });
    }
    // 허니팟: 사람 눈에 안 보이는 website 필드가 채워져 있으면 봇
    if (body.website) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

    const name = String(body.name ?? "").trim().slice(0, MAX_NAME) || "[익명]";
    const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);
    const pair = String(body.pair ?? "").trim().slice(0, 40);
    if (!text) return new Response(JSON.stringify({ error: "empty" }), { status: 400, headers });

    const ip = req.headers.get("CF-Connecting-IP") ?? "?";
    const now = Date.now();
    const stamps = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (stamps.length >= MAX_PER_WINDOW) return new Response(JSON.stringify({ error: "rate" }), { status: 429, headers });
    stamps.push(now);
    recent.set(ip, stamps);

    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: env.GUESTBOOK_DB },
        properties: {
          내용: { title: [{ type: "text", text: { content: text } }] },
          이름: { rich_text: [{ type: "text", text: { content: name } }] },
          날짜: { date: { start: today } },
          출처: { select: { name: "사람" } },
          ...(pair ? { 페어: { select: { name: pair } } } : {}),
          공개: { checkbox: env.PUBLISH_DEFAULT === "true" },
        },
      }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: `notion ${res.status}` }), { status: 502, headers });
    const page = await res.json();
    const id = page.id.replace(/-/g, "").slice(0, 8); // sync 의 shortId 와 같은 규칙

    if (env.GITHUB_TOKEN && env.GITHUB_REPO && env.PUBLISH_DEFAULT === "true") {
      await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "guestbook-proxy",
        },
        body: JSON.stringify({ event_type: "notion-sync" }),
      }).catch(() => {});
    }
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers });
  },
};
