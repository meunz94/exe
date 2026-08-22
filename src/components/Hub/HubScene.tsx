import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { publicUrl } from "../../utils/publicUrl";
import type { HubSection } from "../../types/screens";
import screenImg from "../../assets/pc-screen.webp";

const FOLD_AXIS = new THREE.Vector3(1, 0, 0);

/** The invisible shelf everything rests on. */
const GROUND = -1.7;

/** How long a press must be held before it becomes a rotate-drag. */
const HOLD_MS = 320;

/** Phone layout: the devices ride a swipeable ring instead of a shelf. */
const RING_RADIUS = 2.6;
const RING_CENTER_Z = -0.6;

interface ItemDef {
  id: HubSection;
  url: string;
  /** x/z shelf position; y is derived so the model rests on GROUND */
  pos: [number, number];
  /** world-units target for the model's largest dimension */
  size: number;
  /** resting pose */
  rot?: [number, number, number];
  /** hinge lid node (name prefix) + how far past the export pose "closed" is */
  lidNode?: string;
  foldAngle?: number;
  /** named nodes to strip before fitting */
  hideNodes?: string[];
  /** stays put on hover; the monitor lights up instead of floating */
  anchored?: boolean;
  /** extra downward nudge for models whose geometry pads below the body */
  sink?: number;
  /** mesh whose material becomes the boot splash while hovered */
  screenNode?: string;
}

const ITEMS: ItemDef[] = [
  { id: "pc", url: publicUrl("models/monitor.glb"), pos: [0, -0.3], size: 2.75, rot: [0, -0.26, 0], anchored: true, screenNode: "Object_19" },
  { id: "nintendo", url: publicUrl("models/nintendo-ds.glb"), pos: [2.3, 1.15], size: 1.7, rot: [0, -0.65, 0], lidNode: "TOP", foldAngle: (Math.PI * 2) / 3 },
  { id: "papers", url: publicUrl("models/papers.glb"), pos: [3.1, -0.3], size: 2.0, rot: [0, 0.35, 0] },
  { id: "walkman", url: publicUrl("models/walkman.glb"), pos: [-2.85, 1.0], size: 1.9, rot: [-Math.PI / 2, 0, 0.35], hideNodes: ["Object_2"], sink: 0.02 },
  // the floppy export's face normal is ±X, so a z-roll lays it label-up
  { id: "floppy", url: publicUrl("models/floppy.glb"), pos: [-1.0, 1.45], size: 1.3, rot: [0, 0.4, Math.PI / 2] },
];

ITEMS.forEach((item) => useGLTF.preload(item.url));

/** The monitor's wallpaper, swapped onto the CRT mesh's own material while
    the monitor is hovered. Cover-fitted so the tube shows no letterbox. */
let splashMat: THREE.MeshBasicMaterial | null = null;
function monitorSplashMaterial(): THREE.MeshBasicMaterial {
  if (splashMat) return splashMat;
  const W = 640;
  const H = 480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0d1f";
  ctx.fillRect(0, 0, W, H);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  const draw = () => {
    // cover-fit: fill the 4:3 tube, cropping the wallpaper's sides
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    texture.needsUpdate = true;
  };
  img.onload = draw;
  img.onerror = () => {
    // never leave the tube blank if the wallpaper fails to load
    ctx.fillStyle = "#e8ecff";
    ctx.font = "700 44px 'Galmuri11', sans-serif";
    ctx.fillText("LIMBIC SYSTEM", 110, 250);
    texture.needsUpdate = true;
  };
  img.src = screenImg;
  if (img.complete && img.naturalWidth > 0) draw();
  splashMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  return splashMat;
}

interface HubItemProps {
  def: ItemDef;
  index: number;
  mobile: boolean;
  /** shared ring spin (mobile carousel) */
  ringAngle: React.RefObject<number>;
  frontIndex: number;
  reducedMotion: boolean;
  onPick: (id: HubSection) => void;
  onHover: (id: HubSection | null) => void;
  onSpinTo: (index: number) => void;
  /** lets the scene aim the shared spotlight at this item */
  registerGroup: (index: number, group: THREE.Group | null) => void;
}

