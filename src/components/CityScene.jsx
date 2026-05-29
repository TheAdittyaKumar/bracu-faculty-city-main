import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

import facultyData from "../data/faculty.json";
import FacultyBuilding from "./FacultyBuilding";
import FacultyCard from "./FacultyCard";
import CarController from "./CarController";

const EDIT_API_BASE = "http://localhost:5174";

const ROAD_WIDTH = 4;
const LOT_SPACING = 4.4;
const BUILDING_SIDE_OFFSET = 4.8;
const INTERSECTION_CLEARANCE = 5.5;

const DISTRICTS = [
  {
    key: "Professor",
    label: "Professor Plaza",
    short: "PROF",
    x: -34,
    color: "#1d4ed8",
    ground: "#bfd8f6"
  },
  {
    key: "Associate Professor",
    label: "Associate Avenue",
    short: "ASC",
    x: -20,
    color: "#0f766e",
    ground: "#cfeee5"
  },
  {
    key: "Assistant Professor",
    label: "Assistant Block",
    short: "AST",
    x: -6,
    color: "#0891b2",
    ground: "#d3eef4"
  },
  {
    key: "Senior Lecturer",
    label: "Senior Lecturer Street",
    short: "SL",
    x: 8,
    color: "#7c3aed",
    ground: "#ddd6fe"
  },
  {
    key: "Lecturer",
    label: "Lecturer Lane",
    short: "LEC",
    x: 22,
    color: "#b45309",
    ground: "#f0d5b8"
  },
  {
    key: "Adjunct Lecturer",
    label: "Adjunct Zone",
    short: "ADJ",
    x: 36,
    color: "#92400e",
    ground: "#ead7aa"
  },
  {
    key: "Other",
    label: "Other Faculty Zone",
    short: "OTH",
    x: 50,
    color: "#475569",
    ground: "#dce2e8"
  }
];

const DEFAULT_INTERESTS = [
  "AI",
  "Machine Learning",
  "HCI",
  "Cybersecurity",
  "NLP",
  "Software Engineering",
  "Computer Vision",
  "Data Science",
  "Networking",
  "Algorithms",
  "Database",
  "Robotics"
];

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

