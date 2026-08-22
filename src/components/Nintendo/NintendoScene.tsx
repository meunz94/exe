import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PresentationControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { publicUrl } from "../../utils/publicUrl";
import type { Chip, ChipContent, DsTab } from "../../types/nintendo";
import { boxArtTexture, chipLabelTexture } from "./chipTexture";
import { bottomScreen, tabFromUv, topScreen, type TopScreenHandle } from "./screenTextures";

const DS_URL = publicUrl("models/nintendo-ds.glb");
const CART_URL = publicUrl("models/cartridge.glb");
const CASE_URL = publicUrl("models/chip-case.glb");

/* The DS export sits 120° open with the TOP node's pivot on the hinge —
   +120° in the parent's frame lays the lid flush closed. */
const FOLD_ANGLE = (Math.PI * 2) / 3;
const FOLD_AXIS = new THREE.Vector3(1, 0, 0);

/** Scene phases; the page only knows "carousel"/"detail", the scene owns the
    transitions between them. */
type Phase = "ring" | "insert" | "opening" | "open" | "closing";

/* ---------------------------------------------------------------------------
 * Cartridge
 * ------------------------------------------------------------------------- */

/** Node holding the cartridge's recessed label face. */
const LABEL_NODE = "Object_7";

function Cartridge({ chip, dimmed }: { chip: Chip; dimmed?: boolean }) {
  const { scene } = useGLTF(CART_URL);
  const label = useMemo(() => chipLabelTexture(chip), [chip]);

  // The label art becomes the label mesh's own material — printed on the
  // cartridge, not a sticker floating above it. The export's UVs on that
  // face are unusable, so it gets a clean planar unwrap first.
  const body = useMemo(() => {
    const clone = scene.clone(true);
    const face = clone.getObjectByName(LABEL_NODE) as THREE.Mesh | null;
    if (face) {
      const geo = (face.geometry = face.geometry.clone());
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
        uv[i * 2 + 1] = 1 - (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z || 1);
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      // the label face is exactly coplanar with the body's top face, so pull
      // it forward in depth or the two z-fight
      face.material = new THREE.MeshBasicMaterial({
        map: label,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
    }
    return clone;
  }, [scene, label]);

  // Dim by tinting the label material — no extra transparent pass.
  useEffect(() => {
    const face = body.getObjectByName(LABEL_NODE) as THREE.Mesh | null;
    const mat = face?.material as THREE.MeshBasicMaterial | undefined;
    mat?.color.set(dimmed ? "#8a8a96" : "#ffffff");
  }, [body, dimmed]);

  return <primitive object={body} />;
}

/** Retail game case shown beside the ad popup; the front cover carries the
    chip's box art (real file when present, mock otherwise). */
function ChipCase({ chip }: { chip: Chip }) {
  const { scene } = useGLTF(CASE_URL);
  const art = useMemo(() => boxArtTexture(chip), [chip]);

  const body = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (((mesh.material as THREE.Material)?.name ?? "") !== "front") return;
      const geo = (mesh.geometry = mesh.geometry.clone());
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        // cover face is flat XY; the spine sits at x=0, the opening edge at
        // x=max — displayed book-style, x runs right and y runs up
        uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
        uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1);
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      mesh.material = new THREE.MeshBasicMaterial({ map: art, toneMapped: false });
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.copy(center.multiplyScalar(-1));
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(2.4 / (Math.max(size.x, size.y, size.z) || 1));
    return wrapper;
  }, [scene, art]);

  return <primitive object={body} />;
}

/* ---------------------------------------------------------------------------
 * DS unit with fold + live screens
 * ------------------------------------------------------------------------- */

export type DsButton = "A" | "B" | "padUp" | "padDown";

interface DsUnitProps {
  fold: React.RefObject<number>;
  screensOn: boolean;
  /** reading mode: the wheel scrolls the top screen */
  zoomed: boolean;
  tab: DsTab;
  content: ChipContent | null;
  onTopClick: () => void;
  onPickTab: (tab: DsTab) => void;
  onButton: (btn: DsButton) => void;
  onTopHandle?: (handle: TopScreenHandle) => void;
}

