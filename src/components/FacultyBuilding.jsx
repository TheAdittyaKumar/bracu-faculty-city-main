import { useMemo, useRef } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DATA_NOT_GIVEN = "Data not given";

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getPublicationCount(faculty) {
  const publications = toArray(faculty.publications);
  if (publications.length > 0) return publications.length;

  const count = Number(faculty.publicationCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getDisplayCode(faculty) {
  const code = String(faculty.code || "").trim();

  if (code && code !== DATA_NOT_GIVEN) {
    return code.toUpperCase();
  }

  const name = String(faculty.name || "").trim();

  if (!name || name === DATA_NOT_GIVEN) {
    return "?";
  }

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function getDesignationKey(faculty) {
  const designation = String(faculty.designation || faculty.role || "").toLowerCase();

  if (
    designation.includes("professor") &&
    !designation.includes("associate") &&
    !designation.includes("assistant")
  ) {
    return "Professor";
  }

  if (designation.includes("associate professor")) return "Associate Professor";
  if (designation.includes("assistant professor")) return "Assistant Professor";
  if (designation.includes("senior lecturer")) return "Senior Lecturer";
  if (designation.includes("adjunct lecturer")) return "Adjunct Lecturer";
  if (designation.includes("lecturer")) return "Lecturer";

  return "Other";
}

function getBuildingStyle(faculty) {
  const designationKey = getDesignationKey(faculty);

  const styles = {
    Professor: {
      color: "#1d4ed8",
      sideColor: "#0b1e63",
      roofColor: "#020617",
      trimColor: "#93c5fd",
      width: 2.15,
      depth: 2.15,
      baseHeight: 2.7,
      maxExtraHeight: 5.8
    },
    "Associate Professor": {
      color: "#0f766e",
      sideColor: "#064e3b",
      roofColor: "#020617",
      trimColor: "#99f6e4",
      width: 1.85,
      depth: 1.85,
      baseHeight: 2.25,
      maxExtraHeight: 4.9
    },
    "Assistant Professor": {
      color: "#0891b2",
      sideColor: "#164e63",
      roofColor: "#020617",
      trimColor: "#a5f3fc",
      width: 1.6,
      depth: 1.6,
      baseHeight: 1.9,
      maxExtraHeight: 4.1
    },
    "Senior Lecturer": {
      color: "#6d28d9",
      sideColor: "#3b0764",
      roofColor: "#050816",
      trimColor: "#ddd6fe",
      width: 1.38,
      depth: 1.38,
      baseHeight: 1.45,
      maxExtraHeight: 3.3
    },
    Lecturer: {
      color: "#92400e",
      sideColor: "#451a03",
      roofColor: "#120804",
      trimColor: "#fed7aa",
      width: 1.2,
      depth: 1.2,
      baseHeight: 1.15,
      maxExtraHeight: 2.7
    },
    "Adjunct Lecturer": {
      color: "#4c1d95",
      sideColor: "#2e1065",
      roofColor: "#050816",
      trimColor: "#c4b5fd",
      width: 1.08,
      depth: 1.08,
      baseHeight: 1.0,
      maxExtraHeight: 2.2
    },
    Other: {
      color: "#334155",
      sideColor: "#111827",
      roofColor: "#050816",
      trimColor: "#cbd5e1",
      width: 1.12,
      depth: 1.12,
      baseHeight: 1.05,
      maxExtraHeight: 2.1
    }
  };

  return styles[designationKey] || styles.Other;
}

function getThesisInfo(faculty) {
  const status = String(faculty.thesisStatus || "").toLowerCase();
  const level = String(faculty.supervisionLevel || "").toLowerCase();

  const accepting = status.includes("accepting") && !status.includes("not");
  const notAccepting = status.includes("not accepting");

  const acceptsUG = accepting && level.includes("undergraduate");

  const acceptsPG =
    accepting &&
    (level.includes("postgraduate") ||
      level.includes("graduate") ||
      level.includes("master"));

  let label = "?";
  let color = "#f59e0b";

  if (acceptsUG && acceptsPG) {
    label = "UG+PG";
    color = "#16a34a";
  } else if (acceptsUG) {
    label = "UG";
    color = "#22c55e";
  } else if (acceptsPG) {
    label = "PG";
    color = "#14b8a6";
  } else if (accepting) {
    label = "OPEN";
    color = "#22c55e";
  } else if (notAccepting) {
    label = "OFF";
    color = "#64748b";
  }

  return {
    accepting,
    notAccepting,
    acceptsUG,
    acceptsPG,
    label,
    color
  };
}

function WindowGrid({ width, depth, height, isDimmed, thesisInfo, performanceMode }) {
  const windows = [];

  const maxRows = performanceMode ? 2 : 4;
  const rowCount = Math.max(1, Math.min(maxRows, Math.floor(height / 1.05)));

  const windowColor = thesisInfo.accepting ? "#fef08a" : "#111827";
  const emissive = thesisInfo.accepting ? "#facc15" : "#000000";
  const emissiveIntensity = thesisInfo.accepting ? 0.28 : 0;
  const opacity = isDimmed ? 0.16 : 0.92;

  for (let row = 0; row < rowCount; row++) {
    const y = 0.78 + row * 0.86;

    // Front window strip
    windows.push(
      <mesh
        key={`front-strip-${row}`}
        position={[0, y, -depth / 2 - 0.018]}
      >
        <boxGeometry args={[width * 0.68, 0.15, 0.025]} />
        <meshStandardMaterial
          color={windowColor}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>
    );

    // Back window strip
    windows.push(
      <mesh
        key={`back-strip-${row}`}
        position={[0, y, depth / 2 + 0.018]}
      >
        <boxGeometry args={[width * 0.68, 0.15, 0.025]} />
        <meshStandardMaterial
          color={windowColor}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>
    );
  }

  return <>{windows}</>;
}

function StaticRings({ thesisInfo, width }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[width * 0.82, width * 1.02, 32]} />
        <meshBasicMaterial
          color={thesisInfo.color}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function AnimatedRings({ isSelected, width }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;

    const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.12;
    ref.current.scale.set(pulse, pulse, pulse);
  });

  const mainColor = isSelected ? "#ef4444" : "#22c55e";
  const secondColor = "#facc15";

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[width * 0.82, width * 1.02, 40]} />
        <meshBasicMaterial
          color={mainColor}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <ringGeometry args={[width * 1.08, width * 1.22, 40]} />
        <meshBasicMaterial
          color={secondColor}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function FacultyBuilding({
  faculty,
  position = [0, 0, 0],
  onSelect,
  isDimmed = false,
  isHighlighted = false,
  isSelected = false,
  performanceMode = true
}) {
  const publicationCount = getPublicationCount(faculty);
  const code = getDisplayCode(faculty);
  const thesisInfo = getThesisInfo(faculty);
  const style = getBuildingStyle(faculty);

  const buildingHeight = useMemo(() => {
    const scaledHeight = Math.log10(publicationCount + 1) * style.maxExtraHeight;
    return style.baseHeight + scaledHeight;
  }, [publicationCount, style.baseHeight, style.maxExtraHeight]);

  const opacity = isDimmed ? 0.16 : 1;
  const roofY = buildingHeight + 0.18;

  const showHeavyText = !performanceMode || isHighlighted || isSelected;

  function handleSelect(event) {
    event.stopPropagation();
    onSelect?.(faculty);
  }

  return (
    <group position={position} onClick={handleSelect}>
      {isHighlighted || isSelected ? (
        <AnimatedRings isSelected={isSelected} width={style.width} />
      ) : (
        <StaticRings thesisInfo={thesisInfo} width={style.width} />
      )}

      {/* foundation */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[style.width + 0.46, 0.16, style.depth + 0.46]} />
        <meshStandardMaterial
          color="#111827"
          transparent
          opacity={isDimmed ? 0.14 : 1}
        />
      </mesh>

      {/* main body */}
      <mesh position={[0, buildingHeight / 2 + 0.16, 0]}>
        <boxGeometry args={[style.width, buildingHeight, style.depth]} />
        <meshStandardMaterial
          color={style.color}
          roughness={0.62}
          metalness={0.1}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* right side depth panel */}
      <mesh position={[style.width / 2 + 0.012, buildingHeight / 2 + 0.16, 0]}>
        <boxGeometry args={[0.04, buildingHeight * 0.96, style.depth * 0.94]} />
        <meshStandardMaterial
          color={style.sideColor}
          transparent
          opacity={isDimmed ? 0.12 : 0.75}
        />
      </mesh>

      {/* roof slab */}
      <mesh position={[0, roofY, 0]}>
        <boxGeometry args={[style.width + 0.55, 0.24, style.depth + 0.55]} />
        <meshStandardMaterial
          color={style.roofColor}
          roughness={0.72}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* roof cap */}
      <mesh position={[0, roofY + 0.18, 0]}>
        <boxGeometry args={[style.width * 0.72, 0.12, style.depth * 0.72]} />
        <meshStandardMaterial
          color={style.sideColor}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* small pyramid roof detail */}
      {!performanceMode && (
        <mesh position={[0, roofY + 0.31, 0]}>
          <coneGeometry args={[style.width * 0.38, 0.85, 4]} />
          <meshStandardMaterial
            color={style.trimColor}
            metalness={0.18}
            roughness={0.5}
            transparent
            opacity={isDimmed ? 0.12 : 0.95}
          />
        </mesh>
      )}

      <WindowGrid
        width={style.width}
        depth={style.depth}
        height={buildingHeight}
        isDimmed={isDimmed}
        thesisInfo={thesisInfo}
        performanceMode={performanceMode}
      />

      {/* thesis status sign */}
      <group position={[0, roofY + 0.24, -style.depth * 0.34]}>
        <mesh>
          <boxGeometry args={[style.width * 0.82, 0.3, 0.08]} />
          <meshStandardMaterial
            color={thesisInfo.color}
            emissive={thesisInfo.accepting ? thesisInfo.color : "#000000"}
            emissiveIntensity={thesisInfo.accepting ? 0.24 : 0}
            transparent
            opacity={isDimmed ? 0.16 : 1}
          />
        </mesh>

        {!isDimmed && showHeavyText && (
          <Text
            position={[0, 0.012, -0.052]}
            fontSize={0.15}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.014}
          >
            {thesisInfo.label}
          </Text>
        )}
      </group>

      {/* readable initials only when performance cost is acceptable */}
      {!isDimmed && showHeavyText && (
        <Billboard position={[0, buildingHeight + 1.0, 0]}>
          <Text
            fontSize={0.58}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.075}
            maxWidth={3.2}
          >
            {code}
          </Text>
        </Billboard>
      )}

      {/* lightweight roof code plate in performance mode */}
      {!isDimmed && performanceMode && !isHighlighted && !isSelected && (
        <mesh position={[0, roofY + 0.28, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[style.width * 0.82, 0.22]} />
          <meshBasicMaterial
            color="#f8fafc"
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* search / selected glow */}
      {(isHighlighted || isSelected) && (
        <mesh position={[0, buildingHeight / 2 + 0.35, 0]}>
          <cylinderGeometry
            args={[style.width * 0.88, style.width * 0.88, buildingHeight + 1.2, 24, 1, true]}
          />
          <meshBasicMaterial
            color={isSelected ? "#ef4444" : "#22c55e"}
            transparent
            opacity={0.13}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}