import { Canvas } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

interface AgentCard3DProps {
  rotationX: number;
  rotationY: number;
}

function PhotoFrame() {
  return (
    <group>
      <RoundedBox args={[2.6, 3.0, 0.12]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#6b7b6b" roughness={0.6} metalness={0.1} />
      </RoundedBox>

      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[2.3, 2.7]} />
        <meshStandardMaterial color="#7a8a7a" roughness={0.8} />
      </mesh>
    </group>
  );
}

export default function AgentCard3D({
  rotationX,
  rotationY,
}: AgentCard3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 35 }}
      style={{ background: "transparent", pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[3 + rotationY * 0.15, 3 - rotationX * 0.15, 5]}
        intensity={0.6}
      />
      <pointLight
        position={[-2 + rotationY * 0.1, -1 - rotationX * 0.1, 3]}
        intensity={0.3}
        color="#b0c0ff"
      />
      <PhotoFrame />
    </Canvas>
  );
}
