import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * 노션에서 내려온 이미지를 방문자에게 보낼 만한 크기로 굽는다.
 * (애니메이션 GIF 도 프레임을 유지한 채 webp 로 바꾼다.)
 *
 * 노션의 원본은 4K PNG 처럼 큰 경우가 많고, 동기화는 그것을 그대로
 * public/images/notion/ 에 내려놓는다. 이 스크립트가 그 뒤를 이어
 * webp 로 변환하고 원본을 지운 다음, 파일을 가리키는 곳(데이터 JSON,
 * 게시글 frontmatter, 동기화 매니페스트) 의 경로까지 함께 고친다.
 *
 * 매니페스트를 고치는 게 중요하다 — 그러지 않으면 다음 동기화의 정리
 * 단계가 webp 를 "노션에 없는 파일" 로 보고 지워 버린다.
 *
 * 사용: node scripts/optimize-images.mjs   (npm run notion:sync 뒤에 자동 실행)
 */

const ROOT = path.resolve("public/images/notion");
const MANIFEST = path.resolve(".notion-manifest.json");
/** 참조를 고쳐야 하는 곳 */
const REWRITE_DIRS = [path.resolve("public/data")];

const MAX_EDGE = 1600;
const QUALITY = 82;
/** 이보다 작으면 건드리지 않는다 */
const MIN_BYTES = 120 * 1024;

const SOURCE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** repo 상대경로 (public/ 이후) — 참조는 이 형태로 들어 있다 */
const relPublic = (abs) => path.relative(path.resolve("public"), abs).split(path.sep).join("/");

async function optimize() {
  const targets = walk(ROOT).filter(
    (f) => SOURCE_EXT.has(path.extname(f).toLowerCase()) && fs.statSync(f).size >= MIN_BYTES
  );
  if (targets.length === 0) {
    console.log("[images] 최적화할 파일 없음");
    return [];
  }

  const swaps = [];
  let before = 0;
  let after = 0;

  for (const src of targets) {
    const out = src.replace(/\.(png|jpe?g|gif)$/i, ".webp");
    // GIF 는 애니메이션을 살려서 변환한다 (프레임이 여러 장이면 pageHeight 로 온다)
    const animated = path.extname(src).toLowerCase() === ".gif";
    const meta = await sharp(src, { animated }).metadata();
    const height = animated ? (meta.pageHeight ?? meta.height ?? 0) : (meta.height ?? 0);
    const resize =
      Math.max(meta.width ?? 0, height) > MAX_EDGE
        ? { width: MAX_EDGE, height: MAX_EDGE, fit: "inside" }
        : undefined;

    const info = await sharp(src, { animated })
      .resize(resize)
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(out + ".tmp");
    const srcSize = fs.statSync(src).size;

    // webp 가 더 크면(이미 잘 압축된 JPEG 등) 원본을 그대로 둔다
    if (info.size >= srcSize) {
      fs.unlinkSync(out + ".tmp");
      console.log(`  = ${path.basename(src)} 원본 유지 (webp 가 더 큼)`);
      continue;
    }

    fs.renameSync(out + ".tmp", out);
    fs.unlinkSync(src);
    before += srcSize;
    after += info.size;
    swaps.push({ from: relPublic(src), to: relPublic(out) });
    console.log(
      `  → ${path.basename(src)} ${Math.round(srcSize / 1024)}KB → ` +
        `${path.basename(out)} ${Math.round(info.size / 1024)}KB`
    );
  }

  if (swaps.length) {
    console.log(
      `[images] ${swaps.length}개 변환: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`
    );
  }
  return swaps;
}

/** 참조 문자열을 일괄 치환한다. 앞에 / 가 붙은 형태도 같은 치환으로 처리된다. */
function rewrite(swaps) {
  if (swaps.length === 0) return;

  const files = REWRITE_DIRS.flatMap(walk).filter((f) => /\.(json|md)$/i.test(f));
  if (fs.existsSync(MANIFEST)) files.push(MANIFEST);

  let touched = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, "utf-8");
    let next = original;
    for (const { from, to } of swaps) {
      // 매니페스트는 public/ 접두사까지 포함한 경로를 쓴다
      next = next.split(`public/${from}`).join(`public/${to}`).split(from).join(to);
    }
    if (next !== original) {
      fs.writeFileSync(file, next);
      touched++;
    }
  }
  console.log(`[images] 참조 갱신: ${touched}개 파일`);
}

const swaps = await optimize();
rewrite(swaps);