function HubItem({
  def,
  index,
  mobile,
  ringAngle,
  frontIndex,
  reducedMotion,
  onPick,
  onHover,
  onSpinTo,
  registerGroup,
}: HubItemProps) {
  const { scene } = useGLTF(def.url);
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const lift = useRef(0);
  const hoverSpin = useRef(0);
  // long-press rotate state
  const pressedAt = useRef<number | null>(null);
  const userRot = useRef({ x: 0, y: 0 });
  const rotated = useRef(false);
  const { viewport } = useThree();

  // Normalize the export's arbitrary scale/origin to a known size at the
  // origin, then find how far the resting pose hangs below it so the model
  // can sit exactly on GROUND. Mutations must stay idempotent — the GLTF
  // scene object is shared and this can run more than once.
  const fit = useMemo(() => {
    def.hideNodes?.forEach((name) => scene.getObjectByName(name)?.removeFromParent());
    if (def.lidNode) {
      let lid: THREE.Object3D | null = null;
      scene.traverse((o) => {
        if (!lid && o.name.startsWith(def.lidNode!)) lid = o;
      });
      if (lid) {
        const l = lid as THREE.Object3D;
        const open = (l.userData.openQuat ??= l.quaternion.clone()) as THREE.Quaternion;
        l.quaternion.setFromAxisAngle(FOLD_AXIS, def.foldAngle ?? 0).multiply(open);
      }
    }
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // phones view the ring closer up, so everything shrinks to fit
    const target = def.size * (mobile ? 0.46 : 1);
    const scale = target / (Math.max(size.x, size.y, size.z) || 1);

    // lowest corner of the centered+scaled bbox after the resting rotation
    const rotM = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(...(def.rot ?? [0, 0, 0]))
    );
    let minY = Infinity;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          (i & 1 ? box.max.x : box.min.x) - center.x,
          (i & 2 ? box.max.y : box.min.y) - center.y,
          (i & 4 ? box.max.z : box.min.z) - center.z
        )
        .multiplyScalar(scale)
        .applyMatrix4(rotM);
      minY = Math.min(minY, corner.y);
    }

    return {
      scale,
      offset: center.clone().multiplyScalar(-1),
      restY: GROUND - minY - (def.sink ?? 0),
      frontZ: (box.max.z - center.z) * scale,
    };
  }, [scene, def, mobile]);

  const isFront = index === frontIndex;
  const active = mobile ? isFront : hovered;

  // The monitor answers a hover by lighting its CRT with the boot splash.
  // The splash needs its own planar-unwrapped geometry — the original tube
  // texture must keep the original UVs, so geometry and material swap
  // together. Everything else is emphasised by the scene spotlight.
  useEffect(() => {
    if (def.screenNode) {
      const crt = scene.getObjectByName(def.screenNode) as THREE.Mesh | null;
      if (!crt) return;
      crt.userData.origGeo ??= crt.geometry;
      crt.userData.origMat ??= crt.material;
      if (!crt.userData.splashGeo) {
        const geo = (crt.userData.origGeo as THREE.BufferGeometry).clone();
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
          uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1);
        }
        geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        crt.userData.splashGeo = geo;
      }
      const restore = () => {
        crt.geometry = crt.userData.origGeo as THREE.BufferGeometry;
        crt.material = crt.userData.origMat as THREE.Material;
      };
      if (active) {
        crt.geometry = crt.userData.splashGeo as THREE.BufferGeometry;
        crt.material = monitorSplashMaterial();
      } else {
        restore();
      }
      return restore;
    }
  }, [scene, def, active]);

  useFrame((_, delta) => {
    if (!group.current || !inner.current || !spinner.current) return;

    // hover: rise off the shelf; off-hover: settle back down
    const liftTarget = (mobile ? isFront : hovered && !def.anchored) ? (mobile ? 0.18 : 0.28) : 0;
    lift.current = reducedMotion
      ? liftTarget
      : THREE.MathUtils.damp(lift.current, liftTarget, 6, delta);

    if (mobile) {
      // carousel slot: front chip closest to the camera
      const a = (ringAngle.current ?? 0) + index * ((Math.PI * 2) / ITEMS.length);
      group.current.position.set(
        Math.sin(a) * RING_RADIUS,
        fit.restY + lift.current + 0.55,
        Math.cos(a) * RING_RADIUS + RING_CENTER_Z
      );
    } else {
      const squeeze = Math.min(1, viewport.width / 8.6);
      group.current.position.set(def.pos[0] * squeeze, fit.restY + lift.current, def.pos[1]);
    }

    // under the spotlight the item turns slowly; long-press drag overrides
    if (active && !def.anchored && pressedAt.current === null && !reducedMotion) {
      hoverSpin.current += delta * 1.1;
    } else if (pressedAt.current === null) {
      hoverSpin.current = THREE.MathUtils.damp(hoverSpin.current % (Math.PI * 2), 0, 4, delta);
    }

    // long-press rotate: while held past the threshold the drag spins the
    // item; on release it springs back to its resting pose
    if (pressedAt.current === null) {
      userRot.current.y = THREE.MathUtils.damp(userRot.current.y, 0, 4, delta);
      userRot.current.x = THREE.MathUtils.damp(userRot.current.x, 0, 4, delta);
    }
    spinner.current.rotation.set(userRot.current.x, userRot.current.y + hoverSpin.current, 0);
  });

  const holding = () =>
    pressedAt.current !== null && performance.now() - pressedAt.current > HOLD_MS;

  return (
    <group
      ref={(g) => {
        group.current = g;
        registerGroup(index, g);
      }}
      onPointerOver={(e) => {
        if (mobile) return;
        e.stopPropagation();
        setHovered(true);
        onHover(def.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (mobile) return;
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "";
      }}
      onPointerDown={(e) => {
        if (mobile) return;
        e.stopPropagation();
        pressedAt.current = performance.now();
        rotated.current = false;
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (mobile || !holding()) return;
        rotated.current = true;
        userRot.current.y += (e.nativeEvent.movementX ?? 0) * 0.012;
        userRot.current.x += (e.nativeEvent.movementY ?? 0) * 0.008;
        userRot.current.x = THREE.MathUtils.clamp(userRot.current.x, -0.9, 0.9);
      }}
      onPointerUp={(e) => {
        if (mobile) return;
        pressedAt.current = null;
        (e.target as Element)?.releasePointerCapture?.(e.pointerId);
      }}
      onClick={(e) => {
        e.stopPropagation();
        // a rotate-drag or ring swipe must not navigate on release
        if (rotated.current || e.delta > 6) {
          rotated.current = false;
          return;
        }
        pressedAt.current = null;
        if (mobile && !isFront) {
          onSpinTo(index);
          return;
        }
        onPick(def.id);
      }}
    >
      <group ref={spinner}>
        <group ref={inner}>
          <group rotation={def.rot ?? [0, 0, 0]}>
            <group scale={fit.scale}>
              <group position={fit.offset}>
                <primitive object={scene} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------------------
 * Mobile ring driver: swipe anywhere to spin, snap to the nearest device.
 * ------------------------------------------------------------------------- */

function RingDriver({
  ringAngle: ringAngleRef,
  ringTarget: ringTargetRef,
  onFront,
}: {
  ringAngle: React.RefObject<number>;
  ringTarget: React.RefObject<number>;
  onFront: (index: number) => void;
}) {
  const { gl } = useThree();
  const lastFront = useRef(-1);
  const step = (Math.PI * 2) / ITEMS.length;

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      ringTargetRef.current = (ringTargetRef.current ?? 0) + (e.clientX - lastX) * 0.007;
      lastX = e.clientX;
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl, ringTargetRef]);

  useFrame((_, delta) => {
    // settle to the nearest slot, then ease the visible angle toward it
    ringTargetRef.current = THREE.MathUtils.damp(
      ringTargetRef.current ?? 0,
      Math.round((ringTargetRef.current ?? 0) / step) * step,
      3,
      delta
    );
    ringAngleRef.current = THREE.MathUtils.damp(ringAngleRef.current ?? 0, ringTargetRef.current ?? 0, 6, delta);

    const n = ITEMS.length;
    const front = ((Math.round(-(ringTargetRef.current ?? 0) / step) % n) + n) % n;
    if (front !== lastFront.current) {
      lastFront.current = front;
      onFront(front);
    }
  });

  return null;
}

