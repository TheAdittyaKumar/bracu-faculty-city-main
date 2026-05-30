import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

const CAR_WIDTH = 1.05;
const CAR_LENGTH = 1.75;
const CAR_HEIGHT = 0.42;

function pointInsideRect(x, z, rect, margin = 0) {
  return (
    x >= rect.xMin - margin &&
    x <= rect.xMax + margin &&
    z >= rect.zMin - margin &&
    z <= rect.zMax + margin
  );
}

function pointOnAnyRoad(x, z, roadRects, margin = 0) {
  return roadRects.some((rect) => pointInsideRect(x, z, rect, margin));
}

function getCarCorners(x, z, angle) {
  const halfW = CAR_WIDTH / 2;
  const halfL = CAR_LENGTH / 2;

  const localCorners = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [-halfW, halfL],
    [halfW, halfL]
  ];

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  return localCorners.map(([localX, localZ]) => ({
    x: x + localX * cos + localZ * sin,
    z: z - localX * sin + localZ * cos
  }));
}

function carFullyOnRoad(x, z, angle, roadRects) {
  const corners = getCarCorners(x, z, angle);

  // Small tolerance prevents the car from getting stuck on road/sidewalk edges.
  const roadEdgeTolerance = 0.28;

  return corners.every((corner) =>
    pointOnAnyRoad(corner.x, corner.z, roadRects, roadEdgeTolerance)
  );
}

function carHitsBuilding(x, z, buildingColliders) {
  const safetyRadius = 0.82;

  return buildingColliders.some((box) => {
    return (
      x + safetyRadius > box.xMin &&
      x - safetyRadius < box.xMax &&
      z + safetyRadius > box.zMin &&
      z - safetyRadius < box.zMax
    );
  });
}

function canMoveTo(x, z, angle, roadRects, buildingColliders) {
  const onRoad = carFullyOnRoad(x, z, angle, roadRects);
  const hitsBuilding = carHitsBuilding(x, z, buildingColliders);

  return onRoad && !hitsBuilding;
}

function tryMoveWithSlide({
  currentX,
  currentZ,
  nextX,
  nextZ,
  angle,
  roadRects,
  buildingColliders
}) {
  // 1. Try normal movement first.
  if (canMoveTo(nextX, nextZ, angle, roadRects, buildingColliders)) {
    return {
      moved: true,
      x: nextX,
      z: nextZ
    };
  }

  // 2. Try sliding only on X.
  if (canMoveTo(nextX, currentZ, angle, roadRects, buildingColliders)) {
    return {
      moved: true,
      x: nextX,
      z: currentZ
    };
  }

  // 3. Try sliding only on Z.
  if (canMoveTo(currentX, nextZ, angle, roadRects, buildingColliders)) {
    return {
      moved: true,
      x: currentX,
      z: nextZ
    };
  }

  // 4. Movement blocked.
  return {
    moved: false,
    x: currentX,
    z: currentZ
  };
}