function getDistrictKey(faculty) {
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

function getDistrictColor(key) {
  return DISTRICTS.find((district) => district.key === key)?.color || "#475569";
}

function getThesisFlags(faculty) {
  const status = String(faculty.thesisStatus || "").toLowerCase();
  const level = String(faculty.supervisionLevel || "").toLowerCase();
  const type = String(faculty.supervisionType || "").toLowerCase();

  const accepting = status.includes("accepting") && !status.includes("not");
  const notAccepting = status.includes("not accepting");

  const acceptsUG =
    accepting &&
    (level.includes("undergraduate") ||
      level.includes("ug") ||
      type.includes("undergraduate") ||
      type.includes("ug"));

  const acceptsPG =
    accepting &&
    (level.includes("postgraduate") ||
      level.includes("graduate") ||
      level.includes("master") ||
      level.includes("pg") ||
      type.includes("postgraduate") ||
      type.includes("graduate") ||
      type.includes("master") ||
      type.includes("pg"));

  return {
    accepting,
    notAccepting,
    acceptsUG,
    acceptsPG
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function buildSearchTerms(rawQuery) {
  const raw = String(rawQuery || "").trim().toLowerCase();

  if (!raw) return [];

  const phraseTerms = raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const wordTerms = raw
    .split(/[^a-z0-9+#.]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  return Array.from(new Set([...phraseTerms, ...wordTerms]));
}

function getFacultySearchFields(faculty) {
  return {
    name: normalizeText(faculty.name),
    code: normalizeText(faculty.code),
    designation: normalizeText(faculty.designation || faculty.role),
    biography: normalizeText(faculty.biography),
    research: normalizeText(toArray(faculty.researchInterests).join(" ")),
    publications: normalizeText(toArray(faculty.publications).join(" ")),
    courses: normalizeText(toArray(faculty.courses).join(" ")),
    thesis: normalizeText(toArray(faculty.synopsis).join(" "))
  };
}

function scoreFacultyRecommendation(faculty, query) {
  const terms = buildSearchTerms(query);
  if (!terms.length) return null;

  const fields = getFacultySearchFields(faculty);
  const thesis = getThesisFlags(faculty);
  const publicationCount = getPublicationCount(faculty);

  let score = 0;
  let matchedTerms = 0;
  const reasons = [];

  for (const term of terms) {
    let termMatched = false;

    if (fields.research.includes(term)) {
      score += 16;
      termMatched = true;
      reasons.push(`research: ${term}`);
    }

    if (fields.biography.includes(term)) {
      score += 6;
      termMatched = true;
    }

    if (fields.publications.includes(term)) {
      score += 5;
      termMatched = true;
      reasons.push(`publication match`);
    }

    if (fields.courses.includes(term)) {
      score += 3;
      termMatched = true;
      reasons.push(`course match`);
    }

    if (fields.thesis.includes(term)) {
      score += 4;
      termMatched = true;
    }

    if (fields.name.includes(term) || fields.code.includes(term)) {
      score += 2;
      termMatched = true;
    }

    if (termMatched) matchedTerms += 1;
  }

  if (matchedTerms === 0) return null;

  if (thesis.accepting) {
    score += 5;
    reasons.push("accepting thesis");
  }

  const publicationBonus = Math.min(10, Math.log1p(publicationCount) * 3);
  score += publicationBonus;

  const maxScore = terms.length * 18 + 18;
  const matchPercent = Math.min(100, Math.round((score / maxScore) * 100));

  return {
    faculty,
    score,
    matchPercent,
    publicationCount,
    reasons: Array.from(new Set(reasons)).slice(0, 3)
  };
}

function scoreFacultyForThesisFinder(faculty, finder) {
  const thesis = getThesisFlags(faculty);
  const publicationCount = getPublicationCount(faculty);
  const designationKey = getDistrictKey(faculty);

  if (finder.acceptingOnly && !thesis.accepting) return null;

  if (finder.level === "UG" && !thesis.acceptsUG) return null;
  if (finder.level === "PG" && !thesis.acceptsPG) return null;

  if (finder.designation !== "All" && designationKey !== finder.designation) {
    return null;
  }

  if (publicationCount < Number(finder.minPublications || 0)) {
    return null;
  }

  const terms = buildSearchTerms(finder.topic);
  const fields = getFacultySearchFields(faculty);

  let score = 0;
  let matchedTopicTerms = 0;
  const reasons = [];

  if (thesis.accepting) {
    score += 40;
    reasons.push("accepting thesis");
  }

  if (thesis.acceptsUG) {
    score += 8;
    reasons.push("UG");
  }

  if (thesis.acceptsPG) {
    score += 8;
    reasons.push("PG");
  }

  for (const term of terms) {
    let termMatched = false;

    if (fields.research.includes(term)) {
      score += 18;
      termMatched = true;
      reasons.push(`research: ${term}`);
    }

    if (fields.biography.includes(term)) {
      score += 6;
      termMatched = true;
    }

    if (fields.publications.includes(term)) {
      score += 5;
      termMatched = true;
    }

    if (fields.thesis.includes(term)) {
      score += 8;
      termMatched = true;
    }

    if (fields.courses.includes(term)) {
      score += 3;
      termMatched = true;
    }

    if (termMatched) matchedTopicTerms += 1;
  }

  if (terms.length > 0 && matchedTopicTerms === 0) return null;

  score += Math.min(12, Math.log1p(publicationCount) * 3);

  return {
    faculty,
    score,
    publicationCount,
    thesis,
    reasons: Array.from(new Set(reasons)).slice(0, 4)
  };
}

function matchesSearch(faculty, searchTerm) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;

  const code = String(faculty.code || "").toLowerCase();
  const name = String(faculty.name || "").toLowerCase();

  if (query.length <= 4) {
    return (
      code === query ||
      code.startsWith(query) ||
      name.split(/\s+/).some((part) => part.startsWith(query))
    );
  }

  const searchable = [
    faculty.name,
    faculty.code,
    faculty.designation,
    faculty.role,
    faculty.email,
    faculty.biography,
    ...toArray(faculty.researchInterests),
    ...toArray(faculty.courses),
    ...toArray(faculty.publications)
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

function matchesDesignation(faculty, designationFilter) {
  if (designationFilter === "All") return true;
  return getDistrictKey(faculty) === designationFilter;
}

function matchesThesis(faculty, thesisFilter) {
  if (thesisFilter === "All") return true;

  const thesis = getThesisFlags(faculty);

  if (thesisFilter === "Accepting") return thesis.accepting;
  if (thesisFilter === "Not Accepting") return thesis.notAccepting;
  if (thesisFilter === "Undergraduate") return thesis.acceptsUG;
  if (thesisFilter === "Postgraduate") return thesis.acceptsPG;

  return true;
}

function isFacultyMatch(faculty, searchTerm, designationFilter, thesisFilter) {
  return (
    matchesSearch(faculty, searchTerm) &&
    matchesDesignation(faculty, designationFilter) &&
    matchesThesis(faculty, thesisFilter)
  );
}

function buildInterestSuggestions(facultyList) {
  const counts = new Map();

  for (const faculty of facultyList) {
    for (const interest of toArray(faculty.researchInterests)) {
      const cleaned = String(interest).trim();

      if (
        cleaned.length >= 2 &&
        cleaned.length <= 36 &&
        !cleaned.toLowerCase().includes("data not given")
      ) {
        counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
      }
    }
  }

  const dynamicInterests = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([interest]) => interest)
    .slice(0, 8);

  return Array.from(new Set([...DEFAULT_INTERESTS, ...dynamicInterests])).slice(0, 18);
}

function buildCityLayout(faculties) {
  const grouped = {};

  for (const district of DISTRICTS) {
    grouped[district.key] = [];
  }

  for (const faculty of faculties) {
    grouped[getDistrictKey(faculty)].push(faculty);
  }

  const maxGroupSize = Math.max(
    1,
    ...Object.values(grouped).map((items) => items.length)
  );

  const maxRows = Math.ceil(maxGroupSize / 2);

  const cityHalfLength = Math.max(
    45,
    maxRows * LOT_SPACING * 0.55 + INTERSECTION_CLEARANCE + 14
  );

  const buildings = [];
  const buildingColliders = [];

  for (const district of DISTRICTS) {
    const districtFaculty = grouped[district.key] || [];

    districtFaculty.forEach((faculty, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);

      let z = -cityHalfLength + 8 + row * LOT_SPACING;

      if (z > -INTERSECTION_CLEARANCE) {
        z += INTERSECTION_CLEARANCE * 2;
      }

      const x = district.x + side * BUILDING_SIDE_OFFSET;
      const position = [x, 0, z];

      buildings.push({
        faculty,
        position,
        districtKey: district.key,
        roadX: district.x,
        side
      });

      buildingColliders.push({
        xMin: x - 1.65,
        xMax: x + 1.65,
        zMin: z - 1.65,
        zMax: z + 1.65
      });
    });
  }

  const minX = DISTRICTS[0].x - 10;
  const maxX = DISTRICTS[DISTRICTS.length - 1].x + 10;
  const roadRects = [];

  for (const district of DISTRICTS) {
    roadRects.push({
      type: "vertical",
      key: district.key,
      label: district.label,
      short: district.short,
      color: district.color,
      xMin: district.x - ROAD_WIDTH / 2,
      xMax: district.x + ROAD_WIDTH / 2,
      zMin: -cityHalfLength - 4,
      zMax: cityHalfLength + 4,
      centerX: district.x,
      centerZ: 0,
      width: ROAD_WIDTH,
      depth: cityHalfLength * 2 + 8
    });
  }

  function addHorizontalRoad({ key, label, short, z, color }) {
    roadRects.push({
      type: "horizontal",
      key,
      label,
      short,
      color,
      xMin: minX,
      xMax: maxX,
      zMin: z - ROAD_WIDTH / 2,
      zMax: z + ROAD_WIDTH / 2,
      centerX: (minX + maxX) / 2,
      centerZ: z,
      width: maxX - minX,
      depth: ROAD_WIDTH
    });
  }

  addHorizontalRoad({
    key: "connector-center",
    label: "Central Connector Road",
    short: "CTR",
    z: 0,
    color: "#334155"
  });

  addHorizontalRoad({
    key: "connector-south",
    label: "South Connector Road",
    short: "SOUTH",
    z: -cityHalfLength + 4,
    color: "#475569"
  });

  addHorizontalRoad({
    key: "connector-north",
    label: "North Connector Road",
    short: "NORTH",
    z: cityHalfLength - 4,
    color: "#475569"
  });

  return {
    buildings,
    buildingColliders,
    roadRects,
    cityHalfLength,
    cityWidth: maxX - minX + 20,
    minX,
    maxX
  };
}

function makeTransforms(
  positions,
  offset = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1]
) {
  return positions.map(([x, y, z]) => ({
    position: [x + offset[0], y + offset[1], z + offset[2]],
    rotation,
    scale
  }));
}

function InstancedBoxes({
  transforms,
  args,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1
}) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;

    transforms.forEach((transform, index) => {
      dummy.position.set(...transform.position);
      dummy.rotation.set(...(transform.rotation || [0, 0, 0]));
      dummy.scale.set(...(transform.scale || [1, 1, 1]));
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [transforms, dummy]);

  if (!transforms.length) return null;

  return (
    <instancedMesh ref={ref} args={[null, null, transforms.length]}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function InstancedCylinders({
  transforms,
  args,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1
}) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;

    transforms.forEach((transform, index) => {
      dummy.position.set(...transform.position);
      dummy.rotation.set(...(transform.rotation || [0, 0, 0]));
      dummy.scale.set(...(transform.scale || [1, 1, 1]));
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [transforms, dummy]);

  if (!transforms.length) return null;

  return (
    <instancedMesh ref={ref} args={[null, null, transforms.length]}>
      <cylinderGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function InstancedSpheres({
  transforms,
  args,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1
}) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;

    transforms.forEach((transform, index) => {
      dummy.position.set(...transform.position);
      dummy.rotation.set(...(transform.rotation || [0, 0, 0]));
      dummy.scale.set(...(transform.scale || [1, 1, 1]));
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [transforms, dummy]);

  if (!transforms.length) return null;

  return (
    <instancedMesh ref={ref} args={[null, null, transforms.length]}>
      <sphereGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function InstancedPlanes({
  transforms,
  args,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1
}) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;

    transforms.forEach((transform, index) => {
      dummy.position.set(...transform.position);
      dummy.rotation.set(...(transform.rotation || [0, 0, 0]));
      dummy.scale.set(...(transform.scale || [1, 1, 1]));
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [transforms, dummy]);

  if (!transforms.length) return null;

  return (
    <instancedMesh ref={ref} args={[null, null, transforms.length]}>
      <planeGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function SkyScene({ isNight }) {
  const starTransforms = useMemo(() => {
    return Array.from({ length: 32 }).map((_, i) => ({
      position: [
        -78 + (i % 8) * 20,
        24 + ((i * 7) % 11),
        -95 + Math.floor(i / 8) * 42
      ]
    }));
  }, []);

  return (
    <>
      <color attach="background" args={[isNight ? "#07111f" : "#bfe4ff"]} />
      <fog attach="fog" args={[isNight ? "#07111f" : "#dbeafe", 42, 185]} />

      {isNight ? (
        <>
          <ambientLight intensity={0.45} />
          <hemisphereLight args={["#7dd3fc", "#0f172a", 0.45]} />
          <directionalLight position={[18, 25, 10]} intensity={0.35} color="#cbd5e1" />

          <mesh position={[42, 28, -40]}>
            <sphereGeometry args={[3, 24, 24]} />
            <meshStandardMaterial color="#f8fafc" emissive="#cbd5e1" emissiveIntensity={0.35} />
          </mesh>

          <InstancedSpheres
            transforms={starTransforms}
            args={[0.11, 8, 8]}
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
          />
        </>
      ) : (
        <>
          <ambientLight intensity={0.82} />
          <hemisphereLight args={["#ffffff", "#94a3b8", 0.7]} />
          <directionalLight position={[25, 35, 18]} intensity={1.15} color="#fff7cc" />

          <mesh position={[45, 32, -42]}>
            <sphereGeometry args={[4, 24, 24]} />
            <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={0.25} />
          </mesh>
        </>
      )}
    </>
  );
}

function Road({ road, isNight }) {
  return (
    <group>
      <mesh position={[road.centerX, 0.008, road.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[road.width + 1.7, road.depth + 1.7]} />
        <meshStandardMaterial color={isNight ? "#4b5563" : "#9ca3af"} />
      </mesh>

      <mesh position={[road.centerX, 0.014, road.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[road.width, road.depth]} />
        <meshStandardMaterial color={isNight ? "#111827" : "#0f172a"} />
      </mesh>
    </group>
  );
}

function DistrictGrounds({ layout }) {
  return (
    <>
      {DISTRICTS.map((district) => (
        <mesh
          key={district.key}
          position={[district.x, -0.026, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[11.8, layout.cityHalfLength * 2 + 22]} />
          <meshStandardMaterial color={district.ground} transparent opacity={0.5} />
        </mesh>
      ))}
    </>
  );
}

function Sidewalks({ layout, isNight }) {
  const { verticalSidewalks, horizontalSidewalks } = useMemo(() => {
    const vertical = [];
    const horizontal = [];

    layout.roadRects.forEach((road) => {
      if (road.type === "vertical") {
        vertical.push({
          position: [road.centerX - ROAD_WIDTH / 2 - 0.58, 0.022, road.centerZ],
          rotation: [-Math.PI / 2, 0, 0]
        });

        vertical.push({
          position: [road.centerX + ROAD_WIDTH / 2 + 0.58, 0.022, road.centerZ],
          rotation: [-Math.PI / 2, 0, 0]
        });
      }

      if (road.type === "horizontal") {
        horizontal.push({
          position: [road.centerX, 0.023, road.centerZ - ROAD_WIDTH / 2 - 0.58],
          rotation: [-Math.PI / 2, 0, 0]
        });

        horizontal.push({
          position: [road.centerX, 0.023, road.centerZ + ROAD_WIDTH / 2 + 0.58],
          rotation: [-Math.PI / 2, 0, 0]
        });
      }
    });

    return { verticalSidewalks: vertical, horizontalSidewalks: horizontal };
  }, [layout]);

  const sidewalkColor = isNight ? "#6f5338" : "#b98c62";

  return (
    <>
      <InstancedPlanes
        transforms={verticalSidewalks}
        args={[0.62, layout.cityHalfLength * 2 + 8]}
        color={sidewalkColor}
      />

      <InstancedPlanes
        transforms={horizontalSidewalks}
        args={[layout.maxX - layout.minX, 0.62]}
        color={sidewalkColor}
      />
    </>
  );
}

function RoadCurbs({ layout }) {
  const { verticalCurbs, horizontalCurbs } = useMemo(() => {
    const vertical = [];
    const horizontal = [];

    layout.roadRects.forEach((road) => {
      if (road.type === "vertical") {
        vertical.push({
          position: [road.centerX - ROAD_WIDTH / 2 - 0.06, 0.07, road.centerZ],
          rotation: [0, 0, 0]
        });

        vertical.push({
          position: [road.centerX + ROAD_WIDTH / 2 + 0.06, 0.07, road.centerZ],
          rotation: [0, 0, 0]
        });
      }

      if (road.type === "horizontal") {
        horizontal.push({
          position: [road.centerX, 0.072, road.centerZ - ROAD_WIDTH / 2 - 0.06],
          rotation: [0, Math.PI / 2, 0]
        });

        horizontal.push({
          position: [road.centerX, 0.072, road.centerZ + ROAD_WIDTH / 2 + 0.06],
          rotation: [0, Math.PI / 2, 0]
        });
      }
    });

    return { verticalCurbs: vertical, horizontalCurbs: horizontal };
  }, [layout]);

  return (
    <>
      <InstancedBoxes
        transforms={verticalCurbs}
        args={[0.12, 0.14, layout.cityHalfLength * 2 + 8]}
        color="#cbd5e1"
      />

      <InstancedBoxes
        transforms={horizontalCurbs}
        args={[0.12, 0.14, layout.maxX - layout.minX]}
        color="#cbd5e1"
      />
    </>
  );
}

function RoadStripes({ layout, isNight }) {
  const { verticalStripes, horizontalStripes } = useMemo(() => {
    const vertical = [];
    const horizontal = [];

    layout.roadRects.forEach((road) => {
      if (road.type === "vertical") {
        const stripeCount = Math.floor(road.depth / 7);

        for (let i = 0; i < stripeCount; i++) {
          vertical.push({
            position: [road.centerX, 0.03, road.zMin + 3.5 + i * 7],
            rotation: [-Math.PI / 2, 0, 0]
          });
        }
      }

      if (road.type === "horizontal") {
        const stripeCount = Math.floor(road.width / 7);

        for (let i = 0; i < stripeCount; i++) {
          horizontal.push({
            position: [road.xMin + 3.5 + i * 7, 0.03, road.centerZ],
            rotation: [-Math.PI / 2, 0, 0]
          });
        }
      }
    });

    return { verticalStripes: vertical, horizontalStripes: horizontal };
  }, [layout]);

  return (
    <>
      <InstancedPlanes
        transforms={verticalStripes}
        args={[0.18, 2.0]}
        color="#facc15"
        emissive={isNight ? "#facc15" : "#000000"}
        emissiveIntensity={isNight ? 0.35 : 0}
      />

      <InstancedPlanes
        transforms={horizontalStripes}
        args={[2.0, 0.18]}
        color="#facc15"
        emissive={isNight ? "#facc15" : "#000000"}
        emissiveIntensity={isNight ? 0.35 : 0}
      />
    </>
  );
}

function LotPads({ buildings }) {
  const outerTransforms = useMemo(
    () =>
      buildings.map(({ position }) => ({
        position: [position[0], 0.002, position[2]],
        rotation: [-Math.PI / 2, 0, 0]
      })),
    [buildings]
  );

  const innerTransforms = useMemo(
    () =>
      buildings.map(({ position }) => ({
        position: [position[0], 0.006, position[2]],
        rotation: [-Math.PI / 2, 0, 0]
      })),
    [buildings]
  );

  return (
    <>
      <InstancedPlanes transforms={outerTransforms} args={[3.15, 3.15]} color="#9b8b7b" />
      <InstancedPlanes transforms={innerTransforms} args={[2.9, 2.9]} color="#d8c3a5" />
    </>
  );
}

function InstancedTrees({ positions }) {
  const trunkTransforms = useMemo(() => makeTransforms(positions, [0, 1.1, 0]), [positions]);
  const canopyTransforms = useMemo(() => makeTransforms(positions, [0, 2.45, 0]), [positions]);
  const canopyTransforms2 = useMemo(
    () => makeTransforms(positions, [0.35, 2.2, 0.15], [0, 0, 0], [0.8, 0.8, 0.8]),
    [positions]
  );
  const canopyTransforms3 = useMemo(
    () => makeTransforms(positions, [-0.32, 2.18, -0.12], [0, 0, 0], [0.72, 0.72, 0.72]),
    [positions]
  );

  return (
    <>
      <InstancedCylinders transforms={trunkTransforms} args={[0.18, 0.25, 2.2, 8]} color="#7c4a21" />
      <InstancedSpheres transforms={canopyTransforms} args={[0.82, 14, 14]} color="#166534" />
      <InstancedSpheres transforms={canopyTransforms2} args={[0.62, 14, 14]} color="#15803d" />
      <InstancedSpheres transforms={canopyTransforms3} args={[0.58, 14, 14]} color="#22c55e" />
    </>
  );
}

function InstancedBushes({ positions }) {
  const mainTransforms = useMemo(() => makeTransforms(positions, [0, 0.28, 0]), [positions]);
  const sideTransforms = useMemo(
    () => makeTransforms(positions, [0.28, 0.26, 0.08]),
    [positions]
  );

  return (
    <>
      <InstancedSpheres transforms={mainTransforms} args={[0.35, 10, 10]} color="#15803d" />
      <InstancedSpheres transforms={sideTransforms} args={[0.28, 10, 10]} color="#22c55e" />
    </>
  );
}

function GrassPatches({ positions }) {
  const grassTransforms = useMemo(() => {
    return positions.map(([x, y, z], index) => ({
      position: [x, y + 0.018, z],
      rotation: [-Math.PI / 2, 0, (index % 4) * 0.4],
      scale: [1 + (index % 3) * 0.18, 1 + (index % 2) * 0.12, 1]
    }));
  }, [positions]);

  return (
    <InstancedPlanes
      transforms={grassTransforms}
      args={[1.3, 0.42]}
      color="#22c55e"
      transparent
      opacity={0.8}
    />
  );
}

function StudentFigures({ students }) {
  const headRef = useRef();
  const bodyRef = useRef();
  const legRef = useRef();
  const bagRef = useRef();

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const shirtPalette = useMemo(
    () => ["#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#ea580c", "#0891b2", "#db2777"],
    []
  );

  const bagStudents = useMemo(
    () => students.filter((_, index) => index % 3 === 0),
    [students]
  );

  useLayoutEffect(() => {
    if (!bodyRef.current) return;

    students.forEach((_, index) => {
      bodyRef.current.setColorAt(
        index,
        color.set(shirtPalette[index % shirtPalette.length])
      );
    });

    if (bodyRef.current.instanceColor) {
      bodyRef.current.instanceColor.needsUpdate = true;
    }
  }, [students, color, shirtPalette]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    students.forEach((student, index) => {
      const walkOffset =
        Math.sin(time * student.speed + student.phase) *
        student.walkDistance *
        student.direction;

      const z = student.baseZ + walkOffset;
      const bob = Math.abs(Math.sin(time * student.speed * 2 + student.phase)) * 0.035;
      const legSwing = Math.sin(time * student.speed * 3 + student.phase) * 0.32;

      dummy.position.set(student.x, 1.28 + bob, z);
      dummy.rotation.set(0, student.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      headRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(student.x, 0.82 + bob, z);
      dummy.rotation.set(0, student.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.set(student.x - 0.08, 0.38, z);
      dummy.rotation.set(legSwing, student.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      legRef.current?.setMatrixAt(index * 2, dummy.matrix);

      dummy.position.set(student.x + 0.08, 0.38, z);
      dummy.rotation.set(-legSwing, student.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      legRef.current?.setMatrixAt(index * 2 + 1, dummy.matrix);
    });

    bagStudents.forEach((student, index) => {
      const walkOffset =
        Math.sin(time * student.speed + student.phase) *
        student.walkDistance *
        student.direction;

      const z = student.baseZ + walkOffset;
      const bob = Math.abs(Math.sin(time * student.speed * 2 + student.phase)) * 0.035;

      dummy.position.set(student.x - 0.16, 0.84 + bob, z);
      dummy.rotation.set(0, student.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bagRef.current?.setMatrixAt(index, dummy.matrix);
    });

    if (headRef.current) headRef.current.instanceMatrix.needsUpdate = true;
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true;
    if (legRef.current) legRef.current.instanceMatrix.needsUpdate = true;
    if (bagRef.current) bagRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!students.length) return null;

  return (
    <>
      <instancedMesh ref={headRef} args={[null, null, students.length]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial color="#f2c49b" />
      </instancedMesh>

      <instancedMesh ref={bodyRef} args={[null, null, students.length]}>
        <boxGeometry args={[0.24, 0.52, 0.16]} />
        <meshStandardMaterial color="#ffffff" vertexColors />
      </instancedMesh>

      <instancedMesh ref={legRef} args={[null, null, students.length * 2]}>
        <boxGeometry args={[0.07, 0.45, 0.07]} />
        <meshStandardMaterial color="#111827" />
      </instancedMesh>

      {bagStudents.length > 0 && (
        <instancedMesh ref={bagRef} args={[null, null, bagStudents.length]}>
          <boxGeometry args={[0.09, 0.28, 0.2]} />
          <meshStandardMaterial color="#0f172a" />
        </instancedMesh>
      )}
    </>
  );
}

function InstancedStreetLamps({ positions, isNight }) {
  const poleTransforms = useMemo(() => makeTransforms(positions, [0, 1.8, 0]), [positions]);
  const armTransforms = useMemo(() => makeTransforms(positions, [0.3, 3.45, 0]), [positions]);
  const bulbTransforms = useMemo(() => makeTransforms(positions, [0.62, 3.25, 0]), [positions]);

  return (
    <>
      <InstancedCylinders transforms={poleTransforms} args={[0.07, 0.09, 3.6, 8]} color="#475569" />
      <InstancedBoxes transforms={armTransforms} args={[0.7, 0.08, 0.08]} color="#475569" />
      <InstancedSpheres
        transforms={bulbTransforms}
        args={[0.14, 10, 10]}
        color={isNight ? "#fde68a" : "#e5e7eb"}
        emissive={isNight ? "#fde68a" : "#000000"}
        emissiveIntensity={isNight ? 1.5 : 0}
      />
    </>
  );
}

function Benches({ positions }) {
  const seatTransforms = useMemo(
    () =>
      positions.map(([x, y, z], index) => ({
        position: [x, y + 0.42, z],
        rotation: [0, index % 2 === 0 ? 0 : Math.PI / 2, 0]
      })),
    [positions]
  );

  const backTransforms = useMemo(
    () =>
      positions.map(([x, y, z], index) => ({
        position: [
          x + (index % 2 === 0 ? 0 : -0.22),
          y + 0.68,
          z + (index % 2 === 0 ? -0.22 : 0)
        ],
        rotation: [0, index % 2 === 0 ? 0 : Math.PI / 2, 0]
      })),
    [positions]
  );

  return (
    <>
      <InstancedBoxes transforms={seatTransforms} args={[1.2, 0.12, 0.32]} color="#7c2d12" />
      <InstancedBoxes transforms={backTransforms} args={[1.2, 0.32, 0.1]} color="#92400e" />
    </>
  );
}

function SearchGlowMarker({ position, isVisible, isSelected }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current || !isVisible) return;

    const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.16;
    groupRef.current.scale.set(pulse, 1, pulse);
  });

  if (!isVisible) return null;

  const glowColor = isSelected ? "#ef4444" : "#22c55e";
  const beamColor = isSelected ? "#f87171" : "#86efac";

  return (
    <group ref={groupRef} position={[position[0], 0.045, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.85, 2.35, 48]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[2.55, 2.95, 48]} />
        <meshBasicMaterial
          color="#facc15"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 4.4, 32, 1, true]} />
        <meshBasicMaterial
          color={beamColor}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 4.55, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color={glowColor} />
      </mesh>

      <Text
        position={[0, 4.95, 0]}
        fontSize={0.42}
        color={glowColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor="white"
      >
        MATCH
      </Text>
    </group>
  );
}

function RoadBillboard({ road, index, isNight }) {
  const side = index % 2 === 0 ? -1 : 1;
  const signX = road.centerX + side * 3.25;
  const signZ = -3.2;

  return (
    <group position={[signX, 0, signZ]}>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.5, 8]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      <mesh position={[0, 2.55, 0]}>
        <boxGeometry args={[3.45, 1.22, 0.14]} />
        <meshStandardMaterial
          color={road.color}
          emissive={isNight ? road.color : "#000000"}
          emissiveIntensity={isNight ? 0.35 : 0}
        />
      </mesh>

      <Text
        position={[0, 2.86, 0.09]}
        fontSize={0.24}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.1}
      >
        {road.short}
      </Text>

      <Text
        position={[0, 2.56, 0.09]}
        fontSize={0.14}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.1}
      >
        {road.label}
      </Text>

      <Text
        position={[0, 2.25, 0.09]}
        fontSize={0.12}
        color="#fde68a"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.1}
      >
        This road leads to {road.key}
      </Text>
    </group>
  );
}

function CentralDirectoryBoard({ isNight }) {
  return (
    <group position={[8, 0, -6.2]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.8, 8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>

      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[7.8, 3.2, 0.18]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive={isNight ? "#1e293b" : "#000000"}
          emissiveIntensity={isNight ? 0.35 : 0}
        />
      </mesh>

      <Text
        position={[0, 3.9, 0.11]}
        fontSize={0.26}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={7.2}
      >
        BracU Faculty City Directory
      </Text>

      {DISTRICTS.map((district, index) => (
        <Text
          key={district.key}
          position={[-3.4 + (index % 2) * 3.8, 3.45 - Math.floor(index / 2) * 0.5, 0.11]}
          fontSize={0.14}
          color={district.color}
          anchorX="left"
          anchorY="middle"
          maxWidth={3.4}
        >
          {district.short} → {district.key}
        </Text>
      ))}

      <Text
        position={[0, 1.78, 0.11]}
        fontSize={0.13}
        color="#fde68a"
        anchorX="center"
        anchorY="middle"
        maxWidth={7.1}
      >
        Read this board before entering a lane.
      </Text>
    </group>
  );
}

function createDecorations(layout, performanceMode) {
  const trees = [];
  const bushes = [];
  const lamps = [];
  const grass = [];
  const benches = [];
  const students = [];

  const zStart = -layout.cityHalfLength - 2;
  const zEnd = layout.cityHalfLength + 2;

  const treeStep = performanceMode ? 26 : 16;
  const studentStep = performanceMode ? 88 : 56;

  function isOnRoad(x, z, buffer = 0.2) {
    return layout.roadRects.some(
      (road) =>
        x >= road.xMin - buffer &&
        x <= road.xMax + buffer &&
        z >= road.zMin - buffer &&
        z <= road.zMax + buffer
    );
  }

  function isInsideBuildingLot(x, z, buffer = 0.8) {
    return layout.buildingColliders.some(
      (box) =>
        x >= box.xMin - buffer &&
        x <= box.xMax + buffer &&
        z >= box.zMin - buffer &&
        z <= box.zMax + buffer
    );
  }

  function canPlaceScenery(x, z) {
    return !isOnRoad(x, z, 0.35) && !isInsideBuildingLot(x, z, 0.9);
  }

  function canPlaceStudent(x, z, walkDistance) {
    const testPoints = [z - walkDistance, z, z + walkDistance];

    return testPoints.every(
      (testZ) =>
        !isOnRoad(x, testZ, 0.05) &&
        !isInsideBuildingLot(x, testZ, 0.55)
    );
  }

  function addScenery(list, x, z) {
    if (canPlaceScenery(x, z)) {
      list.push([x, 0, z]);
    }
  }

  function addStudent({ x, z, rotation, direction, phase, speed, walkDistance }) {
    if (!canPlaceStudent(x, z, walkDistance)) return;

    students.push({
      x,
      baseZ: z,
      rotation,
      direction,
      phase,
      speed,
      walkDistance
    });
  }

  for (let z = zStart; z <= zEnd; z += treeStep) {
    addScenery(trees, -49, z);
    addScenery(trees, 61, z);
    addScenery(bushes, -45.5, z + 3);
    addScenery(bushes, 57.5, z - 3);
    addScenery(grass, -46.8, z + 1.5);
    addScenery(grass, 58.8, z - 1.5);
  }

  layout.roadRects
    .filter((road) => road.type === "vertical")
    .forEach((road, roadIndex) => {
      for (let z = road.zMin + 12; z <= road.zMax - 12; z += treeStep) {
        const leftTreeX = road.centerX - 6.7;
        const rightTreeX = road.centerX + 6.7;

        addScenery(trees, leftTreeX, z);
        addScenery(trees, rightTreeX, z);
        addScenery(bushes, leftTreeX + 0.9, z + 2.1);
        addScenery(bushes, rightTreeX - 0.9, z - 2.1);
        addScenery(grass, leftTreeX + 1.7, z - 1.1);
        addScenery(grass, rightTreeX - 1.7, z + 1.1);
      }

      for (let z = road.zMin + 8; z <= road.zMax - 8; z += 28) {
        addScenery(lamps, road.centerX - 2.9, z);
        addScenery(lamps, road.centerX + 2.9, z);
      }

      if (!performanceMode) {
        for (let z = road.zMin + 18; z <= road.zMax - 18; z += 34) {
          addScenery(benches, road.centerX - 3.25, z);
          addScenery(benches, road.centerX + 3.25, z + 8);
        }
      }

      for (let z = road.zMin + 18; z <= road.zMax - 18; z += studentStep) {
        const walkDistance = performanceMode ? 1.15 : 1.55;

        addStudent({
          x: road.centerX - 2.58,
          z: z + (roadIndex % 2) * 4,
          rotation: 0,
          direction: 1,
          phase: roadIndex * 0.7 + z * 0.03,
          speed: 0.8 + (roadIndex % 3) * 0.12,
          walkDistance
        });

        if (!performanceMode || roadIndex % 2 === 0) {
          addStudent({
            x: road.centerX + 2.58,
            z: z + 11,
            rotation: Math.PI,
            direction: -1,
            phase: roadIndex * 0.9 + z * 0.04,
            speed: 0.75 + (roadIndex % 4) * 0.1,
            walkDistance
          });
        }
      }
    });

  return {
    trees,
    bushes,
    lamps,
    grass,
    benches,
    students
  };
}

function WelcomePopup({ playerName, setPlayerName, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,23,42,0.58)",
        fontFamily: "Arial"
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: "92vw",
          background: "rgba(255,255,255,0.98)",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 18px 55px rgba(0,0,0,0.32)"
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Welcome to BracU Faculty City</h1>

        <p style={{ margin: "12px 0 4px", fontWeight: 800 }}>
          Made by Adittya Kumar Chowdhury
        </p>

        <p style={{ margin: "0 0 12px", color: "#475569", fontWeight: 700 }}>
          ID: 22301518
        </p>

        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.48 }}>
          BracU Faculty City is an interactive 3D faculty exploration system.
          It visualizes BRAC University CSE faculty profiles as a city. Each road
          represents a designation group, each building represents a faculty member,
          and building details encode profile data such as designation, publications,
          thesis availability, research interests, courses, and contact information.
        </p>

        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.48 }}>
          The idea was inspired by Git City by srizzon. This project adapts that
          city-exploration concept for academic faculty discovery.
        </p>

        <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.48 }}>
          Built with React, JavaScript, Three.js, @react-three/fiber, Drei, HTML,
          CSS, Node.js, Express, Cheerio, and JSON-based scraped faculty data.
          The architecture uses a component-based frontend, a separate faculty
          scraper, an edit API, and a structured local data file powering the 3D city.
        </p>

        <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.48 }}>
          Follow me on GitHub and leave a star on the repository if you like the project:{" "}
          <a
            href="https://github.com/TheAdittyaKumar"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb", fontWeight: 800 }}
          >
            github.com/TheAdittyaKumar
          </a>
        </p>

        <label style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
          Name above your car
        </label>

        <input
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            marginBottom: 14
          }}
        />

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "none",
            borderRadius: 10,
            background: "#111827",
            color: "white",
            fontWeight: 800,
            cursor: "pointer"
          }}
        >
          Enter BracU Faculty City
        </button>
      </div>
    </div>
  );
}