/** A theatre spotlight that glides over whichever device is hovered (or is
    front-of-ring on phones), dimming the house lights while it's on. */
function SpotRig({
  hoverIndex,
  groups,
  ambient: ambientRef,
  hemi: hemiRef,
}: {
  hoverIndex: React.RefObject<number>;
  groups: React.RefObject<(THREE.Group | null)[]>;
  ambient: React.RefObject<THREE.AmbientLight | null>;
  hemi: React.RefObject<THREE.HemisphereLight | null>;
}) {
  const light = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D | null>(null);
  targetRef.current ??= new THREE.Object3D();

  useFrame((_, delta) => {
    const spot = light.current;
    const target = targetRef.current;
    if (!spot || !target) return;
    const idx = hoverIndex.current ?? -1;
    const g = idx >= 0 ? groups.current?.[idx] : null;
    const on = Boolean(g);

    if (g) {
      spot.position.x = THREE.MathUtils.damp(spot.position.x, g.position.x, 8, delta);
      spot.position.y = THREE.MathUtils.damp(spot.position.y, g.position.y + 4.2, 8, delta);
      spot.position.z = THREE.MathUtils.damp(spot.position.z, g.position.z + 0.8, 8, delta);
      target.position.x = THREE.MathUtils.damp(target.position.x, g.position.x, 8, delta);
      target.position.y = THREE.MathUtils.damp(target.position.y, g.position.y, 8, delta);
      target.position.z = THREE.MathUtils.damp(target.position.z, g.position.z, 8, delta);
    }
    spot.intensity = THREE.MathUtils.damp(spot.intensity, on ? 260 : 0, 7, delta);

    // dim the house lights while the beam is up
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.damp(ambientRef.current.intensity, on ? 0.35 : 0.8, 6, delta);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.damp(hemiRef.current.intensity, on ? 0.3 : 0.7, 6, delta);
    }
  });

  return (
    <>
      <primitive object={targetRef.current} />
      <spotLight
        ref={light}
        position={[0, 5, 1]}
        target={targetRef.current}
        angle={0.42}
        penumbra={0.65}
        distance={14}
        decay={1.6}
        intensity={0}
        color="#f4f6ff"
      />
    </>
  );
}