function CarModel({ boostRef, isNight, playerName }) {
  return (
    <group>
      <Billboard position={[0, 1.5, 0]}>
        <mesh position={[0, -0.02, -0.02]}>
          <boxGeometry args={[2.25, 0.42, 0.05]} />
          <meshBasicMaterial color="#111827" transparent opacity={0.78} />
        </mesh>

        <Text
          position={[0, 0, 0.04]}
          fontSize={0.16}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.05}
        >
          {playerName || "Player"}
        </Text>
      </Billboard>

      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 28]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.24} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH]} />
        <meshStandardMaterial
          color="#0047ba"
          metalness={0.35}
          roughness={0.32}
          emissive={isNight ? "#001a70" : "#000000"}
          emissiveIntensity={isNight ? 0.15 : 0}
        />
      </mesh>

      <mesh position={[0, 0.66, 0.08]}>
        <boxGeometry args={[0.7, 0.36, 0.76]} />
        <meshStandardMaterial
          color="#0b1f4d"
          metalness={0.45}
          roughness={0.25}
          emissive={isNight ? "#0f172a" : "#000000"}
          emissiveIntensity={isNight ? 0.18 : 0}
        />
      </mesh>

      <mesh position={[0, 0.72, 0.36]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[0.58, 0.18, 0.025]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.82} />
      </mesh>

      <mesh position={[0, 0.69, -0.22]} rotation={[-0.42, 0, 0]}>
        <boxGeometry args={[0.56, 0.15, 0.025]} />
        <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
      </mesh>

      <mesh position={[0, 0.45, 0.62]}>
        <boxGeometry args={[0.82, 0.08, 0.34]} />
        <meshStandardMaterial color="#0a4fc9" metalness={0.4} roughness={0.28} />
      </mesh>

      <mesh position={[0, 0.66, -0.68]}>
        <boxGeometry args={[0.72, 0.05, 0.12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[0, 0.26, 0.91]}>
        <boxGeometry args={[0.86, 0.13, 0.08]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[0, 0.26, -0.91]}>
        <boxGeometry args={[0.86, 0.13, 0.08]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[-0.25, 0.37, 0.91]}>
        <boxGeometry args={[0.16, 0.09, 0.04]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive={isNight ? "#fff7cc" : "#fef3c7"}
          emissiveIntensity={isNight ? 1.85 : 0.25}
        />
      </mesh>

      <mesh position={[0.25, 0.37, 0.91]}>
        <boxGeometry args={[0.16, 0.09, 0.04]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive={isNight ? "#fff7cc" : "#fef3c7"}
          emissiveIntensity={isNight ? 1.85 : 0.25}
        />
      </mesh>

      {isNight && (
        <>
          <mesh position={[-0.25, 0.35, 1.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.16, 1.0, 14]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.3} depthWrite={false} />
          </mesh>

          <mesh position={[0.25, 0.35, 1.22]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.16, 1.0, 14]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </>
      )}

      <mesh position={[-0.24, 0.35, -0.91]}>
        <boxGeometry args={[0.16, 0.08, 0.04]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={isNight ? 0.9 : 0.35}
        />
      </mesh>

      <mesh position={[0.24, 0.35, -0.91]}>
        <boxGeometry args={[0.16, 0.08, 0.04]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={isNight ? 0.9 : 0.35}
        />
      </mesh>

      {/* Cleaner side wheels */}
{[
  [-0.57, 0.2, 0.54],
  [0.57, 0.2, 0.54],
  [-0.57, 0.2, -0.54],
  [0.57, 0.2, -0.54]
].map(([x, y, z], i) => {
  const isLeftSide = x < 0;

  return (
    <group key={i} position={[x, y, z]}>
      {/* tire: cylinder axis points left-right now */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.16, 18]} />
        <meshStandardMaterial
          color="#020617"
          roughness={0.72}
          metalness={0.05}
        />
      </mesh>

      {/* rim */}
      <mesh
        position={[isLeftSide ? -0.085 : 0.085, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.082, 0.082, 0.035, 14]} />
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.55}
          roughness={0.28}
        />
      </mesh>

      {/* small dark center cap */}
      <mesh
        position={[isLeftSide ? -0.106 : 0.106, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.018, 12]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
})}

{/* Simple fenders to hide upper wheel awkwardness */}
{[
  [-0.55, 0.34, 0.54],
  [0.55, 0.34, 0.54],
  [-0.55, 0.34, -0.54],
  [0.55, 0.34, -0.54]
].map((p, i) => (
  <mesh key={`fender-${i}`} position={p}>
    <boxGeometry args={[0.12, 0.14, 0.42]} />
    <meshStandardMaterial
      color="#003a9b"
      metalness={0.3}
      roughness={0.35}
    />
  </mesh>
))}

      <group ref={boostRef} visible={false}>
        <mesh position={[-0.16, 0.3, -1.02]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.34, 10]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#38bdf8"
            emissiveIntensity={2}
          />
        </mesh>

        <mesh position={[0.16, 0.3, -1.02]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.34, 10]} />
          <meshStandardMaterial
            color="#67e8f9"
            emissive="#22d3ee"
            emissiveIntensity={2}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function CarController({
  roadRects = [],
  buildingColliders = [],
  startPosition = [0, 0.25, 0],
  isNight = false,
  playerName = "Adittya Kumar Chowdhury"
}) {
  const carRef = useRef();
  const boostRef = useRef();
  const keys = useRef({});

  const position = useRef(
    new THREE.Vector3(startPosition[0], startPosition[1], startPosition[2])
  );

  const angle = useRef(0);
  const currentSpeed = useRef(0);
  const telemetryTimer = useRef(0);
  const focusTarget = useRef(null);

  const { camera } = useThree();

  useEffect(() => {
    const handleKeyDown = (event) => {
      keys.current[event.key.toLowerCase()] = true;

      if (["w", "a", "s", "d", "shift"].includes(event.key.toLowerCase())) {
        focusTarget.current = null;
      }
    };

    const handleKeyUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    const handleFocusBuilding = (event) => {
      const target = event.detail?.position;
      if (!target) return;

      focusTarget.current = new THREE.Vector3(target.x, 1.5, target.z);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("facultycity-focus-building", handleFocusBuilding);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("facultycity-focus-building", handleFocusBuilding);
    };
  }, []);

  useFrame((_, delta) => {
    if (!carRef.current) return;

    const baseMoveSpeed = 8.2;
const nitroMultiplier = 2.25;
const turnSpeed = 2.35;

    const turningLeft = keys.current.a;
    const turningRight = keys.current.d;
    const movingForward = keys.current.w;
    const movingBackward = keys.current.s;
    const boosting = keys.current.shift && movingForward;
    const moving = movingForward || movingBackward;

    if (turningLeft) angle.current += turnSpeed * delta;
    if (turningRight) angle.current -= turnSpeed * delta;

    let movement = 0;

    const activeMoveSpeed = boosting
      ? baseMoveSpeed * nitroMultiplier
      : baseMoveSpeed;

    if (movingForward) movement += activeMoveSpeed * delta;
    if (movingBackward) movement -= baseMoveSpeed * delta * 0.65;

    if (movement !== 0) {
  const currentX = position.current.x;
  const currentZ = position.current.z;

  const nextX = currentX + Math.sin(angle.current) * movement;
  const nextZ = currentZ + Math.cos(angle.current) * movement;

  const slideResult = tryMoveWithSlide({
    currentX,
    currentZ,
    nextX,
    nextZ,
    angle: angle.current,
    roadRects,
    buildingColliders
  });

  if (slideResult.moved) {
    position.current.x = slideResult.x;
    position.current.z = slideResult.z;
    currentSpeed.current = Math.abs(movement / Math.max(delta, 0.001)) * 5.8;
  } else {
    // Small reverse nudge helps escape sidewalk/curb lock.
    const nudge = movement > 0 ? -0.045 : 0.045;

    const nudgeX = currentX + Math.sin(angle.current) * nudge;
    const nudgeZ = currentZ + Math.cos(angle.current) * nudge;

    if (canMoveTo(nudgeX, nudgeZ, angle.current, roadRects, buildingColliders)) {
      position.current.x = nudgeX;
      position.current.z = nudgeZ;
    }

    currentSpeed.current *= 0.82;
  }
} else {
  currentSpeed.current *= 0.9;
}

    if (boostRef.current) {
      boostRef.current.visible = boosting;
      boostRef.current.scale.setScalar(
        boosting ? 1 + Math.sin(performance.now() * 0.02) * 0.15 : 1
      );
    }

    carRef.current.position.copy(position.current);
    carRef.current.rotation.y = angle.current;

    if (focusTarget.current && !moving && !turningLeft && !turningRight) {
      const target = focusTarget.current;

      const cameraTarget = new THREE.Vector3(
        target.x + 4.8,
        target.y + 4.4,
        target.z + 5.2
      );

      camera.position.lerp(cameraTarget, 0.08);
      camera.lookAt(target.x, target.y + 0.8, target.z);
    } else {
      const followDistance = boosting ? 9.2 : 8;
      const followHeight = boosting ? 5.6 : 5.2;
      const cameraShake = boosting
        ? Math.sin(performance.now() * 0.04) * 0.08
        : 0;

      const cameraTarget = new THREE.Vector3(
        position.current.x - Math.sin(angle.current) * followDistance,
        followHeight + cameraShake,
        position.current.z - Math.cos(angle.current) * followDistance
      );

      camera.position.lerp(cameraTarget, 0.12);

      camera.lookAt(
        position.current.x + Math.sin(angle.current) * 3.2,
        position.current.y + 0.8,
        position.current.z + Math.cos(angle.current) * 3.2
      );
    }

    telemetryTimer.current += delta;

    if (telemetryTimer.current > 0.25) {
      telemetryTimer.current = 0;

      window.dispatchEvent(
  new CustomEvent("facultycity-telemetry", {
    detail: {
      speedKmh: currentSpeed.current,
      nitroActive: boosting,
      carAngle: angle.current,
      carPosition: {
        x: position.current.x,
        z: position.current.z
      }
    }
  })
);
    }
  });

  return (
    <group ref={carRef}>
      <CarModel boostRef={boostRef} isNight={isNight} playerName={playerName} />
    </group>
  );
}