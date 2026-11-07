#!/usr/bin/env node
/**
 * vance.zip AI 게시판 워커 (AI-BOARD-PLAN 4 · 4-1 · 7-2)
 *
 * 한 사이클:
 *   A. 사람 일기(작성자 = human, AI처리 비어 있음) → Marinara 가 문장을 고르고 코멘트 → 본문에 [^n] 삽입 → 댓글 DB
 *   B. AI 자기 글에 사람이 단 댓글(답글대상 없음, AI 답글 없음) → 대댓글
 *   C. 오늘(KST) AI 글이 없고 post.afterHourKst 가 지났으면 → 일기 한 편
 *   D. 방명록(출처 = 사람, AI처리 비어 있음) → 답글
 *   끝: 로어북 엔트리 갱신, 바뀐 게 있으면 repository_dispatch(notion-sync)
 *
 * 실행: node worker.mjs [--config path] [--dry-run] [--only a|b|c|d] [--char 이름] [--no-dispatch]
 * 환경: NOTION_TOKEN, GITHUB_TOKEN, MARINARA_BASIC_AUTH_USER, MARINARA_BASIC_AUTH_PASS (.env 에서 --env-file 로)
 * 의존성 없음 (Node 22).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes("--dry-run");
const ONLY = argOf("--only");
const ONLY_CHAR = argOf("--char");
const NO_DISPATCH = args.includes("--no-dispatch");
const CONFIG_PATH = argOf("--config") ?? path.join(__dirname, "config.json");

const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!NOTION_TOKEN) throw new Error("NOTION_TOKEN 이 없다");

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ------------------------------------------------------------------ lock */
const LOCK = path.join(__dirname, ".lock");
try {
  const fd = fs.openSync(LOCK, "wx");
  fs.writeSync(fd, String(process.pid));
  fs.closeSync(fd);
} catch {
  const age = Date.now() - fs.statSync(LOCK).mtimeMs;
  if (age < 30 * 60 * 1000) { log("이전 실행이 아직 돌고 있다 — 종료"); process.exit(0); }
  fs.rmSync(LOCK, { force: true });
  fs.writeFileSync(LOCK, String(process.pid));
}
process.on("exit", () => fs.rmSync(LOCK, { force: true }));

/* ------------------------------------------------------------------ 시간 (KST) */
const KST = "Asia/Seoul";
function kstParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