function DsUnit({ fold, screensOn, zoomed, tab, content, onTopClick, onPickTab, onButton, onTopHandle }: DsUnitProps) {
  const { scene } = useGLTF(DS_URL);
  const { gl } = useThree();

  const parts = useMemo(() => {
    // GLTFLoader strips dots from node names ("TOP.001_2" → "TOP001_2"), so
    // match nodes by prefix and screens by their dedicated material names.
    const found: {
      lid?: THREE.Object3D;
      topMesh?: THREE.Mesh;
      bottomMesh?: THREE.Mesh;
      dsCard?: THREE.Object3D;
    } = {};
    scene.traverse((o) => {
      if (o.name.startsWith("TOP")) found.lid = o;
      if (o.name.startsWith("DSCARD")) found.dsCard = o;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const matName = (mesh.material as THREE.Material)?.name ?? "";
      if (matName.startsWith("screen_up")) {
        found.topMesh = mesh;
        mesh.userData.isTopScreen = true;
      }
      if (matName.startsWith("screen_down")) found.bottomMesh = mesh;
    });
    const { lid = null, topMesh = null, bottomMesh = null, dsCard = null } = found;
    if (lid) lid.userData.openQuat ??= lid.quaternion.clone();

    // Both LCDs are flat XZ meshes; give each a clean planar unwrap so the
    // canvas textures map 0-1 across them. The lid mesh reads 180° rotated
    // relative to the base (it faces the player folded over), so its axes
    // are mirrored.
    for (const mesh of [topMesh, bottomMesh]) {
      if (!mesh || mesh.userData.uvUnwrapped) continue;
      mesh.userData.uvUnwrapped = true;
      const flip = mesh === topMesh;
      const geo = (mesh.geometry = mesh.geometry.clone());
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const nx = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
        const nz = (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z || 1);
        uv[i * 2] = nx;
        uv[i * 2 + 1] = flip ? nz : 1 - nz;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    // Normalize: center on origin, largest dim = 1.
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return {
      lid,
      topMesh,
      bottomMesh,
      dsCard,
      scale: 1 / (Math.max(size.x, size.y, size.z) || 1),
      offset: center.multiplyScalar(-1),
    };
  }, [scene]);

  // Screens are canvases; refs keep the draw closures current.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const contentRef = useRef(content);
  contentRef.current = content;
  const bottom = useMemo(() => bottomScreen(() => tabRef.current), []);
  const top = useMemo<TopScreenHandle>(
    () => topScreen(() => ({ tab: tabRef.current, content: contentRef.current })),
    []
  );

  useEffect(() => {
    onTopHandle?.(top);
  }, [top, onTopHandle]);

  useEffect(() => {
    top.resetScroll();
    bottom.draw();
    top.draw();
  }, [tab, content, bottom, top]);

  // Reading mode: the mouse wheel scrolls the top screen's content.
  useEffect(() => {
    if (!zoomed) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      top.scrollBy(e.deltaY * 0.5);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomed, gl, top]);

  // Both screens are printed on their own meshes — material swap, exactly
  // like the cartridge labels. The slot card only shows once a chip is in.
  const topMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: top.texture, toneMapped: false }),
    [top]
  );
  const bottomMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: bottom.texture, toneMapped: false }),
    [bottom]
  );
  // Restore the export's own screen art if this scene unmounts mid-swap.
  useEffect(() => {
    const { topMesh, bottomMesh } = parts;
    return () => {
      for (const mesh of [topMesh, bottomMesh]) {
        if (mesh?.userData.origMat) mesh.material = mesh.userData.origMat as THREE.Material;
      }
    };
  }, [parts]);

  const q = useMemo(() => new THREE.Quaternion(), []);
  const screensLit = useRef(false);
  useFrame(() => {
    const { lid, topMesh, bottomMesh, dsCard } = parts;
    if (lid) {
      const open = lid.userData.openQuat as THREE.Quaternion;
      lid.quaternion
        .copy(q.setFromAxisAngle(FOLD_AXIS, FOLD_ANGLE * (1 - (fold.current ?? 0))))
        .multiply(open);
    }

    // Screens power on the moment the lid starts lifting — the export's
    // baked screen art must never render, since it shares the geometry we
    // re-unwrapped for the canvas textures and would look corrupted.
    const on = (fold.current ?? 0) > 0.02;
    if (on !== screensLit.current) {
      screensLit.current = on;
      for (const [mesh, mat] of [
        [topMesh, topMat],
        [bottomMesh, bottomMat],
      ] as const) {
        if (!mesh) continue;
        mesh.userData.origMat ??= mesh.material;
        mesh.material = on ? mat : (mesh.userData.origMat as THREE.Material);
      }
      if (dsCard) dsCard.visible = on;
    }
  });

  return (
    <group scale={parts.scale}>
      <group position={parts.offset}>
        <primitive
          object={scene}
          onClick={(e: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
            if (!screensOn || e.delta > 6) return;
            // the lit top screen closes/zooms out; the touch screen picks a
            // tab; the physical buttons work like the real thing
            if (parts.topMesh && e.object === parts.topMesh) {
              e.stopPropagation();
              onTopClick();
              return;
            }
            if (parts.bottomMesh && e.object === parts.bottomMesh && e.uv) {
              e.stopPropagation();
              const picked = tabFromUv(e.uv);
              if (picked) onPickTab(picked);
              return;
            }
            // walk up to the named button node (GLTFLoader strips the dots)
            let node: THREE.Object3D | null = e.object;
            while (node) {
              if (node.name.startsWith("A001")) {
                e.stopPropagation();
                onButton("A");
                return;
              }
              if (node.name.startsWith("B001")) {
                e.stopPropagation();
                onButton("B");
                return;
              }
              if (node.name.startsWith("PAD")) {
                e.stopPropagation();
                const local = node.worldToLocal(e.point.clone());
                onButton(local.z < 0 ? "padUp" : "padDown");
                return;
              }
              node = node.parent;
            }
          }}
        />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------------
 * Scene
 * ------------------------------------------------------------------------- */

interface NintendoSceneProps {
  chips: Chip[];
  mode: "carousel" | "detail";
  activeChip: Chip | null;
  content: ChipContent | null;
  tab: DsTab;
  /** camera-on-the-top-screen reading mode */
  zoomed: boolean;
  /** phone layout: the DS sits higher and smaller, leaving room for the sheet */
  compact?: boolean;
  onInsert: (chip: Chip) => void;
  onOpened: () => void;
  /** top-screen click — the page routes it to zoom-out or close */
  onCloseRequest: () => void;
  onClosed: () => void;
  onPickTab: (tab: DsTab) => void;
  onButton: (btn: DsButton) => void;
  /** hands the page the live top-screen handle (canvas + scroll control) */
  onTopHandle?: (handle: TopScreenHandle) => void;
}

const RING_Y = 0.55;
const CHIP_SCALE = 0.42;

/* Reading pose: the DS tipped so its top screen faces the camera up close.
   Tunable via ?zy=…&zz=…&zs=…&zrx=… while dialing it in. */
const ZOOM_POSE = (() => {
  const q = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => (q.get(k) !== null ? Number(q.get(k)) : d);
  return { x: num("zxx", 0), y: num("zy", -1.9), z: num("zz", 3.4), s: num("zs", 5.0), rx: num("zrx", 1.05) };
})();

/** Elliptical ring: wide in x so side chips fan out instead of piling up,
    shallow in z so the front chip stays close to the camera. */
const ringXFor = (count: number) => Math.min(4.2, Math.max(2.7, count * 0.26));
const ringZFor = (count: number) => ringXFor(count) * 0.62;

function SceneBody({
  chips,
  mode,
  activeChip,
  content,
  tab,
  zoomed,
  compact,
  onInsert,
  onOpened,
  onCloseRequest,
  onClosed,
  onPickTab,
  onButton,
  onTopHandle,
}: NintendoSceneProps) {
  const phase = useRef<Phase>("ring");
  const ring = useRef<THREE.Group>(null);
  const ringAngle = useRef(0);
  const ringTarget = useRef(0);
  const ds = useRef<THREE.Group>(null);
  const fold = useRef(0);
  const flying = useRef<THREE.Group>(null);
  const showChip = useRef<THREE.Group>(null);
  const flyT = useRef(0);
  const chipFacers = useRef<(THREE.Group | null)[]>([]);
  const [flyingChip, setFlyingChip] = useState<Chip | null>(null);
  // mirrored into state so render never reads the ring refs directly
  const [front, setFront] = useState(0);
  const { gl } = useThree();

  const step = (Math.PI * 2) / Math.max(chips.length, 1);

  // Page told us to leave detail (back button) while we're open.
  useEffect(() => {
    if (mode === "carousel" && (phase.current === "open" || phase.current === "opening")) {
      phase.current = "closing";
    }
    // Deep link: the page entered detail without an insertion — jump the
    // scene straight to the open pose.
    if (mode === "detail" && phase.current === "ring") {
      phase.current = "open";
      fold.current = 1.25;
    }
  }, [mode]);

  // Wheel drives the ring.
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (phase.current !== "ring") return;
      e.preventDefault();
      ringTarget.current -= (e.deltaY + e.deltaX) * 0.0016;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl]);

  const frontIndex = () => {
    const n = chips.length || 1;
    return ((Math.round(-ringTarget.current / step) % n) + n) % n;
  };

  const pickChip = (i: number) => {
    if (phase.current !== "ring") return;
    if (i === frontIndex()) {
      // insert the front chip
      const chip = chips[i];
      setFlyingChip(chip);
      flyT.current = 0;
      phase.current = "insert";
      onInsert(chip);
    } else {
      // rotate the picked chip to the front, shortest way around
      const want = -i * step;
      const delta = ((want - ringTarget.current) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      ringTarget.current += delta;
    }
  };

  useFrame((state, delta) => {
    // ring: settle to the nearest slot when idle
    if (phase.current === "ring") {
      ringTarget.current = THREE.MathUtils.damp(
        ringTarget.current,
        Math.round(ringTarget.current / step) * step,
        3,
        delta
      );
    }
    ringAngle.current = THREE.MathUtils.damp(ringAngle.current, ringTarget.current, 6, delta);
    // slide each chip along the fixed ellipse, facing outward — the front
    // chip shows its label, chips around the back show their shells
    chipFacers.current.forEach((g, i) => {
      if (!g) return;
      const a = i * step + ringAngle.current;
      g.position.set(
        Math.sin(a) * ringXFor(chips.length),
        0,
        Math.cos(a) * ringZFor(chips.length)
      );
      g.rotation.y = a;
    });
    if (ring.current) {
      // the ring parks below/behind while the DS is open
      const away = phase.current === "open" || phase.current === "opening";
      ring.current.position.y = THREE.MathUtils.damp(ring.current.position.y, away ? 4.4 : RING_Y, 3.2, delta);
    }

    // DS pose per phase; zoom mode pushes the top screen into the camera
    if (ds.current) {
      const detail = phase.current === "opening" || phase.current === "open";
      const t = zoomed && detail
        ? ZOOM_POSE
        : detail
          ? compact
            ? { x: 0, y: 0.35, z: 2.2, s: 2.0, rx: 0.85 }
            : { x: -1.0, y: -0.35, z: 2.2, s: 2.6, rx: 0.85 }
          : { x: 0, y: -1.62, z: 1.1, s: 1.9, rx: 0.12 };
      const p = ds.current.position;
      ds.current.scale.setScalar(THREE.MathUtils.damp(ds.current.scale.x, t.s, 4, delta));
      p.x = THREE.MathUtils.damp(p.x, t.x, 4, delta);
      p.y = THREE.MathUtils.damp(p.y, t.y, 4, delta);
      p.z = THREE.MathUtils.damp(p.z, t.z, 4, delta);
      ds.current.rotation.x = THREE.MathUtils.damp(ds.current.rotation.x, t.rx, 4, delta);
    }

    // display chip beside the popup: gentle float + slow turn
    if (showChip.current) {
      const ct = state.clock.elapsedTime;
      showChip.current.position.y = 0.45 + Math.sin(ct * 0.9) * 0.1;
      showChip.current.rotation.y = Math.sin(ct * 0.45) * 0.35;
    }

    // chip flight into the slot
    if (phase.current === "insert" && flying.current) {
      flyT.current = Math.min(1, flyT.current + delta * 1.4);
      const t = flyT.current;
      const ease = t * t * (3 - 2 * t);
      const from = new THREE.Vector3(0, RING_Y, ringZFor(chips.length) + 0.4);
      const slot = new THREE.Vector3(0, -1.45, 0.65);
      flying.current.position.lerpVectors(from, slot, ease);
      flying.current.position.y += Math.sin(ease * Math.PI) * 0.5; // small arc
      flying.current.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, Math.PI, ease);
      flying.current.scale.setScalar(THREE.MathUtils.lerp(CHIP_SCALE, CHIP_SCALE * 0.5, ease));
      if (t >= 1) {
        setFlyingChip(null);
        phase.current = "opening";
      }
    }

    // fold toward open/closed — 1.25 pushes the lid past the export's 120°
    // pose to a roomy 150°
    const detailPhase = phase.current === "opening" || phase.current === "open";
    const foldTarget = detailPhase ? 1.25 : 0;
    fold.current = THREE.MathUtils.damp(fold.current, foldTarget, 3.4, delta);
    if (phase.current === "opening" && fold.current > 1.23) {
      phase.current = "open";
      onOpened();
    }
    if (phase.current === "closing" && fold.current < 0.02) {
      phase.current = "ring";
      onClosed();
    }

    const f = frontIndex();
    if (f !== front) setFront(f);
  });

  return (
    <>
      <ambientLight intensity={1.25} />
      <hemisphereLight intensity={1.0} color="#ffffff" groundColor="#6f7fd8" />
      <directionalLight position={[3, 5, 6]} intensity={2.2} />
      <directionalLight position={[-5, 2, -3]} intensity={0.8} color="#8fa8ff" />

      {/* cartridge ring */}
      <group ref={ring} position={[0, RING_Y, 0]}>
        {chips.map((chip, i) => {
          const isFront = i === front && mode === "carousel";
          const hidden = flyingChip?.id === chip.id;
          return (
            <group
              key={chip.id}
              ref={(g) => {
                chipFacers.current[i] = g;
              }}
              scale={(isFront ? CHIP_SCALE * 1.25 : CHIP_SCALE) * (hidden ? 0.001 : 1)}
              onClick={(e) => {
                e.stopPropagation();
                pickChip(i);
              }}
              onPointerOver={() => {
                if (phase.current === "ring") document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              <group rotation={[Math.PI / 2, 0, 0]}>
                <Cartridge chip={chip} dimmed={!isFront} />
              </group>
            </group>
          );
        })}
      </group>

      {/* chip in flight toward the slot */}
      {flyingChip && (
        <group ref={flying}>
          <Cartridge chip={flyingChip} />
        </group>
      )}

      {/* the inserted chip's retail case floating beside its ad popup */}
      {mode === "detail" && activeChip && !zoomed && !compact && (
        <group ref={showChip} position={[1.55, 0.45, -0.5]}>
          {/* spine left, opening edge to the side — book orientation */}
          <ChipCase chip={activeChip} />
        </group>
      )}

      {/* the DS */}
      <PresentationControls
        enabled={mode === "detail" && !zoomed}
        polar={[-0.35, 0.5]}
        azimuth={[-1.1, 1.1]}
        snap
      >
        <group ref={ds} position={[0, -1.62, 1.1]} rotation={[0.12, 0, 0]} scale={1.9}>
          <DsUnit
            fold={fold}
            screensOn={mode === "detail"}
            zoomed={zoomed}
            tab={tab}
            content={content}
            onTopClick={onCloseRequest}
            onPickTab={onPickTab}
            onButton={onButton}
            onTopHandle={onTopHandle}
          />
        </group>
      </PresentationControls>
    </>
  );
}

export default function NintendoScene(props: NintendoSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 7.4], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <SceneBody {...props} />
    </Canvas>
  );
}

useGLTF.preload(DS_URL);
useGLTF.preload(CART_URL);
