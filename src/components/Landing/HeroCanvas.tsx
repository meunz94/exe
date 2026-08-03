import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* Slow-drifting fbm cloud. Rendered as a single fullscreen-ish plane so the
   whole effect costs one draw call — it sits behind the hero type and only
   needs to suggest movement, not resolve detail. */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  // value noise + fbm
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vUv * 3.0;
    float t = uTime * 0.035;

    // domain-warp so the cloud churns instead of merely sliding
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    float f = fbm(p + q * 1.8 + t * 0.5);

    vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.85, f));

    // fade out at the edges so the plane never shows a hard border
    float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x)
               * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);

    gl_FragColor = vec4(col, f * edge * 0.85);
  }
`;

function Clouds() {
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color("#1a1a1a") },
      uColorB: { value: new THREE.Color("#4a4a52") },
    }),
    []
  );

  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh scale={[12, 8, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Ambient background for the hero. Purely decorative — `pointer-events: none`
 * and capped at 1.5× DPR, since a soft noise field gains nothing from retina
 * resolution but costs 4× the fragments.
 */
export default function HeroCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false }}
      style={{ background: "transparent", pointerEvents: "none" }}
    >
      <Clouds />
    </Canvas>
  );
}