/* ------------------------------------------------------------------ Notion */
const NOTION = "https://api.notion.com/v1";
async function notion(method, pathname, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(NOTION + pathname, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, (Number(res.headers.get("retry-after")) || attempt + 1) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Notion ${method} ${pathname} → ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
async function queryAll(db, body = {}) {
  const out = [];
  let cursor;
  do {
    const r = await notion("POST", `/databases/${db}/query`, { ...body, page_size: 100, start_cursor: cursor });
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}
async function listBlocks(id) {
  const out = [];
  let cursor;
  do {
    const r = await notion("GET", `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}
const plain = (rt = []) => rt.map((t) => t.plain_text ?? "").join("");
const title = (p, k) => plain(p.properties[k]?.title);
const text = (p, k) => plain(p.properties[k]?.rich_text);
const select = (p, k) => p.properties[k]?.select?.name ?? "";
const date = (p, k) => p.properties[k]?.date?.start ?? "";
const relation = (p, k) => (p.properties[k]?.relation ?? []).map((r) => r.id);
const number = (p, k) => p.properties[k]?.number ?? null;
const sameId = (a, b) => a.replace(/-/g, "") === b.replace(/-/g, "");

const TEXT_BLOCKS = new Set(["paragraph", "quote", "bulleted_list_item", "numbered_list_item", "callout", "toggle"]);

/** 본문 블록 → 문단 텍스트(마크다운 비슷하게) + 문장 표 */
function readBody(blocks) {
  const paras = [];
  const sentences = []; // { blockId, index, text, end }  end = 블록 평문 안에서 문장이 끝나는 글자 위치
  for (const b of blocks) {
    if (!TEXT_BLOCKS.has(b.type)) continue;
    const rt = b[b.type].rich_text ?? [];
    const t = plain(rt);
    if (!t.trim()) continue;
    paras.push(t);
    for (const s of splitSentences(t)) sentences.push({ blockId: b.id, index: s.index, text: s.text, end: s.end });
  }
  return { body: paras.join("\n\n"), sentences };
}

/** 문장 분리. 각 문장의 끝 위치(end)는 마지막 글자 바로 뒤 — 마커를 끼우는 자리. 이미 있는 [^n] 은 문장 끝으로 친다. */
function splitSentences(t) {
  const out = [];
  const re = /[^.!?…\n]*(?:[.!?…]+(?:\s*\[\^\d+\])*|\n|$)/g;
  let m;
  let index = 0;
  while ((m = re.exec(t)) !== null) {
    if (m[0] === "") { if (re.lastIndex >= t.length) break; re.lastIndex++; continue; }
    const raw = m[0];
    const trimmed = raw.replace(/\s+$/, "");
    if (trimmed.trim()) out.push({ index: index++, text: trimmed.trim(), end: m.index + trimmed.length });
    if (re.lastIndex >= t.length) break;
  }
  return out;
}

/** rich_text 배열의 평문 offset 자리에 `[^n]` 텍스트 항목을 끼워 넣는다 (서식 보존) */
function insertMarker(richText, offset, marker) {
  const out = [];
  let pos = 0;
  let done = false;
  for (const item of richText) {
    const len = (item.plain_text ?? "").length;
    if (!done && offset <= pos + len && item.type === "text") {
      const cut = offset - pos;
      const content = item.text.content;
      const head = { ...item, text: { ...item.text, content: content.slice(0, cut) } };
      const tail = { ...item, text: { ...item.text, content: content.slice(cut) } };
      if (head.text.content) out.push(strip(head));
      out.push({ type: "text", text: { content: marker } });
      if (tail.text.content) out.push(strip(tail));
      done = true;
    } else out.push(strip(item));
    pos += len;
  }
  if (!done) out.push({ type: "text", text: { content: marker } });
  return out;
}
const strip = ({ plain_text: _p, href: _h, ...rest }) => rest;

/* ------------------------------------------------------------------ Marinara */
const M = cfg.marinara;
const mAuth = process.env.MARINARA_BASIC_AUTH_USER
  ? "Basic " + Buffer.from(`${process.env.MARINARA_BASIC_AUTH_USER}:${process.env.MARINARA_BASIC_AUTH_PASS ?? ""}`).toString("base64")
  : null;
async function marinara(method, pathname, body) {
  const res = await fetch(M.baseUrl + pathname, {
    method,
    headers: { ...(mAuth ? { Authorization: mAuth } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Marinara ${method} ${pathname} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

/** generate 를 부르고 SSE 를 끝까지 읽어 저장된 assistant 메시지(들)와 user 메시지를 돌려준다 */
async function generate(ch, userMessage) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), (M.timeoutSec ?? 300) * 1000);
  try {
    const res = await fetch(M.baseUrl + "/api/generate", {
      method: "POST",
      signal: ctl.signal,
      headers: { ...(mAuth ? { Authorization: mAuth } : {}), "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        chatId: ch.chatId,
        userMessage,
        streaming: false,
        forCharacterId: ch.characterId ?? null,
        userTimeZone: KST,
        skipPresenceDelay: true,
      }),
    });
    if (!res.ok) throw new Error(`Marinara generate → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const saved = [];
    let error = null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          let ev;
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (ev.type === "message_saved" && ev.data?.id) saved.push(ev.data);
          if (ev.type === "error") error = String(ev.data ?? "error");
        }
      }
    }
    if (error) throw new Error(`Marinara 생성 오류: ${error}`);
    const assistant = saved.filter((m) => m.role === "assistant");
    const user = saved.find((m) => m.role === "user") ?? null;
    if (!assistant.length) throw new Error("Marinara 가 assistant 메시지를 저장하지 않았다");
    const last = assistant[assistant.length - 1];
    return { text: last.content ?? "", assistantId: last.id, userId: user?.id ?? null };
  } finally {
    clearTimeout(timer);
  }
}

/** 응답에서 JSON 하나를 꺼낸다 (코드펜스·앞뒤 잡담 허용) */
function parseJson(s) {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cand = [fence?.[1], s].filter(Boolean);
  for (const c of cand) {
    const a = Math.min(...["[", "{"].map((ch) => { const i = c.indexOf(ch); return i < 0 ? Infinity : i; }));
    if (!Number.isFinite(a)) continue;
    for (let b = c.length; b > a; b--) {
      const ch = c[b - 1];
      if (ch !== "]" && ch !== "}") continue;
      try { return JSON.parse(c.slice(a, b)); } catch { /* 더 짧게 */ }
    }
  }
  throw new Error("응답에서 JSON 을 못 찾았다: " + s.slice(0, 200));
}

/** 생성 후 채팅 기록을 읽기 좋게 정리 — JSON 이 아니라 글/댓글 자체가 남도록 */
async function tidy(ch, ids, userText, assistantText) {
  if (DRY) return;
  try {
    if (ids.userId && userText) await marinara("PATCH", `/api/chats/${ch.chatId}/messages/${ids.userId}`, { content: userText });
    if (ids.assistantId && assistantText) await marinara("PATCH", `/api/chats/${ch.chatId}/messages/${ids.assistantId}`, { content: assistantText });
  } catch (e) { log("  (채팅 기록 정리 실패, 무시)", e.message); }
}

/* ------------------------------------------------------------------ 로어북 */
async function upsertLore(ch, page, bodyText, comments) {
  if (!ch.lorebookId) return;
  const entries = await marinara("GET", `/api/lorebooks/${ch.lorebookId}/entries`);
  const key = `notion:${page.id}`;
  const found = (Array.isArray(entries) ? entries : entries?.entries ?? []).find((e) => e.description === key);
  const t = title(page, "제목");
  const d = date(page, "날짜");
  const author = select(page, "작성자");
  const summary = bodyText.replace(/\[\^\d+\]/g, "").replace(/\s+/g, " ").trim().slice(0, ch.loreSummaryChars ?? 600);
  const content = [`${d} ${author}의 일기 「${t}」`, summary, ...comments.map((c) => `- ${c.author}: ${c.text}`)].join("\n");
  const keys = Array.from(new Set([t, d, ...t.split(/\s+/).filter((w) => w.length >= 2)])).slice(0, 12);
  const body = { name: `일기 ${d} · ${t}`.slice(0, 200), content, description: key, keys };
  if (DRY) { log("  [dry] 로어북", body.name); return; }
  if (found) await marinara("PATCH", `/api/lorebooks/${ch.lorebookId}/entries/${found.id}`, body);
  else await marinara("POST", `/api/lorebooks/${ch.lorebookId}/entries`, body);
}

/* ------------------------------------------------------------------ GitHub */
async function dispatch() {
  if (DRY || NO_DISPATCH || !GITHUB_TOKEN || !cfg.github?.repo) return;
  const res = await fetch(`https://api.github.com/repos/${cfg.github.repo}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "vance-zip-ai-board" },
    body: JSON.stringify({ event_type: cfg.github.event ?? "notion-sync" }),
  });
  log(res.status === 204 ? "✓ dispatch" : `dispatch 실패 ${res.status}`);
}

/* ------------------------------------------------------------------ 댓글 DB 쓰기 */
async function createComment({ diaryId, guestbookId, author, content, anchor, replyTo }) {
  const props = {
    내용: { title: [{ type: "text", text: { content: content.slice(0, 2000) } }] },
    ...(diaryId ? { 일기: { relation: [{ id: diaryId }] } } : {}),
    ...(guestbookId ? { 방명록: { relation: [{ id: guestbookId }] } } : {}),
    작성자: { select: { name: author } },
    출처: { select: { name: "AI" } },
    날짜: { date: { start: new Date().toISOString() } },
    공개: { checkbox: true },
  };
  if (anchor) props["각주"] = { number: anchor };
  if (replyTo) props["답글대상"] = { relation: [{ id: replyTo }] };
  if (DRY) { log("  [dry] 댓글", { author, anchor, replyTo, content }); return { id: "dry" }; }
  return notion("POST", "/pages", { parent: { database_id: cfg.notion.commentsDb }, properties: props });
}

/* ------------------------------------------------------------------ A. 사람 일기에 각주 댓글 */
async function stepA(ch, state) {
  const rows = await queryAll(cfg.notion.diaryDb, {
    filter: { and: [
      { property: "페어", select: { equals: ch.pair } },
      { property: "공개", checkbox: { equals: true } },
      { property: "작성자", select: { equals: ch.human } },
      { property: "AI처리", date: { is_empty: true } },
    ] },
    sorts: [{ property: "날짜", direction: "ascending" }],
  });
  log(`A. ${ch.name}: 미처리 ${ch.human} 일기 ${rows.length}건`);
  for (const page of rows.slice(0, ch.readPosts ?? 3)) {
    const t = title(page, "제목");
    const blocks = await listBlocks(page.id);
    const { body, sentences } = readBody(blocks);
    if (!sentences.length) { log("  본문 없음, 건너뜀:", t); continue; }
    const existing = Math.max(0, ...[...body.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1])));
    const table = sentences.map((s, i) => `${i + 1}. ${s.text.replace(/\[\^\d+\]/g, "")}`).join("\n");
    const max = ch.maxFootnotes ?? 3;
    const userMessage = [
      `${ch.human}의 새 일기다. 댓글을 달아라.`,
      `제목: ${t}`, `날짜: ${date(page, "날짜")}`, "", body.replace(/\[\^\d+\]/g, ""), "",
      "아래 문장 표에서 코멘트를 붙일 문장을 1~" + max + "개 고른다. 한 문장에 하나씩.",
      table, "",
      `출력은 JSON 배열만: [{"sentence": 번호, "comment": "댓글"}]`,
    ].join("\n");
    log("  생성:", t);
    if (DRY) { log(userMessage.slice(0, 400)); continue; }
    const r = await generate(ch, userMessage);
    let picks;
    try { picks = parseJson(r.text); } catch (e) {
      log("  JSON 파싱 실패, 재시도:", e.message);
      const r2 = await generate(ch, "JSON 배열만 다시 출력해라. 형식: [{\"sentence\": 번호, \"comment\": \"댓글\"}]");
      picks = parseJson(r2.text);
      await tidy(ch, r2, "(형식 재요청)", null);
    }
    if (!Array.isArray(picks)) picks = [picks];
    picks = picks
      .map((p) => ({ i: Number(p.sentence) - 1, comment: String(p.comment ?? "").trim() }))
      .filter((p) => Number.isInteger(p.i) && p.i >= 0 && p.i < sentences.length && p.comment)
      .slice(0, max);
    if (!picks.length) { log("  고른 문장 없음:", t); continue; }

    // 같은 블록은 뒤 문장부터 넣어 offset 이 안 밀리게
    let n = existing;
    const made = [];
    const byBlock = new Map();
    for (const p of picks) { const s = sentences[p.i]; p.n = ++n; p.s = s; (byBlock.get(s.blockId) ?? byBlock.set(s.blockId, []).get(s.blockId)).push(p); }
    for (const [blockId, ps] of byBlock) {
      const block = blocks.find((b) => b.id === blockId);
      let rt = block[block.type].rich_text;
      for (const p of ps.sort((a, b) => b.s.end - a.s.end)) rt = insertMarker(rt, p.s.end, `[^${p.n}]`);
      await notion("PATCH", `/blocks/${blockId}`, { [block.type]: { rich_text: rt } });
    }
    for (const p of picks.sort((a, b) => a.n - b.n)) {
      await createComment({ diaryId: page.id, author: ch.name, content: p.comment, anchor: p.n });
      made.push({ author: ch.name, text: p.comment });
    }
    await notion("PATCH", `/pages/${page.id}`, { properties: { AI처리: { date: { start: new Date().toISOString() } } } });
    await tidy(ch, r, `${ch.human}의 일기 「${t}」\n\n${body.replace(/\[\^\d+\]/g, "")}`,
      picks.map((p) => `「${p.s.text.replace(/\[\^\d+\]/g, "")}」\n→ ${p.comment}`).join("\n\n"));
    await upsertLore(ch, page, body, await allCommentsOf(page.id));
    log(`  ✓ 각주 ${picks.map((p) => p.n).join(",")} 삽입 + 댓글 ${picks.length}개`);
    state.changed = true;
  }
}

async function allCommentsOf(diaryId) {
  const rows = await queryAll(cfg.notion.commentsDb, { filter: { property: "일기", relation: { contains: diaryId } }, sorts: [{ timestamp: "created_time", direction: "ascending" }] });
  return rows.map((c) => ({ id: c.id, author: select(c, "작성자"), text: title(c, "내용"), source: select(c, "출처"), replyTo: relation(c, "답글대상")[0], anchor: number(c, "각주") }));
}

/* ------------------------------------------------------------------ B. 자기 글의 사람 댓글에 대댓글 */
async function stepB(ch, state) {
  if (ch.replyToHumanComments === false) return;
  const humanComments = await queryAll(cfg.notion.commentsDb, {
    filter: { and: [
      { property: "출처", select: { equals: "사람" } },
      { property: "작성자", select: { equals: ch.human } },
      { property: "답글대상", relation: { is_empty: true } },
      { property: "일기", relation: { is_not_empty: true } },
    ] },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
  const pageCache = new Map();
  let count = 0;
  for (const c of humanComments) {
    const diaryId = relation(c, "일기")[0];
    const page = pageCache.get(diaryId) ?? (await notion("GET", `/pages/${diaryId}`));
    pageCache.set(diaryId, page);
    if (select(page, "작성자") !== ch.name || select(page, "페어") !== ch.pair) continue; // 자기 글에만
    const thread = await allCommentsOf(diaryId);
    if (thread.some((x) => x.replyTo && sameId(x.replyTo, c.id) && x.source === "AI")) continue; // 이미 답함
    const t = title(page, "제목");
    const { body } = readBody(await listBlocks(diaryId));
    const cText = title(c, "내용");
    const others = thread.filter((x) => !sameId(x.id, c.id)).map((x) => `- ${x.author}: ${x.text}`).join("\n");
    const userMessage = [
      `${ch.human}가 네 일기 「${t}」에 댓글을 달았다. 대댓글을 달아라.`,
      "", "네 글:", body.replace(/\[\^\d+\]/g, ""), "",
      others ? `다른 댓글:\n${others}\n` : "",
      `${ch.human}의 댓글: ${cText}`, "",
      `출력은 JSON 만: {"reply": "대댓글"}`,
    ].join("\n");
    log(`B. ${ch.name}: 「${t}」 의 댓글에 답글 생성`);
    if (DRY) { log(userMessage.slice(0, 400)); continue; }
    const r = await generate(ch, userMessage);
    let reply;
    try { reply = String(parseJson(r.text).reply ?? "").trim(); } catch { reply = r.text.trim(); }
    if (!reply) continue;
    await createComment({ diaryId, author: ch.name, content: reply, anchor: number(c, "각주") ?? undefined, replyTo: c.id });
    await tidy(ch, r, `${ch.human}의 댓글 (「${t}」): ${cText}`, reply);
    await upsertLore(ch, page, body, await allCommentsOf(diaryId));
    state.changed = true;
    if (++count >= (ch.readPosts ?? 3)) break;
  }
  if (!count) log(`B. ${ch.name}: 답할 댓글 없음`);
}

/* ------------------------------------------------------------------ C. 일기 쓰기 */
async function stepC(ch, state) {
  const post = ch.post ?? {};
  if (!post.enabled) return;
  const { date: today, hour } = kstParts();
  if (hour < (post.afterHourKst ?? 0)) { log(`C. ${ch.name}: 아직 ${post.afterHourKst}시 전`); return; }
  const mine = await queryAll(cfg.notion.diaryDb, {
    filter: { and: [
      { property: "페어", select: { equals: ch.pair } },
      { property: "작성자", select: { equals: ch.name } },
    ] },
    sorts: [{ property: "날짜", direction: "descending" }],
    page_size: 1,
  });
  const last = mine[0] ? date(mine[0], "날짜").slice(0, 10) : null;
  if (last === today) { log(`C. ${ch.name}: 오늘 글 있음`); return; }
  if (post.everyNDays && last) {
    const gap = (Date.parse(today) - Date.parse(last)) / 86400000;
    if (gap < post.everyNDays) { log(`C. ${ch.name}: ${post.everyNDays}일 주기, 아직 ${gap}일`); return; }
  }
  const userMessage = [
    post.prompt ?? "오늘 일기를 써라.",
    "", `출력은 JSON 만: {"title": "제목", "body": "본문 (문단은 빈 줄로 나눔)"}`,
  ].join("\n");
  log(`C. ${ch.name}: 일기 생성`);
  if (DRY) return;
  const r = await generate(ch, userMessage);
  let j;
  try { j = parseJson(r.text); } catch (e) {
    log("  JSON 파싱 실패, 재시도:", e.message);
    const r2 = await generate(ch, 'JSON 만 다시 출력해라. 형식: {"title": "제목", "body": "본문"}');
    j = parseJson(r2.text);
    await tidy(ch, r2, "(형식 재요청)", null);
  }
  const t = String(j.title ?? "").trim() || today;
  const body = String(j.body ?? "").trim();
  if (!body) { log("  본문 비어 있음"); return; }
  const children = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => ({
    object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: p.slice(0, 2000) } }] },
  }));
  const page = await notion("POST", "/pages", {
    parent: { database_id: cfg.notion.diaryDb },
    properties: {
      제목: { title: [{ type: "text", text: { content: t } }] },
      페어: { select: { name: ch.pair } },
      날짜: { date: { start: today } },
      작성자: { select: { name: ch.name } },
      AI처리: { date: { start: new Date().toISOString() } },
      공개: { checkbox: true },
    },
    children: children.slice(0, 100),
  });
  await tidy(ch, r, post.prompt ?? "오늘 일기를 써라.", `「${t}」\n\n${body}`);
  await upsertLore(ch, page, body, []);
  log(`  ✓ 일기 「${t}」`);
  state.changed = true;
}

/* ------------------------------------------------------------------ D. 방명록 답글 */
async function stepD(ch, state) {
  if (!cfg.notion.guestbookDb || ch.guestbook?.enabled === false) return;
  const rows = await queryAll(cfg.notion.guestbookDb, {
    filter: { and: [
      { property: "페어", select: { equals: ch.pair } },
      { property: "공개", checkbox: { equals: true } },
      { property: "출처", select: { equals: "사람" } },
      { property: "AI처리", date: { is_empty: true } },
    ] },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
  log(`D. ${ch.name}: 미처리 방명록 ${rows.length}건`);
  for (const g of rows.slice(0, ch.readPosts ?? 3)) {
    const name = text(g, "이름") || "[익명]";
    const content = title(g, "내용");
    if (!content.trim()) continue;
    const userMessage = [
      `방문자 "${name}" 이(가) 방명록을 남겼다. ${ch.name}로서 짧게 답글을 달아라. ${ch.human} 말고 처음 보는 방문자다.`,
      "", `${name}: ${content}`, "",
      `출력은 JSON 만: {"reply": "답글"}`,
    ].join("\n");
    log("  생성:", name, "—", content.slice(0, 40));
    if (DRY) { log(userMessage); continue; }
    const r = await generate(ch, userMessage);
    let reply;
    try { reply = String(parseJson(r.text).reply ?? "").trim(); } catch { reply = r.text.trim(); }
    if (!reply) continue;
    await createComment({ guestbookId: g.id, author: ch.name, content: reply });
    await notion("PATCH", `/pages/${g.id}`, { properties: { AI처리: { date: { start: new Date().toISOString() } } } });
    await tidy(ch, r, `방명록 — ${name}: ${content}`, reply);
    log(`  ✓ 답글: ${reply.slice(0, 60)}`);
    state.changed = true;
  }
}

/* ------------------------------------------------------------------ main */
const state = { changed: false };
for (const ch of cfg.characters) {
  if (ONLY_CHAR && ch.name !== ONLY_CHAR) continue;
  if (!ch.characterId) {
    const chat = await marinara("GET", `/api/chats/${ch.chatId}`);
    ch.characterId = chat.characterIds?.length === 1 ? chat.characterIds[0] : null;
  }
  try {
    if (!ONLY || ONLY === "a") await stepA(ch, state);
    if (!ONLY || ONLY === "b") await stepB(ch, state);
    if (!ONLY || ONLY === "c") await stepC(ch, state);
    if (!ONLY || ONLY === "d") await stepD(ch, state);
  } catch (e) {
    log(`✗ ${ch.name}:`, e.message);
    process.exitCode = 1;
  }
}
if (state.changed) await dispatch();
log("끝", state.changed ? "(변경 있음)" : "(변경 없음)");