function SpeedHud() {
  const [telemetry, setTelemetry] = useState({
    speedKmh: 0,
    nitroActive: false
  });

  useEffect(() => {
    function handleTelemetry(event) {
      setTelemetry({
        speedKmh: event.detail.speedKmh || 0,
        nitroActive: event.detail.nitroActive || false
      });
    }

    window.addEventListener("facultycity-telemetry", handleTelemetry);

    return () => {
      window.removeEventListener("facultycity-telemetry", handleTelemetry);
    };
  }, []);

  const cgpa = Math.min(4, (telemetry.speedKmh / 90) * 4);
  const cgpaText = cgpa.toFixed(2);
  const cgpaPercent = (cgpa / 4) * 100;

  let academicStatus = "Idle Semester";
  if (cgpa >= 3.75) academicStatus = "Dean's List Velocity";
  else if (cgpa >= 3.3) academicStatus = "High Distinction Drive";
  else if (cgpa >= 2.7) academicStatus = "Cruising GPA";
  else if (cgpa >= 1.5) academicStatus = "Academic Warm-up";

  return (
    <div
      style={{
        position: "absolute",
        right: 24,
        bottom: 24,
        zIndex: 18,
        width: 240,
        background: "rgba(15,23,42,0.88)",
        color: "white",
        padding: 14,
        borderRadius: 14,
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        fontFamily: "Arial"
      }}
    >
      <div style={{ fontSize: 13, color: "#cbd5e1" }}>Academic Speed</div>

      <div style={{ fontSize: 34, fontWeight: "bold", lineHeight: 1 }}>
        {cgpaText}
        <span style={{ fontSize: 14, marginLeft: 6 }}>/ 4.00 CGPA</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#cbd5e1" }}>
        {academicStatus}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "#cbd5e1" }}>
        Nitro {telemetry.nitroActive ? "ACTIVE" : "READY"}
      </div>

      <div
        style={{
          marginTop: 6,
          height: 10,
          borderRadius: 999,
          background: "#334155",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${cgpaPercent}%`,
            height: "100%",
            background: telemetry.nitroActive ? "#38bdf8" : "#22c55e"
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#cbd5e1" }}>
        4.00 CGPA = speed limit
      </div>
    </div>
  );
}

function MiniMapHud({
  layout,
  selectedFaculty,
  setSelectedFaculty,
  matchSet,
  hasActiveFilter,
  selectFaculty
}) {
  const [carPosition, setCarPosition] = useState({ x: 0, z: 0 });

  useEffect(() => {
    function handleTelemetry(event) {
      setCarPosition(event.detail.carPosition || { x: 0, z: 0 });
    }

    window.addEventListener("facultycity-telemetry", handleTelemetry);

    return () => {
      window.removeEventListener("facultycity-telemetry", handleTelemetry);
    };
  }, []);

  const width = 250;
  const height = 170;

  const minX = layout.minX - 8;
  const maxX = layout.maxX + 8;
  const minZ = -layout.cityHalfLength - 8;
  const maxZ = layout.cityHalfLength + 8;

  function mapX(x) {
    return ((x - minX) / (maxX - minX)) * width;
  }

  function mapY(z) {
    return ((z - minZ) / (maxZ - minZ)) * height;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        bottom: 24,
        zIndex: 18,
        width,
        height,
        background: "rgba(255,255,255,0.9)",
        borderRadius: 14,
        border: "2px solid #111827",
        overflow: "hidden",
        boxShadow: "0 12px 30px rgba(0,0,0,0.2)"
      }}
    >
      <svg width={width} height={height}>
        {layout.roadRects.map((road, index) => {
          const x = mapX(road.xMin);
          const y = mapY(road.zMin);
          const w = mapX(road.xMax) - mapX(road.xMin);
          const h = mapY(road.zMax) - mapY(road.zMin);

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={road.type === "vertical" ? road.color : "#111827"}
              opacity={road.type === "vertical" ? 0.8 : 1}
              rx="2"
            />
          );
        })}

        {layout.buildings.map(({ faculty, position, districtKey }) => {
          const [x, , z] = position;
          const isSelected = selectedFaculty?.id === faculty.id;
          const isMatched = matchSet.has(faculty.id);
          const isDimmed = hasActiveFilter && !isMatched;

          return (
            <circle
              key={faculty.id}
              cx={mapX(x)}
              cy={mapY(z)}
              r={isSelected ? 4.5 : isMatched && hasActiveFilter ? 3.8 : 2.8}
              fill={isSelected ? "#ef4444" : getDistrictColor(districtKey)}
              opacity={isDimmed ? 0.22 : 1}
              stroke="#111827"
              strokeWidth={isSelected ? 1.5 : 0.7}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setSelectedFaculty(faculty);
                selectFaculty(faculty);
              }}
            />
          );
        })}

        <polygon
          points={`
            ${mapX(carPosition.x)},${mapY(carPosition.z) - 6}
            ${mapX(carPosition.x) - 5},${mapY(carPosition.z) + 5}
            ${mapX(carPosition.x) + 5},${mapY(carPosition.z) + 5}
          `}
          fill="#2563eb"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function ResultButton({ result, onSelect, mode }) {
  const faculty = result.faculty;
  const thesis = result.thesis || getThesisFlags(faculty);

  return (
    <button
      onClick={() => onSelect(faculty)}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid #dbe3ee",
        background: "rgba(255,255,255,0.92)",
        borderRadius: 10,
        padding: "8px 9px",
        marginBottom: 7,
        cursor: "pointer"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b style={{ fontSize: 12 }}>{faculty.code || "?"} — {faculty.name}</b>

        {mode === "recommend" ? (
          <span style={{ fontSize: 11, fontWeight: 900, color: "#16a34a" }}>
            {result.matchPercent}%
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 900, color: "#2563eb" }}>
            {result.publicationCount} pubs
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
        {faculty.designation || faculty.role || "Data not given"}
      </div>

      <div style={{ fontSize: 11, color: "#334155", marginTop: 3 }}>
        Thesis:{" "}
        <b style={{ color: thesis.accepting ? "#16a34a" : "#dc2626" }}>
          {thesis.accepting ? "Accepting" : "Not confirmed"}
        </b>
        {thesis.acceptsUG ? " · UG" : ""}
        {thesis.acceptsPG ? " · PG" : ""}
      </div>

      {result.reasons?.length > 0 && (
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>
          {result.reasons.join(" · ")}
        </div>
      )}
    </button>
  );
}

export default function CityScene() {
  const [facultyList, setFacultyList] = useState(facultyData);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [isNight, setIsNight] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [playerName, setPlayerName] = useState("Adittya Kumar Chowdhury");

  const [searchTerm, setSearchTerm] = useState("");
  const [designationFilter, setDesignationFilter] = useState("All");
  const [thesisFilter, setThesisFilter] = useState("All");

  const [smartMode, setSmartMode] = useState("explore");
  const [recommendQuery, setRecommendQuery] = useState("");
  const [thesisFinder, setThesisFinder] = useState({
    topic: "",
    level: "Any",
    designation: "All",
    minPublications: 0,
    acceptingOnly: true
  });

  useEffect(() => {
    let cancelled = false;

    async function loadFacultyFromBackend() {
      try {
        const response = await fetch(`${EDIT_API_BASE}/api/faculty`);
        const result = await response.json();

        if (!cancelled && response.ok && result.ok && Array.isArray(result.faculty)) {
          setFacultyList(result.faculty);
        }
      } catch {
        // Backend may be off. Imported faculty.json will still be used.
      }
    }

    loadFacultyFromBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => buildCityLayout(facultyList), [facultyList]);

  const decorations = useMemo(
    () => createDecorations(layout, performanceMode),
    [layout, performanceMode]
  );

  const interestSuggestions = useMemo(() => {
    return buildInterestSuggestions(facultyList);
  }, [facultyList]);

  const normalMatchedFaculty = useMemo(() => {
    return facultyList.filter((faculty) =>
      isFacultyMatch(faculty, searchTerm, designationFilter, thesisFilter)
    );
  }, [facultyList, searchTerm, designationFilter, thesisFilter]);

  const recommendationResults = useMemo(() => {
    if (!recommendQuery.trim()) return [];

    return facultyList
      .map((faculty) => scoreFacultyRecommendation(faculty, recommendQuery))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [facultyList, recommendQuery]);

  const thesisFinderResults = useMemo(() => {
    return facultyList
      .map((faculty) => scoreFacultyForThesisFinder(faculty, thesisFinder))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }, [facultyList, thesisFinder]);

  const activeMatchedFaculty = useMemo(() => {
    if (smartMode === "recommend" && recommendQuery.trim()) {
      return recommendationResults.map((result) => result.faculty);
    }

    if (smartMode === "thesis") {
      return thesisFinderResults.map((result) => result.faculty);
    }

    return normalMatchedFaculty;
  }, [
    smartMode,
    recommendQuery,
    recommendationResults,
    thesisFinderResults,
    normalMatchedFaculty
  ]);

  const matchSet = useMemo(() => {
    return new Set(activeMatchedFaculty.map((faculty) => faculty.id));
  }, [activeMatchedFaculty]);

  const hasActiveFilter =
    (smartMode === "recommend" && recommendQuery.trim() !== "") ||
    smartMode === "thesis" ||
    searchTerm.trim() !== "" ||
    designationFilter !== "All" ||
    thesisFilter !== "All";

  const handleUpdateFaculty = useCallback((updatedFaculty) => {
    setFacultyList((previousList) =>
      previousList.map((faculty) =>
        faculty.id === updatedFaculty.id ? updatedFaculty : faculty
      )
    );

    setSelectedFaculty(updatedFaculty);
  }, []);

  const selectFaculty = useCallback(
    (faculty) => {
      const building = layout.buildings.find(
        (item) => item.faculty.id === faculty.id
      );

      setSelectedFaculty(faculty);

      if (building) {
        window.dispatchEvent(
          new CustomEvent("facultycity-focus-building", {
            detail: {
              facultyId: faculty.id,
              position: {
                x: building.position[0],
                y: building.position[1],
                z: building.position[2]
              }
            }
          })
        );
      }
    },
    [layout]
  );

  const startRoad = layout.roadRects.find((road) => road.type === "vertical");
  const carStartPosition = startRoad ? [startRoad.centerX, 0.25, 0] : [0, 0.25, 0];

  const activeCount = activeMatchedFaculty.length;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        fontFamily: "Arial"
      }}
    >
      {showWelcome && (
        <WelcomePopup
          playerName={playerName}
          setPlayerName={setPlayerName}
          onClose={() => setShowWelcome(false)}
        />
      )}

      {panelCollapsed ? (
        <button
          onClick={() => setPanelCollapsed(false)}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 21,
            padding: "10px 12px",
            border: "none",
            borderRadius: 10,
            background: "#111827",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 12px 30px rgba(0,0,0,0.2)"
          }}
        >
          Show Controls
        </button>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 20,
            background: "rgba(255,255,255,0.9)",
            padding: 16,
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
            width: 390,
            maxHeight: "90vh",
            overflowY: "auto"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <h2 style={{ margin: 0 }}>BracU Faculty City</h2>

            <button
              onClick={() => setPanelCollapsed(true)}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#e5e7eb",
                padding: "5px 8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Hide
            </button>
          </div>

          <p style={{ margin: "6px 0 10px", fontSize: 12 }}>
            Explore faculty roads, find thesis supervisors, and get research-based recommendations.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setIsNight((prev) => !prev)}
              style={{
                padding: "8px 10px",
                border: "none",
                borderRadius: 8,
                background: isNight ? "#111827" : "#fde68a",
                color: isNight ? "white" : "#111827",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {isNight ? "Night" : "Day"}
            </button>

            <button
              onClick={() => setPerformanceMode((prev) => !prev)}
              style={{
                padding: "8px 10px",
                border: "none",
                borderRadius: 8,
                background: performanceMode ? "#16a34a" : "#e5e7eb",
                color: performanceMode ? "white" : "#111827",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Performance {performanceMode ? "On" : "Off"}
            </button>

            <button
              onClick={() => setShowWelcome(true)}
              style={{
                padding: "8px 10px",
                border: "none",
                borderRadius: 8,
                background: "#e0f2fe",
                color: "#075985",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              Edit Player
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 12,
              padding: 5,
              borderRadius: 10,
              background: "#e5e7eb"
            }}
          >
            {[
              ["explore", "Explore"],
              ["recommend", "Recommend"],
              ["thesis", "Thesis Finder"]
            ].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSmartMode(mode)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 7px",
                  background: smartMode === mode ? "#111827" : "transparent",
                  color: smartMode === mode ? "white" : "#111827",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {smartMode === "explore" && (
            <>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search exact code, name, research, course..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  marginBottom: 8
                }}
              />

              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={designationFilter}
                  onChange={(event) => setDesignationFilter(event.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1"
                  }}
                >
                  <option value="All">All Designations</option>
                  {DISTRICTS.map((district) => (
                    <option key={district.key} value={district.key}>
                      {district.key}
                    </option>
                  ))}
                </select>

                <select
                  value={thesisFilter}
                  onChange={(event) => setThesisFilter(event.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1"
                  }}
                >
                  <option value="All">All Thesis</option>
                  <option value="Accepting">Accepting</option>
                  <option value="Not Accepting">Not Accepting</option>
                  <option value="Undergraduate">UG Accepting</option>
                  <option value="Postgraduate">PG Accepting</option>
                </select>
              </div>
            </>
          )}

          {smartMode === "recommend" && (
            <div>
              <h3 style={{ margin: "8px 0 6px", fontSize: 15 }}>
                Faculty Recommendation
              </h3>

              <input
                value={recommendQuery}
                onChange={(event) => setRecommendQuery(event.target.value)}
                placeholder="Enter research interest, e.g., HCI, AI, security..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  marginBottom: 8
                }}
              />

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {interestSuggestions.slice(0, 10).map((interest) => (
                  <button
                    key={interest}
                    onClick={() => setRecommendQuery(interest)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "5px 8px",
                      background: "#dbeafe",
                      color: "#1e3a8a",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <div style={{ maxHeight: 210, overflowY: "auto", paddingRight: 2 }}>
                {recommendQuery.trim() ? (
                  recommendationResults.length ? (
                    recommendationResults.slice(0, 8).map((result) => (
                      <ResultButton
                        key={result.faculty.id}
                        result={result}
                        onSelect={selectFaculty}
                        mode="recommend"
                      />
                    ))
                  ) : (
                    <p style={{ fontSize: 12, color: "#64748b" }}>
                      No strong faculty match found for this interest.
                    </p>
                  )
                ) : (
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Type a research topic or choose a chip.
                  </p>
                )}
              </div>
            </div>
          )}

          {smartMode === "thesis" && (
            <div>
              <h3 style={{ margin: "8px 0 6px", fontSize: 15 }}>
                Thesis Finder Mode
              </h3>

              <input
                value={thesisFinder.topic}
                onChange={(event) =>
                  setThesisFinder((prev) => ({
                    ...prev,
                    topic: event.target.value
                  }))
                }
                placeholder="Topic, e.g., AI, HCI, cybersecurity..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  marginBottom: 8
                }}
              />

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select
                  value={thesisFinder.level}
                  onChange={(event) =>
                    setThesisFinder((prev) => ({
                      ...prev,
                      level: event.target.value
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1"
                  }}
                >
                  <option value="Any">Any Level</option>
                  <option value="UG">UG</option>
                  <option value="PG">PG</option>
                </select>

                <select
                  value={thesisFinder.designation}
                  onChange={(event) =>
                    setThesisFinder((prev) => ({
                      ...prev,
                      designation: event.target.value
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1"
                  }}
                >
                  <option value="All">All Ranks</option>
                  {DISTRICTS.map((district) => (
                    <option key={district.key} value={district.key}>
                      {district.key}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <label style={{ flex: 1, fontSize: 12, fontWeight: 800 }}>
                  Min Publications
                  <input
                    type="number"
                    min="0"
                    value={thesisFinder.minPublications}
                    onChange={(event) =>
                      setThesisFinder((prev) => ({
                        ...prev,
                        minPublications: event.target.value
                      }))
                    }
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "7px 8px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1"
                    }}
                  />
                </label>

                <label
                  style={{
                    flex: 1,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    marginTop: 18
                  }}
                >
                  <input
                    type="checkbox"
                    checked={thesisFinder.acceptingOnly}
                    onChange={(event) =>
                      setThesisFinder((prev) => ({
                        ...prev,
                        acceptingOnly: event.target.checked
                      }))
                    }
                  />
                  Accepting only
                </label>
              </div>

              <div style={{ maxHeight: 230, overflowY: "auto", paddingRight: 2 }}>
                {thesisFinderResults.length ? (
                  thesisFinderResults.slice(0, 10).map((result) => (
                    <ResultButton
                      key={result.faculty.id}
                      result={result}
                      onSelect={selectFaculty}
                      mode="thesis"
                    />
                  ))
                ) : (
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    No thesis supervisor found for these filters.
                  </p>
                )}
              </div>
            </div>
          )}

          <p style={{ margin: "10px 0 0", fontSize: 12 }}>
            Highlighting {activeCount} faculty out of {facultyList.length}
          </p>
        </div>
      )}

      <MiniMapHud
        layout={layout}
        selectedFaculty={selectedFaculty}
        setSelectedFaculty={setSelectedFaculty}
        matchSet={matchSet}
        hasActiveFilter={hasActiveFilter}
        selectFaculty={selectFaculty}
      />

      <SpeedHud />

      <Canvas
        dpr={performanceMode ? [0.75, 1] : [1, 1.5]}
        gl={{
          antialias: !performanceMode,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true
        }}
        camera={{
          position: [carStartPosition[0], 7, carStartPosition[2] + 12],
          fov: 58
        }}
      >
        <SkyScene isNight={isNight} />

        <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[layout.cityWidth + 30, layout.cityHalfLength * 2 + 30]} />
          <meshStandardMaterial color={isNight ? "#5b6b55" : "#9fc78c"} />
        </mesh>

        <DistrictGrounds layout={layout} />

        {layout.roadRects.map((road, index) => (
          <Road key={index} road={road} isNight={isNight} />
        ))}

        <Sidewalks layout={layout} isNight={isNight} />
        <RoadCurbs layout={layout} />
        <RoadStripes layout={layout} isNight={isNight} />

        <GrassPatches positions={decorations.grass} />
        <InstancedTrees positions={decorations.trees} />
        <InstancedBushes positions={decorations.bushes} />
        <StudentFigures students={decorations.students} />

        <CentralDirectoryBoard isNight={isNight} />

        {layout.roadRects
          .filter((road) => road.type === "vertical")
          .map((road, index) => (
            <RoadBillboard
              key={road.key}
              road={road}
              index={index}
              isNight={isNight}
            />
          ))}

        {!performanceMode && (
          <>
            <InstancedStreetLamps positions={decorations.lamps} isNight={isNight} />
            <Benches positions={decorations.benches} />
          </>
        )}

        <LotPads buildings={layout.buildings} />

        {layout.buildings.map(({ faculty, position }) => {
          const isMatched = matchSet.has(faculty.id);
          const isDimmed = hasActiveFilter && !isMatched;
          const isHighlighted = hasActiveFilter && isMatched;
          const isSelected = selectedFaculty?.id === faculty.id;

          return (
            <group key={faculty.id}>
              <SearchGlowMarker
                position={position}
                isVisible={isHighlighted || isSelected}
                isSelected={isSelected}
              />

              <FacultyBuilding
                faculty={faculty}
                position={position}
                onSelect={selectFaculty}
                isDimmed={isDimmed}
                isHighlighted={isHighlighted}
                isSelected={isSelected}
                performanceMode={performanceMode}
              />
            </group>
          );
        })}

        <CarController
          roadRects={layout.roadRects}
          buildingColliders={layout.buildingColliders}
          startPosition={carStartPosition}
          isNight={isNight}
          playerName={playerName}
        />
      </Canvas>

      {selectedFaculty && (
        <FacultyCard
          faculty={selectedFaculty}
          onClose={() => setSelectedFaculty(null)}
          onUpdateFaculty={handleUpdateFaculty}
        />
      )}
    </div>
  );
}