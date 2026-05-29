import { useState } from "react";
import facultyData from "../data/faculty.json";
import SearchFilter from "./SearchFilter";

const districtConfig = {
  Professor: { x: 14, label: "Professor" },
  "Associate Professor": { x: 28, label: "Associate Professor" },
  "Assistant Professor": { x: 42, label: "Assistant Professor" },
  "Senior Lecturer": { x: 58, label: "Senior Lecturer" },
  Lecturer: { x: 74, label: "Lecturer" },
  "Adjunct Lecturer": { x: 88, label: "Adjunct" },
  Unknown: { x: 96, label: "Other" }
};

function getDistrictKey(faculty) {
  if (districtConfig[faculty.designation]) {
    return faculty.designation;
  }

  return "Unknown";
}

function buildMapPositionMap(list) {
  const counters = {};

  return list.reduce((map, faculty) => {
    const districtKey = getDistrictKey(faculty);

    if (!counters[districtKey]) {
      counters[districtKey] = 0;
    }

    const localIndex = counters[districtKey];
    counters[districtKey] += 1;

    const district = districtConfig[districtKey] || districtConfig.Unknown;

    const row = localIndex % 8;
    const columnOffset = Math.floor(localIndex / 8) * 3;

    const x = Math.min(97, district.x + columnOffset);
    const y = 20 + row * 8;

    map[faculty.id] = { x, y };

    return map;
  }, {});
}

function getDotColor(faculty) {
  if (faculty.thesisStatus === "Accepting") return "#22c55e";
  if (faculty.thesisStatus === "Not Accepting") return "#6b7280";
  return "#f59e0b";
}

export default function MapMode({ onSelectFaculty }) {
  const [searchText, setSearchText] = useState("");
  const [designationFilter, setDesignationFilter] = useState("All");
  const [thesisFilter, setThesisFilter] = useState("All");

  const filteredFaculty = facultyData.filter((faculty) => {
    const search = searchText.toLowerCase();

    const matchesSearch =
      faculty.name.toLowerCase().includes(search) ||
      faculty.code.toLowerCase().includes(search) ||
      faculty.designation.toLowerCase().includes(search) ||
      faculty.researchInterests.join(" ").toLowerCase().includes(search);

    const matchesDesignation =
      designationFilter === "All" || faculty.designation === designationFilter;

    const matchesThesis =
      thesisFilter === "All" || faculty.thesisStatus === thesisFilter;

    return matchesSearch && matchesDesignation && matchesThesis;
  });

  const mapPositionMap = buildMapPositionMap(filteredFaculty);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#f3f4f6",
        padding: "125px 28px 28px",
        fontFamily: "Arial",
        overflow: "hidden"
      }}
    >
      <h1 style={{ margin: "0 0 6px" }}>FacultyCity Map</h1>

      <p style={{ margin: "0 0 20px", color: "#4b5563" }}>
        Search and filter faculty buildings from a clean top-down view.
      </p>

      <SearchFilter
        searchText={searchText}
        setSearchText={setSearchText}
        designationFilter={designationFilter}
        setDesignationFilter={setDesignationFilter}
        thesisFilter={thesisFilter}
        setThesisFilter={setThesisFilter}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "72vh",
          background: "#d1d5db",
          borderRadius: 22,
          overflow: "hidden",
          border: "3px solid #111827"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "4%",
            top: "48%",
            width: "92%",
            height: 40,
            background: "#374151",
            borderRadius: 8
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "49%",
            top: "8%",
            width: 40,
            height: "84%",
            background: "#4b5563",
            borderRadius: 8
          }}
        />

        {Object.values(districtConfig).map((district) => (
          <div
            key={district.label}
            style={{
              position: "absolute",
              left: `${district.x}%`,
              top: "5%",
              transform: "translateX(-50%)",
              background: "white",
              padding: "5px 8px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: "bold",
              whiteSpace: "nowrap"
            }}
          >
            {district.label}
          </div>
        ))}

        {filteredFaculty.map((faculty) => {
          const position = mapPositionMap[faculty.id];

          return (
            <button
              key={faculty.id}
              onClick={() => onSelectFaculty(faculty)}
              title={faculty.name}
              style={{
                position: "absolute",
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: "translate(-50%, -50%)",
                minWidth: 44,
                height: 44,
                borderRadius: 12,
                border: "3px solid #111827",
                background: getDotColor(faculty),
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
                fontSize: 11
              }}
            >
              {faculty.code}
            </button>
          );
        })}

        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 18,
            background: "white",
            padding: 14,
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.7
          }}
        >
          <b>Legend</b>
          <br />
          <span style={{ color: "#22c55e" }}>■</span> Thesis accepting
          <br />
          <span style={{ color: "#6b7280" }}>■</span> Not accepting
          <br />
          <span style={{ color: "#f59e0b" }}>■</span> Unknown
        </div>
      </div>
    </div>
  );
}