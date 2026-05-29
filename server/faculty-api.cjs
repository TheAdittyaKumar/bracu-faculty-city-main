const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5174;
const ADMIN_PASSWORD = "123456789";

const FACULTY_JSON_PATH = path.join(__dirname, "..", "src", "data", "faculty.json");

app.use(cors());
app.use(express.json({ limit: "20mb" }));

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

function normalizeFaculty(faculty) {
  const publications = toArray(faculty.publications);
  const designation = String(faculty.designation || faculty.role || "").trim() || "Data not given";

  return {
    ...faculty,
    id: faculty.id,
    name: String(faculty.name || "").trim() || "Data not given",
    code: String(faculty.code || "").trim() || "Data not given",
    designation,
    role: designation,
    email: String(faculty.email || "").trim() || "Data not given",
    imageUrl: String(faculty.imageUrl || "").trim(),
    profileUrl: String(faculty.profileUrl || "").trim(),
    biography: String(faculty.biography || "").trim() || "Data not given",
    researchInterests: toArray(faculty.researchInterests),
    publications,
    publicationCount: publications.length,
    professionalActivity: toArray(faculty.professionalActivity),
    awards: toArray(faculty.awards),
    courses: toArray(faculty.courses),
    education: toArray(faculty.education),
    websites: toArray(faculty.websites),
    address: toArray(faculty.address),
    thesisStatus: String(faculty.thesisStatus || "").trim() || "Data not given",
    supervisionRole: String(faculty.supervisionRole || "").trim() || "Data not given",
    supervisionLevel: String(faculty.supervisionLevel || "").trim() || "Data not given",
    supervisionType: String(faculty.supervisionType || "").trim() || "Data not given",
    synopsis: toArray(faculty.synopsis)
  };
}

function readFacultyData() {
  const raw = fs.readFileSync(FACULTY_JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("src/data/faculty.json must contain an array.");
  }

  return data;
}

function writeFacultyData(data) {
  const tempPath = `${FACULTY_JSON_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempPath, FACULTY_JSON_PATH);
}

function requirePassword(req, res, next) {
  const password = req.headers["x-admin-password"];

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      message: "Invalid admin password."
    });
  }

  return next();
}

app.get("/api/faculty", (req, res) => {
  try {
    const faculty = readFacultyData();

    res.json({
      ok: true,
      faculty
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

app.put("/api/faculty/:id", requirePassword, (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid faculty id."
      });
    }

    const allFaculty = readFacultyData();
    const index = allFaculty.findIndex((faculty) => Number(faculty.id) === id);

    if (index === -1) {
      return res.status(404).json({
        ok: false,
        message: "Faculty not found."
      });
    }

    const existingFaculty = allFaculty[index];

    const updatedFaculty = normalizeFaculty({
      ...existingFaculty,
      ...req.body,
      id: existingFaculty.id
    });

    allFaculty[index] = updatedFaculty;

    writeFacultyData(allFaculty);

    res.json({
      ok: true,
      message: "Faculty profile updated in src/data/faculty.json.",
      faculty: updatedFaculty
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Faculty edit API running at http://localhost:${PORT}`);
  console.log(`Editing: ${FACULTY_JSON_PATH}`);
});