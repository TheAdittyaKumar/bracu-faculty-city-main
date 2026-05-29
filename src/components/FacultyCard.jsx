import { useEffect, useMemo, useState } from "react";

const DATA_NOT_GIVEN = "Data not given";
const EDIT_API_BASE = "http://localhost:5174";
const EDIT_PASSWORD = "123456789";

const TABS = [
  "Overview",
  "Research",
  "Publications",
  "Teaching",
  "Thesis",
  "Links"
];

function safeText(value) {
  if (value === null || value === undefined || value === "") return DATA_NOT_GIVEN;
  return String(value);
}

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

function arrayToTextarea(value) {
  return toArray(value).join("\n");
}

function textareaToArray(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, value, onChange, multiline = false, placeholder = "" }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>
        {label}
      </div>

      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "8px 9px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 12,
            fontFamily: "Arial"
          }}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: "100%",
            padding: "8px 9px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 12,
            fontFamily: "Arial"
          }}
        />
      )}
    </label>
  );
}

function ListView({ items }) {
  const cleanItems = toArray(items);

  if (!cleanItems.length) {
    return <p style={{ margin: 0 }}>{DATA_NOT_GIVEN}</p>;
  }

  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
      {cleanItems.map((item, index) => (
        <li key={`${item}-${index}`} style={{ marginBottom: 7, lineHeight: 1.35 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ children }) {
  return (
    <h4
      style={{
        margin: "12px 0 6px",
        paddingBottom: 5,
        borderBottom: "1px solid #e5e7eb",
        fontSize: 14
      }}
    >
      {children}
    </h4>
  );
}

export default function FacultyCard({ faculty, onClose, onUpdateFaculty }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [editMode, setEditMode] = useState(false);
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [draft, setDraft] = useState(faculty);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    setDraft(faculty);
    setEditMode(false);
    setShowPasswordBox(false);
    setPasswordInput("");
    setAdminPassword("");
    setPasswordError("");
    setSaveStatus("");
    setActiveTab("Overview");
  }, [faculty]);

  const publicationCount = useMemo(() => {
    return toArray(draft?.publications).length;
  }, [draft]);

  if (!faculty || !draft) return null;

  function updateField(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  function updateArrayField(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: textareaToArray(value)
    }));
  }

  function requestEditAccess() {
    setShowPasswordBox(true);
    setPasswordInput("");
    setPasswordError("");
  }

  function unlockEditMode() {
    if (passwordInput !== EDIT_PASSWORD) {
      setPasswordError("Wrong password.");
      return;
    }

    setAdminPassword(passwordInput);
    setShowPasswordBox(false);
    setPasswordError("");
    setEditMode(true);
  }

  async function saveChanges() {
    setSaveStatus("Saving...");

    const publications = toArray(draft.publications);

    const updatedFaculty = {
      ...draft,
      publications,
      publicationCount: publications.length,
      researchInterests: toArray(draft.researchInterests),
      professionalActivity: toArray(draft.professionalActivity),
      awards: toArray(draft.awards),
      courses: toArray(draft.courses),
      education: toArray(draft.education),
      websites: toArray(draft.websites),
      address: toArray(draft.address),
      synopsis: toArray(draft.synopsis)
    };

    try {
      const response = await fetch(`${EDIT_API_BASE}/api/faculty/${draft.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify(updatedFaculty)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Failed to save.");
      }

      setDraft(result.faculty);
      onUpdateFaculty?.(result.faculty);
      setEditMode(false);
      setSaveStatus("Saved to src/data/faculty.json.");
    } catch (error) {
      setSaveStatus(`Save failed: ${error.message}`);
    }
  }

  function renderReadOnlyContent() {
    if (activeTab === "Overview") {
      return (
        <>
          <SectionTitle>Basic Information</SectionTitle>
          <p><b>Designation:</b> {safeText(draft.designation || draft.role)}</p>
          <p><b>Email:</b> {safeText(draft.email)}</p>

          <SectionTitle>Biography</SectionTitle>
          <p style={{ lineHeight: 1.45 }}>{safeText(draft.biography)}</p>

          <SectionTitle>Education</SectionTitle>
          <ListView items={draft.education} />

          <SectionTitle>Address</SectionTitle>
          <ListView items={draft.address} />
        </>
      );
    }

    if (activeTab === "Research") {
      return (
        <>
          <SectionTitle>Research Interests</SectionTitle>
          <ListView items={draft.researchInterests} />

          <SectionTitle>Professional Activity</SectionTitle>
          <ListView items={draft.professionalActivity} />

          <SectionTitle>Awards</SectionTitle>
          <ListView items={draft.awards} />
        </>
      );
    }

    if (activeTab === "Publications") {
      return (
        <>
          <SectionTitle>Publication Count</SectionTitle>
          <p style={{ fontWeight: 800 }}>{publicationCount}</p>

          <SectionTitle>Publication List</SectionTitle>
          <ListView items={draft.publications} />
        </>
      );
    }

    if (activeTab === "Teaching") {
      return (
        <>
          <SectionTitle>Courses Taught</SectionTitle>
          <ListView items={draft.courses} />
        </>
      );
    }

    if (activeTab === "Thesis") {
      const thesisStatus = String(draft.thesisStatus || "").toLowerCase();

      return (
        <>
          <SectionTitle>Thesis / Supervision</SectionTitle>
          <p>
            <b>Status:</b>{" "}
            <span
              style={{
                color: thesisStatus.includes("not") ? "#dc2626" : "#16a34a",
                fontWeight: 800
              }}
            >
              {safeText(draft.thesisStatus)}
            </span>
          </p>

          <p><b>Role:</b> {safeText(draft.supervisionRole)}</p>
          <p><b>Level:</b> {safeText(draft.supervisionLevel)}</p>
          <p><b>Type:</b> {safeText(draft.supervisionType)}</p>

          <SectionTitle>Synopsis</SectionTitle>
          <ListView items={draft.synopsis} />
        </>
      );
    }

    if (activeTab === "Links") {
      return (
        <>
          <SectionTitle>Official Profile</SectionTitle>
          {draft.profileUrl ? (
            <a href={draft.profileUrl} target="_blank" rel="noreferrer">
              {draft.profileUrl}
            </a>
          ) : (
            <p>{DATA_NOT_GIVEN}</p>
          )}

          <SectionTitle>Websites</SectionTitle>
          <ListView items={draft.websites} />
        </>
      );
    }

    return null;
  }

  function renderEditContent() {
    return (
      <>
        <SectionTitle>Edit Basic Information</SectionTitle>

        <Field
          label="Name"
          value={safeText(draft.name) === DATA_NOT_GIVEN ? "" : draft.name}
          onChange={(value) => updateField("name", value)}
        />

        <Field
          label="Code"
          value={safeText(draft.code) === DATA_NOT_GIVEN ? "" : draft.code}
          onChange={(value) => updateField("code", value)}
        />

        <Field
          label="Designation"
          value={safeText(draft.designation) === DATA_NOT_GIVEN ? "" : draft.designation}
          onChange={(value) => updateField("designation", value)}
        />

        <Field
          label="Email"
          value={safeText(draft.email) === DATA_NOT_GIVEN ? "" : draft.email}
          onChange={(value) => updateField("email", value)}
        />

        <Field
          label="Image URL"
          value={safeText(draft.imageUrl) === DATA_NOT_GIVEN ? "" : draft.imageUrl}
          onChange={(value) => updateField("imageUrl", value)}
        />

        <Field
          label="Official Profile URL"
          value={safeText(draft.profileUrl) === DATA_NOT_GIVEN ? "" : draft.profileUrl}
          onChange={(value) => updateField("profileUrl", value)}
        />

        <Field
          label="Biography"
          value={safeText(draft.biography) === DATA_NOT_GIVEN ? "" : draft.biography}
          onChange={(value) => updateField("biography", value)}
          multiline
        />

        <Field
          label="Research Interests — one per line"
          value={arrayToTextarea(draft.researchInterests)}
          onChange={(value) => updateArrayField("researchInterests", value)}
          multiline
        />

        <Field
          label="Publications — one per line"
          value={arrayToTextarea(draft.publications)}
          onChange={(value) => updateArrayField("publications", value)}
          multiline
        />

        <Field
          label="Courses — one per line"
          value={arrayToTextarea(draft.courses)}
          onChange={(value) => updateArrayField("courses", value)}
          multiline
        />

        <Field
          label="Education — one per line"
          value={arrayToTextarea(draft.education)}
          onChange={(value) => updateArrayField("education", value)}
          multiline
        />

        <Field
          label="Professional Activity — one per line"
          value={arrayToTextarea(draft.professionalActivity)}
          onChange={(value) => updateArrayField("professionalActivity", value)}
          multiline
        />

        <Field
          label="Awards — one per line"
          value={arrayToTextarea(draft.awards)}
          onChange={(value) => updateArrayField("awards", value)}
          multiline
        />

        <Field
          label="Websites — one per line"
          value={arrayToTextarea(draft.websites)}
          onChange={(value) => updateArrayField("websites", value)}
          multiline
        />

        <Field
          label="Address — one per line"
          value={arrayToTextarea(draft.address)}
          onChange={(value) => updateArrayField("address", value)}
          multiline
        />

        <SectionTitle>Edit Thesis / Supervision</SectionTitle>

        <Field
          label="Thesis Status"
          value={safeText(draft.thesisStatus) === DATA_NOT_GIVEN ? "" : draft.thesisStatus}
          onChange={(value) => updateField("thesisStatus", value)}
          placeholder="Accepting / Not Accepting"
        />

        <Field
          label="Supervision Role"
          value={safeText(draft.supervisionRole) === DATA_NOT_GIVEN ? "" : draft.supervisionRole}
          onChange={(value) => updateField("supervisionRole", value)}
        />

        <Field
          label="Supervision Level"
          value={safeText(draft.supervisionLevel) === DATA_NOT_GIVEN ? "" : draft.supervisionLevel}
          onChange={(value) => updateField("supervisionLevel", value)}
        />

        <Field
          label="Supervision Type"
          value={safeText(draft.supervisionType) === DATA_NOT_GIVEN ? "" : draft.supervisionType}
          onChange={(value) => updateField("supervisionType", value)}
        />

        <Field
          label="Synopsis — one per line"
          value={arrayToTextarea(draft.synopsis)}
          onChange={(value) => updateArrayField("synopsis", value)}
          multiline
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={saveChanges}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 8,
              padding: "9px 10px",
              background: "#16a34a",
              color: "white",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Save to faculty.json
          </button>

          <button
            onClick={() => {
              setDraft(faculty);
              setEditMode(false);
              setSaveStatus("");
            }}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 8,
              padding: "9px 10px",
              background: "#e5e7eb",
              color: "#111827",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 25,
        width: 390,
        maxHeight: "88vh",
        overflowY: "auto",
        background: "rgba(255,255,255,0.97)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 16px 45px rgba(0,0,0,0.28)",
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

      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 28 }}>
        {draft.imageUrl ? (
          <img
            src={draft.imageUrl}
            alt={draft.name}
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 12,
              background: "#e5e7eb"
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontWeight: 800
            }}
          >
            IMG
          </div>
        )}

        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{safeText(draft.name)}</h2>

          <span
            style={{
              display: "inline-block",
              marginTop: 5,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#e5e7eb",
              fontSize: 11,
              fontWeight: 800
            }}
          >
            {safeText(draft.code)}
          </span>

          <div style={{ marginTop: 5, fontWeight: 800 }}>
            {safeText(draft.designation || draft.role)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 7,
          flexWrap: "wrap",
          marginTop: 14,
          marginBottom: 12
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "7px 9px",
              background: activeTab === tab ? "#111827" : "#e5e7eb",
              color: activeTab === tab ? "white" : "#111827",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {!editMode && (
          <button
            onClick={requestEditAccess}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 10px",
              background: "#2563eb",
              color: "white",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Edit Profile
          </button>
        )}

        {editMode && (
          <button
            onClick={() => {
              setDraft(faculty);
              setEditMode(false);
              setSaveStatus("");
            }}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 10px",
              background: "#ef4444",
              color: "white",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Exit Edit Mode
          </button>
        )}
      </div>

      {showPasswordBox && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #cbd5e1"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
            Enter admin password
          </div>

          <input
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") unlockEditMode();
            }}
            style={{
              width: "100%",
              padding: "8px 9px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              marginBottom: 8
            }}
          />

          {passwordError && (
            <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>
              {passwordError}
            </div>
          )}

          <button
            onClick={unlockEditMode}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 10px",
              background: "#111827",
              color: "white",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Unlock Editing
          </button>
        </div>
      )}

      {saveStatus && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: saveStatus.startsWith("Save failed") ? "#fee2e2" : "#dcfce7",
            color: saveStatus.startsWith("Save failed") ? "#991b1b" : "#166534",
            fontSize: 12,
            fontWeight: 800
          }}
        >
          {saveStatus}
        </div>
      )}

      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
        {editMode ? renderEditContent() : renderReadOnlyContent()}
      </div>
    </div>
  );
}