import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { publicUrl } from "../lib/url";

const MONITOR_URL = publicUrl("models/monitor.glb");
const SCREEN_NODE = "Object_19";
const GROUND = -1.25;
useGLTF.preload(MONITOR_URL);

/** 켜진 화면: "PRESS ANY KEY..." — 다크는 검은 바탕 흰 글씨, 라이트는 흰 바탕 검은 글씨 */
function screenMaterial(label: string, sub: string, accent: string, light: boolean): THREE.MeshBasicMaterial {
  const W = 640;
  const H = 480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  void label;
  void sub;
  void accent;
  ctx.fillStyle = light ? "#f7f7f5" : "#050507";
  ctx.fillRect(0, 0, W, H);
  // 주사선
  ctx.fillStyle = light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.035)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = light ? "#141518" : "#e8ecf4";
  ctx.font = "400 30px 'IBM Plex Mono', monospace";
  ctx.fillText("PRESS ANY KEY...", 48, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
}

/** 캔버스 크기에 따른 모니터 축소 비율 — 폰처럼 좁거나 세로로 긴 캔버스에서 잘리지 않게 */
function shrinkFor(w: number, h: number): number {
  return Math.min(1, w / 560, (w / h / 0.9) * 0.9);
}

/** 모니터가 줄어든 만큼 카메라 시선을 내려 화면 세로 가운데에 오게 한다 */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const shrink = shrinkFor(size.width, size.height);
    camera.lookAt(0, -0.2 - (1 - shrink) * 1.45, 0);
  }, [camera, size]);
  return null;
}

function Monitor({ lit, light, label, sub, accent, onPick }: { lit: boolean; light: boolean; label: string; sub: string; accent: string; onPick: () => void }) {
  const { scene } = useGLTF(MONITOR_URL);
  const group = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  // 캔버스가 좁으면(폰) 모니터를 줄인다 — 560px 이하부터 비례 축소
  // 세로로 긴 캔버스(폰)에선 가시 폭이 줄므로 화면비로도 축소한다
  const shrink = shrinkFor(size.width, size.height);

  const fit = useMemo(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2.9 / (Math.max(size.x, size.y, size.z) || 1);
    return { scale, offset: center.multiplyScalar(-1), restY: GROUND + (size.y * scale) / 2 };
  }, [scene]);

  const mat = useMemo(() => screenMaterial(label, sub, accent, light), [label, sub, accent, light]);

  // 호버 → CRT 메시의 지오메트리/머티리얼을 켜진 화면으로 바꾼다 (원본 복원 가능하게)
  useEffect(() => {
    const crt = scene.getObjectByName(SCREEN_NODE) as THREE.Mesh | null;
    if (!crt) return;
    crt.userData.origGeo ??= crt.geometry;
    crt.userData.origMat ??= crt.material;
    if (!crt.userData.litGeo) {
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
      crt.userData.litGeo = geo;
    }
    const restore = () => {
      crt.geometry = crt.userData.origGeo as THREE.BufferGeometry;
      crt.material = crt.userData.origMat as THREE.Material;
    };
    if (lit) {
      crt.geometry = crt.userData.litGeo as THREE.BufferGeometry;
      crt.material = mat;
    } else restore();
    return restore;
  }, [scene, lit, mat]);


  return (
    <group
      ref={group}
      position={[0, GROUND + (fit.restY - GROUND) * shrink, 0]}
      rotation={[0, -0.26, 0]}
      scale={shrink}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6) return;
        onPick();
      }}
    >
      <group scale={fit.scale}>
        <group position={fit.offset}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

/** 바닥에 떨어지는 조명 웅덩이 — 강조색 방사형 그라데이션 원판 */
function poolTexture(color: string): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function LightPool({ on, color, soft }: { on: boolean; color: string; soft: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => poolTexture(color), [color]);
  const size = useThree((s) => s.size);
  const k = shrinkFor(size.width, size.height);
  useFrame((_, delta) => {
    if (mat.current) mat.current.opacity = THREE.MathUtils.damp(mat.current.opacity, on ? (soft ? 0.7 : 0.55) : 0, 7, delta);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.15 * k, GROUND + 0.004, 0.15 * k]} scale={[3.2 * k, 1.9 * k, 1]}>
      <circleGeometry args={[1, 64]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** 호버하면 켜지는 극장 조명 — 집 조명은 그만큼 어두워진다 */
function SpotRig({ on, color, soft }: { on: boolean; color: string; soft: boolean }) {
  const light = useRef<THREE.SpotLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, GROUND + 1.2, 0);
    return o;
  }, []);
  // 다크 모드는 집 조명 자체를 톤다운 — 모니터 본체가 더 어둡게 가라앉는다
  const base = soft ? 1 : 0.5;
  useFrame((_, delta) => {
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, on ? 220 : 0, 7, delta);
    if (ambient.current) ambient.current.intensity = THREE.MathUtils.damp(ambient.current.intensity, on ? (soft ? 0.75 : 0.28) : 1.1 * base, 6, delta);
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, on ? (soft ? 0.65 : 0.22) : 0.9 * base, 6, delta);
  });
  return (
    <>
      <ambientLight ref={ambient} intensity={1.1 * base} />
      <hemisphereLight ref={hemi} intensity={0.9 * base} color="#ffffff" groundColor="#c9ccd3" />
      <directionalLight position={[4, 6, 6]} intensity={1.4 * (soft ? 1 : 0.55)} />
      <directionalLight position={[-6, 2, -4]} intensity={0.5 * (soft ? 1 : 0.6)} color="#dfe3ff" />
      <primitive object={target} />
      <spotLight ref={light} position={[0.6, 5.2, 2.2]} target={target} angle={0.4} penumbra={0.7} distance={14} decay={1.6} intensity={0} color={color} />
    </>
  );
}

export default function MonitorScene({
  label,
  sub,
  accent,
  onHover,
  onPick,
}: {
  label: string;
  sub: string;
  accent: string;
  onHover: (on: boolean) => void;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const isLight = document.documentElement.dataset.theme !== "dark";
  const lightColor = useMemo(() => {
    const c = new THREE.Color(accent);
    if (!isLight) return accent;
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s * 0.75, Math.min(0.88, hsl.l + 0.22));
    return "#" + c.getHexString();
  }, [accent, isLight]);
  return (
    <Canvas
      camera={{ position: [0, 2.4, 7.0], fov: 36 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent", touchAction: "manipulation" }}
      onCreated={({ camera }) => camera.lookAt(0, -0.2, 0)}
      onPointerMissed={() => {
        setHover(false);
        onHover(false);
      }}
    >
      <CameraRig />
      <SpotRig on={hover} color={lightColor} soft={isLight} />
      <LightPool on={hover} color={lightColor} soft={isLight} />
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          onHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          onHover(false);
          document.body.style.cursor = "";
        }}
      >
        <Monitor lit={hover} light={isLight} label={label} sub={sub} accent={accent} onPick={onPick} />
      </group>
      <ContactShadows position={[0, GROUND - 0.01, 0]} opacity={0.4} scale={10} blur={2} far={3.5} resolution={512} />
    </Canvas>
  );
}