interface HubSceneProps {
  onPick: (id: HubSection) => void;
  onHover: (id: HubSection | null) => void;
}

export default function HubScene({ onPick, onHover }: HubSceneProps) {
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [mobile, setMobile] = useState(() => window.innerWidth < 700);
  const [frontIndex, setFrontIndex] = useState(0);
  const ringAngle = useRef(0);
  const ringTarget = useRef(0);
  const itemGroups = useRef<(THREE.Group | null)[]>([]);
  const hoverIndex = useRef(-1);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 699px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // surface the front device in the status bar on phones
  useEffect(() => {
    if (mobile) {
      onHover(ITEMS[frontIndex]?.id ?? null);
      hoverIndex.current = frontIndex;
    }
  }, [mobile, frontIndex, onHover]);

  const step = (Math.PI * 2) / ITEMS.length;

  return (
    <Canvas
      camera={{ position: [0, 2.6, 8.2], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent", touchAction: "none" }}
      onCreated={({ camera }) => camera.lookAt(0, -0.75, 0)}
    >
      <ambientLight ref={ambientRef} intensity={0.8} />
      <hemisphereLight ref={hemiRef} intensity={0.7} color="#ffffff" groundColor="#6f7fd8" />
      <directionalLight position={[4, 6, 6]} intensity={1.7} />
      <directionalLight position={[-6, 2, -4]} intensity={0.7} color="#8fa8ff" />
      {ITEMS.filter(
        (item) =>
          !new URLSearchParams(window.location.search).get("only") ||
          new URLSearchParams(window.location.search).get("only") === item.id
      ).map((item, i) => (
        <HubItem
          key={item.id}
          def={item}
          index={i}
          mobile={mobile}
          ringAngle={ringAngle}
          frontIndex={frontIndex}
          reducedMotion={reducedMotion}
          onPick={onPick}
          onHover={(id) => {
            if (!mobile) hoverIndex.current = id === null ? -1 : i;
            onHover(id);
          }}
          registerGroup={(idx, g) => {
            itemGroups.current[idx] = g;
          }}
          onSpinTo={(index) => {
            const want = -index * step;
            const cur = ringTarget.current ?? 0;
            const delta = ((((want - cur) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            ringTarget.current = cur + delta;
          }}
        />
      ))}
      {mobile && <RingDriver ringAngle={ringAngle} ringTarget={ringTarget} onFront={setFrontIndex} />}
      <SpotRig hoverIndex={hoverIndex} groups={itemGroups} ambient={ambientRef} hemi={hemiRef} />
      <ContactShadows
        position={[0, GROUND - 0.01, 0]}
        opacity={mobile ? 0.3 : 0.45}
        scale={14}
        blur={1.9}
        far={4}
        resolution={512}
      />
    </Canvas>
  );
}
