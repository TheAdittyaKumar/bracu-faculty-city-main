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
  if (Number.isFinite(faculty?._publicationCount)) {
    return faculty._publicationCount;
  }

  const publications = toArray(faculty?.publications);

  if (publications.length > 0) return publications.length;

  const count = Number(faculty?.publicationCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getDistrictKey(faculty) {
  if (faculty?._districtKey) return faculty._districtKey;

  const designation = String(faculty?.designation || faculty?.role || "").toLowerCase();

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

function getFacultyId(faculty, index = 0) {
  return String(
    faculty?.id ??
      faculty?.code ??
      faculty?.email ??
      faculty?.profileUrl ??
      faculty?.name ??
      `faculty-${index}`
  );
}

function getThesisFlags(faculty) {
  if (faculty?._thesisFlags) return faculty._thesisFlags;

  const status = String(faculty?.thesisStatus || "").toLowerCase();
  const level = String(faculty?.supervisionLevel || "").toLowerCase();
  const type = String(faculty?.supervisionType || "").toLowerCase();

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
  if (faculty?._searchFields) return faculty._searchFields;

  return {
    name: normalizeText(faculty?.name),
    code: normalizeText(faculty?.code),
    designation: normalizeText(faculty?.designation || faculty?.role),
    biography: normalizeText(faculty?.biography),
    research: normalizeText(toArray(faculty?.researchInterests).join(" ")),
    publications: normalizeText(toArray(faculty?.publications).join(" ")),
    courses: normalizeText(toArray(faculty?.courses).join(" ")),
    thesis: normalizeText(toArray(faculty?.synopsis).join(" "))
  };
}

function prepareFacultyData(rawFacultyList) {
  return rawFacultyList.map((faculty, index) => {
    const safeFaculty = {
      ...faculty,
      id: faculty.id ?? faculty.code ?? faculty.email ?? faculty.profileUrl ?? index + 1
    };

    const searchFields = {
      name: normalizeText(safeFaculty.name),
      code: normalizeText(safeFaculty.code),
      designation: normalizeText(safeFaculty.designation || safeFaculty.role),
      biography: normalizeText(safeFaculty.biography),
      research: normalizeText(toArray(safeFaculty.researchInterests).join(" ")),
      publications: normalizeText(toArray(safeFaculty.publications).join(" ")),
      courses: normalizeText(toArray(safeFaculty.courses).join(" ")),
      thesis: normalizeText(toArray(safeFaculty.synopsis).join(" "))
    };

    const publicationCount = getPublicationCount(safeFaculty);
    const districtKey = getDistrictKey(safeFaculty);
    const thesisFlags = getThesisFlags(safeFaculty);

    return {
      ...safeFaculty,
      _searchFields: searchFields,
      _searchBlob: Object.values(searchFields).join(" "),
      _publicationCount: publicationCount,
      _districtKey: districtKey,
      _thesisFlags: thesisFlags
    };
  });
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

  return String(faculty._searchBlob || "").includes(query);
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

  const activeDistricts = DISTRICTS.filter(
  (district) => (grouped[district.key] || []).length > 0
);

const visibleDistricts = activeDistricts.length > 0 ? activeDistricts : DISTRICTS;

const maxGroupSize = Math.max(
  1,
  ...visibleDistricts.map((district) => grouped[district.key].length)
);

const maxRows = Math.ceil(maxGroupSize / 2);

  const cityHalfLength = Math.max(
    45,
    maxRows * LOT_SPACING * 0.55 + INTERSECTION_CLEARANCE + 14
  );

  const buildings = [];
  const buildingColliders = [];

  for (const district of visibleDistricts) {
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

  const minX = visibleDistricts[0].x - 10;
const maxX = visibleDistricts[visibleDistricts.length - 1].x + 10;
const roadRects = [];

  for (const district of visibleDistricts) {
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
  maxX,
  visibleDistricts
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
  const districts = layout.visibleDistricts || DISTRICTS;

  return (
    <>
      {districts.map((district) => (
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
        const stripeCount = Math.floor(road.depth / 11);

        for (let i = 0; i < stripeCount; i++) {
          vertical.push({
            position: [road.centerX, 0.03, road.zMin + 5.5 + i * 11],
            rotation: [-Math.PI / 2, 0, 0]
          });
        }
      }

      if (road.type === "horizontal") {
        const stripeCount = Math.floor(road.width / 11);

        for (let i = 0; i < stripeCount; i++) {
          horizontal.push({
            position: [road.xMin + 5.5 + i * 11, 0.03, road.centerZ],
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

function RoadBillboard({ road, index, isNight, performanceMode }) {
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

      {!performanceMode && (
  <>
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
  </>
)}
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
  const [carState, setCarState] = useState({
    x: 0,
    z: 0,
    angle: 0
  });

  useEffect(() => {
    function handleTelemetry(event) {
      const carPosition = event.detail.carPosition || { x: 0, z: 0 };

      setCarState({
        x: carPosition.x,
        z: carPosition.z,
        angle: event.detail.carAngle || 0
      });
    }

    window.addEventListener("facultycity-telemetry", handleTelemetry);

    return () => {
      window.removeEventListener("facultycity-telemetry", handleTelemetry);
    };
  }, []);

  const size = 220;
  const center = size / 2;

  // Smaller number = more zoomed in.
  // Increase to 45 if you want to see more surrounding roads.
  // Decrease to 28 if you want a more game-like close radar.
  const viewRadiusWorld = 36;

  const scale = (size * 0.46) / viewRadiusWorld;

  function mapX(x) {
    return center + (x - carState.x) * scale;
  }

  function mapY(z) {
    return center + (z - carState.z) * scale;
  }

  function isRoadNearMinimap(road) {
    return (
      road.xMax >= carState.x - viewRadiusWorld &&
      road.xMin <= carState.x + viewRadiusWorld &&
      road.zMax >= carState.z - viewRadiusWorld &&
      road.zMin <= carState.z + viewRadiusWorld
    );
  }

  function isBuildingNearMinimap(position) {
    const [x, , z] = position;
    const dx = x - carState.x;
    const dz = z - carState.z;

    return dx * dx + dz * dz <= viewRadiusWorld * viewRadiusWorld;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        bottom: 24,
        zIndex: 18,
        width: size,
        height: size,
        background: "rgba(255,255,255,0.92)",
        borderRadius: "50%",
        border: "3px solid #111827",
        overflow: "hidden",
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)"
      }}
    >
      <svg width={size} height={size}>
        <defs>
          <clipPath id="local-minimap-circle-clip">
            <circle cx={center} cy={center} r={size / 2 - 4} />
          </clipPath>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={size / 2}
          fill="rgba(248,250,252,0.96)"
        />

        <g clipPath="url(#local-minimap-circle-clip)">
          <circle
            cx={center}
            cy={center}
            r={size / 2 - 4}
            fill="#ecfdf5"
          />

          {layout.roadRects
            .filter(isRoadNearMinimap)
            .map((road, index) => {
              const x = mapX(road.xMin);
              const y = mapY(road.zMin);
              const w = (road.xMax - road.xMin) * scale;
              const h = (road.zMax - road.zMin) * scale;

              return (
                <rect
                  key={`${road.key}-${index}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={road.type === "vertical" ? road.color : "#111827"}
                  opacity={road.type === "vertical" ? 0.85 : 1}
                  rx="3"
                />
              );
            })}

          {layout.buildings
            .filter(({ position }) => isBuildingNearMinimap(position))
            .map(({ faculty, position, districtKey }, index) => {
              const [x, , z] = position;
              const facultyId = getFacultyId(faculty, index);
              const selectedId = selectedFaculty ? getFacultyId(selectedFaculty) : "";

              const isSelected = selectedId === facultyId;
              const isMatched = matchSet.has(facultyId);
              const isDimmed = hasActiveFilter && !isMatched;

              return (
                <circle
                  key={facultyId}
                  cx={mapX(x)}
                  cy={mapY(z)}
                  r={isSelected ? 6 : isMatched && hasActiveFilter ? 5 : 3.8}
                  fill={isSelected ? "#ef4444" : getDistrictColor(districtKey)}
                  opacity={isDimmed ? 0.22 : 1}
                  stroke="#111827"
                  strokeWidth={isSelected ? 1.8 : 0.8}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedFaculty(faculty);
                    selectFaculty(faculty);
                  }}
                />
              );
            })}

          {/* car radar glow */}
          <circle
            cx={center}
            cy={center}
            r="18"
            fill="#dbeafe"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.9"
          />

          {/* car direction triangle */}
          <g>
  <polygon
    points={`
      ${center},${center - 18}
      ${center - 13},${center + 13}
      ${center + 13},${center + 13}
    `}
    fill="#2563eb"
    stroke="white"
    strokeWidth="3"
  />

  <circle
    cx={center}
    cy={center}
    r="3.5"
    fill="#ffffff"
  />
</g>

          {/* center guide lines */}
          <line
            x1={center - 28}
            y1={center}
            x2={center - 20}
            y2={center}
            stroke="#111827"
            strokeWidth="2"
            opacity="0.55"
          />

          <line
            x1={center + 20}
            y1={center}
            x2={center + 28}
            y2={center}
            stroke="#111827"
            strokeWidth="2"
            opacity="0.55"
          />

          <line
            x1={center}
            y1={center - 28}
            x2={center}
            y2={center - 20}
            stroke="#111827"
            strokeWidth="2"
            opacity="0.55"
          />

          <line
            x1={center}
            y1={center + 20}
            x2={center}
            y2={center + 28}
            stroke="#111827"
            strokeWidth="2"
            opacity="0.55"
          />
        </g>
      </svg>
    </div>
  );
}

function hasUsefulValue(value) {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasUsefulValue(item));
  }

  const text = String(value).trim().toLowerCase();

  return (
    text !== "" &&
    text !== "data not given" &&
    text !== "not given" &&
    text !== "n/a" &&
    text !== "na" &&
    text !== "null" &&
    text !== "undefined"
  );
}

function getDisplayText(value) {
  if (!hasUsefulValue(value)) return "Data not given";
  return String(value).trim();
}

function getFacultyResearchText(faculty) {
  return toArray(faculty.researchInterests).join(", ") || "Data not given";
}

function getFacultyCoursesText(faculty) {
  return toArray(faculty.courses).slice(0, 4).join(", ") || "Data not given";
}

function getProfileCompleteness(faculty) {
  const fields = [
    faculty.name,
    faculty.code,
    faculty.designation || faculty.role,
    faculty.email,
    faculty.biography,
    faculty.researchInterests,
    faculty.publications,
    faculty.courses,
    faculty.thesisStatus,
    faculty.supervisionLevel,
    faculty.supervisionType,
    faculty.websites,
    faculty.profileUrl,
    faculty.education
  ];

  const filled = fields.filter(hasUsefulValue).length;

  return Math.round((filled / fields.length) * 100);
}

function buildCityStats(facultyList) {
  const designationCounts = {};
  const researchCounts = new Map();

  let accepting = 0;
  let acceptingUG = 0;
  let acceptingPG = 0;
  let withPublications = 0;
  let missingBio = 0;
  let missingResearch = 0;
  let missingThesis = 0;
  let totalPublications = 0;
  let topPublicationFaculty = null;

  for (const faculty of facultyList) {
    const designation = getDistrictKey(faculty);
    designationCounts[designation] = (designationCounts[designation] || 0) + 1;

    const thesis = getThesisFlags(faculty);
    if (thesis.accepting) accepting += 1;
    if (thesis.acceptsUG) acceptingUG += 1;
    if (thesis.acceptsPG) acceptingPG += 1;

    const publicationCount = getPublicationCount(faculty);
    totalPublications += publicationCount;

    if (publicationCount > 0) withPublications += 1;

    if (
      !topPublicationFaculty ||
      publicationCount > topPublicationFaculty.publicationCount
    ) {
      topPublicationFaculty = {
        faculty,
        publicationCount
      };
    }

    if (!hasUsefulValue(faculty.biography)) missingBio += 1;
    if (!hasUsefulValue(faculty.researchInterests)) missingResearch += 1;
    if (!hasUsefulValue(faculty.thesisStatus)) missingThesis += 1;

    for (const interest of toArray(faculty.researchInterests)) {
      const cleaned = interest.trim();

      if (
        cleaned &&
        cleaned.length <= 40 &&
        !cleaned.toLowerCase().includes("data not given")
      ) {
        researchCounts.set(cleaned, (researchCounts.get(cleaned) || 0) + 1);
      }
    }
  }

  const topResearchAreas = Array.from(researchCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    totalFaculty: facultyList.length,
    designationCounts,
    accepting,
    acceptingUG,
    acceptingPG,
    withPublications,
    missingBio,
    missingResearch,
    missingThesis,
    totalPublications,
    topPublicationFaculty,
    topResearchAreas
  };
}

function getThesisMatchExplanation(result) {
  const faculty = result.faculty;
  const thesis = result.thesis || getThesisFlags(faculty);
  const explanations = [];

  if (thesis.accepting) {
    explanations.push("Accepting thesis supervision");
  }

  if (thesis.acceptsUG && thesis.acceptsPG) {
    explanations.push("Available for both UG and PG supervision");
  } else if (thesis.acceptsUG) {
    explanations.push("Available for undergraduate supervision");
  } else if (thesis.acceptsPG) {
    explanations.push("Available for postgraduate supervision");
  }

  if (result.publicationCount > 0) {
    explanations.push(`${result.publicationCount} publication(s) found`);
  }

  if (result.reasons?.length > 0) {
    explanations.push(...result.reasons.map((reason) => `Matched ${reason}`));
  }

  if (toArray(faculty.researchInterests).length > 0) {
    explanations.push("Has listed research interests");
  }

  return Array.from(new Set(explanations)).slice(0, 5);
}

function getThesisMatchPercent(result) {
  if (Number.isFinite(result.matchPercent)) {
    return result.matchPercent;
  }

  const thesis = result.thesis || getThesisFlags(result.faculty);
  let score = 20;

  if (thesis.accepting) score += 35;
  if (thesis.acceptsUG) score += 10;
  if (thesis.acceptsPG) score += 10;
  if (result.publicationCount > 0) score += Math.min(15, result.publicationCount * 2);
  if (result.reasons?.length > 0) score += Math.min(10, result.reasons.length * 3);

  return Math.min(100, score);
}

function CityStatsPanel({ stats, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 92,
        left: 430,
        zIndex: 24,
        width: 430,
        maxHeight: "78vh",
        overflowY: "auto",
        background: "rgba(255,255,255,0.97)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 16px 45px rgba(0,0,0,0.25)",
        fontFamily: "Arial"
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          border: "none",
          borderRadius: 999,
          width: 24,
          height: 24,
          background: "#ef4444",
          color: "white",
          fontWeight: 900,
          cursor: "pointer"
        }}
      >
        ×
      </button>

      <h2 style={{ margin: "0 0 12px" }}>Faculty Data Dashboard</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10
        }}
      >
        <DashboardTile label="Total Faculty" value={stats.totalFaculty} />
        <DashboardTile label="Accepting Thesis" value={stats.accepting} />
        <DashboardTile label="UG Accepting" value={stats.acceptingUG} />
        <DashboardTile label="PG Accepting" value={stats.acceptingPG} />
        <DashboardTile label="With Publications" value={stats.withPublications} />
        <DashboardTile label="Total Publications" value={stats.totalPublications} />
      </div>

      <h3 style={{ margin: "16px 0 8px", fontSize: 15 }}>Designation Breakdown</h3>

      {Object.entries(stats.designationCounts).map(([designation, count]) => (
        <div
          key={designation}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: "1px solid #e5e7eb",
            fontSize: 13
          }}
        >
          <span>{designation}</span>
          <b>{count}</b>
        </div>
      ))}

      <h3 style={{ margin: "16px 0 8px", fontSize: 15 }}>Top Research Areas</h3>

      {stats.topResearchAreas.length ? (
        stats.topResearchAreas.map((area) => (
          <div
            key={area.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid #e5e7eb",
              fontSize: 13
            }}
          >
            <span>{area.name}</span>
            <b>{area.count}</b>
          </div>
        ))
      ) : (
        <p style={{ color: "#64748b", fontSize: 13 }}>No research-area data found.</p>
      )}

      <h3 style={{ margin: "16px 0 8px", fontSize: 15 }}>Data Quality</h3>

      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        <div>Missing biography: <b>{stats.missingBio}</b></div>
        <div>Missing research interests: <b>{stats.missingResearch}</b></div>
        <div>Missing thesis status: <b>{stats.missingThesis}</b></div>
      </div>

      {stats.topPublicationFaculty && (
        <>
          <h3 style={{ margin: "16px 0 8px", fontSize: 15 }}>
            Highest Publication Count
          </h3>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 10,
              fontSize: 13
            }}
          >
            <b>{stats.topPublicationFaculty.faculty.name}</b>
            <div style={{ color: "#475569", marginTop: 4 }}>
              {stats.topPublicationFaculty.faculty.code || "No code"} ·{" "}
              {stats.topPublicationFaculty.publicationCount} publication(s)
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardTile({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 10
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ fontSize: 25, fontWeight: 900, color: "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function CompareFacultyPanel({
  compareList,
  onRemove,
  onClear,
  onViewFaculty
}) {
  if (!compareList.length) {
    return (
      <div
        style={{
          marginTop: 10,
          padding: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          fontSize: 13,
          color: "#475569"
        }}
      >
        No faculty selected. Search below and add faculty to compare.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>
          Comparing {compareList.length} faculty
        </b>

        <button
          onClick={onClear}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "5px 8px",
            background: "#fee2e2",
            color: "#991b1b",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 11
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
            background: "white"
          }}
        >
          <thead>
            <tr>
              <CompareHeader label="Field" />
              {compareList.map((faculty) => (
                <CompareHeader
                  key={faculty.id}
                  label={faculty.code || faculty.name || "Faculty"}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            <CompareRow
              label="Name"
              values={compareList.map((faculty) => getDisplayText(faculty.name))}
            />

            <CompareRow
              label="Designation"
              values={compareList.map((faculty) =>
                getDisplayText(faculty.designation || faculty.role)
              )}
            />

            <CompareRow
              label="Thesis"
              values={compareList.map((faculty) =>
                getDisplayText(faculty.thesisStatus)
              )}
            />

            <CompareRow
              label="Level"
              values={compareList.map((faculty) =>
                getDisplayText(faculty.supervisionLevel)
              )}
            />

            <CompareRow
              label="Publications"
              values={compareList.map((faculty) =>
                String(getPublicationCount(faculty))
              )}
            />

            <CompareRow
              label="Research"
              values={compareList.map((faculty) =>
                getFacultyResearchText(faculty)
              )}
            />

            <CompareRow
              label="Courses"
              values={compareList.map((faculty) =>
                getFacultyCoursesText(faculty)
              )}
            />

            <CompareRow
              label="Profile"
              values={compareList.map((faculty) =>
                `${getProfileCompleteness(faculty)}% complete`
              )}
            />

            <tr>
              <CompareCell label="Actions" strong />
              {compareList.map((faculty) => (
                <td
                  key={`${faculty.id}-actions`}
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: 7,
                    verticalAlign: "top"
                  }}
                >
                  <button
                    onClick={() => onViewFaculty(faculty)}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 7,
                      padding: "5px 6px",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 11,
                      marginBottom: 5
                    }}
                  >
                    View
                  </button>

                  <button
                    onClick={() => onRemove(faculty.id)}
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 7,
                      padding: "5px 6px",
                      background: "#fee2e2",
                      color: "#991b1b",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 11
                    }}
                  >
                    Remove
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareHeader({ label }) {
  return (
    <th
      style={{
        border: "1px solid #cbd5e1",
        background: "#f1f5f9",
        padding: 7,
        textAlign: "left",
        fontSize: 11
      }}
    >
      {label}
    </th>
  );
}

function CompareCell({ label, strong = false }) {
  return (
    <td
      style={{
        border: "1px solid #e5e7eb",
        padding: 7,
        verticalAlign: "top",
        fontWeight: strong ? 900 : 500,
        color: "#111827"
      }}
    >
      {label}
    </td>
  );
}

function CompareRow({ label, values }) {
  return (
    <tr>
      <CompareCell label={label} strong />
      {values.map((value, index) => (
        <CompareCell key={`${label}-${index}`} label={value} />
      ))}
    </tr>
  );
}

function ResultButton({ result, onSelect, onCompare, mode }) {
  const faculty = result.faculty;
  const thesis = result.thesis || getThesisFlags(faculty);
  const thesisMatchPercent = getThesisMatchPercent(result);
  const thesisExplanation = getThesisMatchExplanation(result);

  return (
    <div
      onClick={() => onSelect(faculty)}
      role="button"
      tabIndex={0}
      style={{
        width: "100%",
        textAlign: "left",
        border: "1px solid #dbe3ee",
        background: "rgba(255,255,255,0.92)",
        borderRadius: 10,
        padding: "8px 9px",
        marginBottom: 7,
        cursor: "pointer",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b style={{ fontSize: 12 }}>
          {faculty.code || "?"} — {faculty.name}
        </b>

        {mode === "recommend" ? (
          <span style={{ fontSize: 11, fontWeight: 900, color: "#16a34a" }}>
            {result.matchPercent}%
          </span>
        ) : mode === "thesis" ? (
          <span style={{ fontSize: 11, fontWeight: 900, color: "#7c3aed" }}>
            {thesisMatchPercent}% match
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

      {mode === "thesis" && thesisExplanation.length > 0 && (
        <div
          style={{
            marginTop: 6,
            padding: "6px 7px",
            borderRadius: 8,
            background: "#f8fafc",
            border: "1px solid #e5e7eb"
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 900, marginBottom: 4 }}>
            Why this match:
          </div>

          {thesisExplanation.map((item, index) => (
            <div
              key={`${faculty.id}-explanation-${index}`}
              style={{ fontSize: 10.5, color: "#475569", lineHeight: 1.35 }}
            >
              ✓ {item}
            </div>
          ))}
        </div>
      )}

      {mode !== "thesis" && result.reasons?.length > 0 && (
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>
          {result.reasons.join(" · ")}
        </div>
      )}

      {onCompare && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onCompare(faculty);
          }}
          style={{
            marginTop: 7,
            border: "none",
            borderRadius: 8,
            padding: "6px 8px",
            background: "#e0f2fe",
            color: "#075985",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 11
          }}
        >
          Add to Compare
        </button>
      )}
    </div>
  );
}

function useDebouncedValue(value, delay = 180) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}



export default function CityScene() {
  const [facultyList] = useState(() => prepareFacultyData(facultyData));
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
  const [showDashboard, setShowDashboard] = useState(false);
const [compareList, setCompareList] = useState([]);
const [compareSearch, setCompareSearch] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 180);
  const debouncedRecommendQuery = useDebouncedValue(recommendQuery, 180);
  const debouncedThesisTopic = useDebouncedValue(thesisFinder.topic, 180);

  const debouncedThesisFinder = useMemo(
  () => ({
    ...thesisFinder,
    topic: debouncedThesisTopic
  }),
  [thesisFinder, debouncedThesisTopic]
  );

  

  const layout = useMemo(() => buildCityLayout(facultyList), [facultyList]);

  const decorations = useMemo(
    () => createDecorations(layout, performanceMode),
    [layout, performanceMode]
  );

  const interestSuggestions = useMemo(() => {
    return buildInterestSuggestions(facultyList);
  }, [facultyList]);

const dashboardStats = useMemo(() => {
  return buildCityStats(facultyList);
}, [facultyList]);

const compareSearchResults = useMemo(() => {
  const query = compareSearch.trim().toLowerCase();

  if (!query) return [];

  return facultyList
    .filter((faculty) => {
      const searchable = [
        faculty.name,
        faculty.code,
        faculty.designation,
        faculty.email,
        toArray(faculty.researchInterests).join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    })
    .slice(0, 8);
}, [facultyList, compareSearch]);

  const normalMatchedFaculty = useMemo(() => {
  return facultyList.filter((faculty) =>
    isFacultyMatch(faculty, debouncedSearchTerm, designationFilter, thesisFilter)
  );
}, [facultyList, debouncedSearchTerm, designationFilter, thesisFilter]);

  const recommendationResults = useMemo(() => {
  if (!debouncedRecommendQuery.trim()) return [];

  return facultyList
    .map((faculty) => scoreFacultyRecommendation(faculty, debouncedRecommendQuery))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}, [facultyList, debouncedRecommendQuery]);

  const thesisFinderResults = useMemo(() => {
  return facultyList
    .map((faculty) => scoreFacultyForThesisFinder(faculty, debouncedThesisFinder))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}, [facultyList, debouncedThesisFinder]);

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

  function addToCompare(faculty) {
  setCompareList((previous) => {
    const alreadyExists = previous.some((item) => item.id === faculty.id);

    if (alreadyExists) return previous;

    return [...previous, faculty].slice(0, 3);
  });
}

function removeFromCompare(facultyId) {
  setCompareList((previous) =>
    previous.filter((faculty) => faculty.id !== facultyId)
  );
}

function clearCompareList() {
  setCompareList([]);
}

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
<button
  onClick={() => setShowDashboard(true)}
  style={{
    padding: "8px 10px",
    border: "none",
    borderRadius: 8,
    background: "#ede9fe",
    color: "#5b21b6",
    fontWeight: "bold",
    cursor: "pointer"
  }}
>
  City Stats
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
              ["thesis", "Thesis Finder"],
              ["compare", "Compare"]
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
                    recommendationResults.slice(0, 8).map((result, index) => (
                      <ResultButton
                        key={getFacultyId(result.faculty, index)}
                        result={result}
                        onSelect={selectFaculty}
                        onCompare={addToCompare}
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
                  thesisFinderResults.slice(0, 10).map((result, index) => (
                    <ResultButton
  key={getFacultyId(result.faculty, index)}
  result={result}
  onSelect={selectFaculty}
  onCompare={addToCompare}
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

          {smartMode === "compare" && (
  <div>
    <h3 style={{ margin: "8px 0 6px", fontSize: 15 }}>
      Compare Faculty
    </h3>

    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>
      Add up to 3 faculty and compare thesis status, research, publications,
      courses, and profile completeness.
    </p>

    <input
      value={compareSearch}
      onChange={(event) => setCompareSearch(event.target.value)}
      placeholder="Search faculty to compare..."
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        marginBottom: 8
      }}
    />

    {compareSearchResults.length > 0 && (
      <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
        {compareSearchResults.map((faculty) => (
          <div
            key={faculty.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
              padding: "7px 8px",
              border: "1px solid #e5e7eb",
              borderRadius: 9,
              marginBottom: 6,
              background: "white"
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 900 }}>
                {faculty.code || "?"} — {faculty.name}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {faculty.designation || faculty.role || "Data not given"}
              </div>
            </div>

            <button
              onClick={() => addToCompare(faculty)}
              disabled={compareList.length >= 3}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "6px 8px",
                background: compareList.length >= 3 ? "#e5e7eb" : "#2563eb",
                color: compareList.length >= 3 ? "#64748b" : "white",
                fontWeight: 900,
                cursor: compareList.length >= 3 ? "not-allowed" : "pointer",
                fontSize: 11
              }}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    )}

    <CompareFacultyPanel
      compareList={compareList}
      onRemove={removeFromCompare}
      onClear={clearCompareList}
      onViewFaculty={selectFaculty}
    />
  </div>
)}

          <p style={{ margin: "10px 0 0", fontSize: 12 }}>
            Highlighting {activeCount} faculty out of {facultyList.length}
          </p>
        </div>
      )}

      {showDashboard && (
  <CityStatsPanel
    stats={dashboardStats}
    onClose={() => setShowDashboard(false)}
  />
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
        dpr={performanceMode ? [0.5, 0.75] : [0.9, 1.2]}
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

        {!performanceMode && (
  <>
    <GrassPatches positions={decorations.grass} />
    <InstancedTrees positions={decorations.trees} />
    <InstancedBushes positions={decorations.bushes} />
    <StudentFigures students={decorations.students} />
  </>
)}

{performanceMode && (
  <>
    <InstancedTrees positions={decorations.trees.slice(0, 4)} />
    <InstancedBushes positions={decorations.bushes.slice(0, 4)} />
  </>
)}

        <CentralDirectoryBoard isNight={isNight} />

        {layout.roadRects
          .filter((road) => road.type === "vertical")
          .map((road, index) => (
            <RoadBillboard
  key={road.key}
  road={road}
  index={index}
  isNight={isNight}
  performanceMode={performanceMode}
/>
          ))}

        {!performanceMode && isNight && (
  <InstancedStreetLamps positions={decorations.lamps} isNight={isNight} />
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
    onCompare={addToCompare}
  />
)}
    </div>
  );
}