/**
 * Converts the raw Sketchfab exports in src/assets into web-ready GLBs in
 * public/models: Draco-compressed geometry, WebP textures capped at 1024px,
 * node hierarchy preserved (the runtime animates named nodes — Clamshell,
 * Cassette, Paper_* — so meshes must never be joined or flattened).
 *
 * The Commodore full pack ships the whole desk (keyboard unit, disk drive,
 * joystick, cables); the hub scene only shows the monitor, so everything
 * except the "video monitor" subtree is dropped before compression.
 *
 * Usage: node scripts/optimize-models.mjs [name ...]  (no args = all)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  draco,
  metalRough,
  prune,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";

const SRC = "src/assets";
const OUT = "public/models";

/** keepNode: only this named node's subtree survives (plus its ancestors). */
const MODELS = [
  { in: "commodore_64__computer_full_pack.glb", out: "monitor.glb", keepNode: "video monitor 1702_6" },
  { in: "nintendo_ds_lite.glb", out: "nintendo-ds-lite.glb" },
  { in: "nintendo_ds.glb", out: "nintendo-ds.glb" },
  { in: "nintendo_ds_cartridge.glb", out: "cartridge.glb" },
  { in: "3ds.glb", out: "chip-case.glb" },
  { in: "floppy_disk.glb", out: "floppy.glb" },
  { in: "walkman.glb", out: "walkman.glb" },
  { in: "papers__envelopes.glb", out: "papers.glb" },
];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });

const only = process.argv.slice(2);
await fs.mkdir(OUT, { recursive: true });

for (const model of MODELS) {
  if (only.length && !only.some((n) => model.out.includes(n) || model.in.includes(n))) continue;

  const srcPath = path.join(SRC, model.in);
  const outPath = path.join(OUT, model.out);
  const document = await io.read(srcPath);

  if (model.keepNode) {
    const keep = new Set();
    for (const node of document.getRoot().listNodes()) {
      if (node.getName() === model.keepNode) {
        node.traverse((child) => keep.add(child));
        for (let p = node.getParentNode?.() ?? null; p; p = p.getParentNode?.() ?? null) keep.add(p);
        keep.add(node);
      }
    }
    if (keep.size === 0) throw new Error(`node "${model.keepNode}" not found in ${model.in}`);
    for (const node of document.getRoot().listNodes()) {
      if (!keep.has(node)) node.dispose();
    }
  }

  await document.transform(
    // three.js dropped KHR_materials_pbrSpecularGlossiness support — without
    // this conversion those materials load as blank white.
    metalRough(),
    dedup(),
    weld(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }),
    draco()
  );

  await io.write(outPath, document);
  const [inStat, outStat] = await Promise.all([fs.stat(srcPath), fs.stat(outPath)]);
  const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";
  console.log(`${model.in} (${mb(inStat.size)}) -> ${model.out} (${mb(outStat.size)})`);
}
