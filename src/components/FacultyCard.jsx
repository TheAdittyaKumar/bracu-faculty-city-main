import { useMemo, useState } from "react";

const DATA_NOT_GIVEN = "Data not given";

const TABS = [
  "Overview",
  "Research",
  "Publications",
  "Teaching",
  "Thesis",
  "Links"
];

function isMissing(value) {
  if (value === null || value === undefined) return true;

  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return value.every((item) => isMissing(item));
  }

  const text = String(value).trim();
  const lower = text.toLowerCase();

  return (
    text === "" ||
    lower === "data not given" ||
    lower === "not given" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "null" ||
    lower === "undefined"
  );
}

function safeText(value) {
  if (isMissing(value)) return DATA_NOT_GIVEN;
  return String(value).trim();
}
function isValidImageUrl(value) {
  if (isMissing(value)) return false;

  const text = String(value).trim();
  const lower = text.toLowerCase();

  if (
    lower === "data not given" ||
    lower === "not given" ||
    lower === "n/a" ||
    lower === "na"
  ) {
    return false;
  }

  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("/") ||
    text.startsWith("data:image")
  );
}
function toArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter((item) => !isMissing(item));
  }

  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((item) => item.trim())
      .filter((item) => !isMissing(item));
  }

  return [];
}

function getInitials(name) {
  if (isMissing(name)) return "IMG";

  const initials = String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return initials || "IMG";
}

function getPublications(faculty) {
  return toArray(
    faculty.publications ||
      faculty.publicationList ||
      faculty.conferencePapers ||
      faculty.journalPapers
  );
}

function getPublicationCount(faculty) {
  const publications = getPublications(faculty);

  if (publications.length > 0) return publications.length;

  const count = Number(faculty.publicationCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function getResearchInterests(faculty) {
  return toArray(
    faculty.researchInterests ||
      faculty.researchInterest ||
      faculty.research ||
      faculty.interests
  );
}

function getCourses(faculty) {
  return toArray(faculty.courses || faculty.coursesTaught || faculty.teaching);
}

function getEducation(faculty) {
  return toArray(faculty.education || faculty.educationalBackground);
}

function getProfessionalActivity(faculty) {
  return toArray(
    faculty.professionalActivity ||
      faculty.professionalActivities ||
      faculty.activities
  );
}

function getAwards(faculty) {
  return toArray(faculty.awards || faculty.honors);
}

function getAddress(faculty) {
  return toArray(faculty.address);
}

function getSynopsis(faculty) {
  return toArray(faculty.synopsis || faculty.thesisSynopsis);
}

function getWebLinks(faculty) {
  const links = [
    faculty.profileUrl,
    faculty.websiteUrl,
    faculty.scholarUrl,
    ...(Array.isArray(faculty.websites) ? faculty.websites : [])
  ];

  return Array.from(
    new Set(
      links
        .map((link) => String(link || "").trim())
        .filter((link) => !isMissing(link))
    )
  );
}

function getThesisStatus(faculty) {
  return safeText(faculty.thesisStatus || faculty.thesisAvailability);
}

function getThesisRole(faculty) {
  return safeText(faculty.supervisionRole || faculty.thesisRole);
}

function getThesisLevel(faculty) {
  return safeText(faculty.supervisionLevel || faculty.thesisLevel);
}

function getThesisType(faculty) {
  return safeText(faculty.supervisionType || faculty.thesisType);
}

function ListView({ items }) {
  const cleanItems = toArray(items);

  if (!cleanItems.length) {
    return <p style={{ margin: 0, color: "#475569" }}>{DATA_NOT_GIVEN}</p>;
  }

  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
      {cleanItems.map((item, index) => (
        <li
          key={`${item}-${index}`}
          style={{ marginBottom: 7, lineHeight: 1.4, color: "#111827" }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function LinkView({ links }) {
  if (!links.length) {
    return <p style={{ margin: 0, color: "#475569" }}>{DATA_NOT_GIVEN}</p>;
  }

  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
      {links.map((link, index) => (
        <li
          key={`${link}-${index}`}
          style={{
            marginBottom: 8,
            lineHeight: 1.4,
            color: "#111827",
            wordBreak: "break-word"
          }}
        >
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb", fontWeight: 700 }}
          >
            {link}
          </a>
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
        fontSize: 14,
        color: "#0f172a"
      }}
    >
      {children}
    </h4>
  );
}

function InfoPill({ children, tone = "neutral" }) {
  const styles = {
    neutral: {
      background: "#e5e7eb",
      color: "#111827"
    },
    good: {
      background: "#dcfce7",
      color: "#15803d"
    },
    bad: {
      background: "#fee2e2",
      color: "#b91c1c"
    },
    info: {
      background: "#dbeafe",
      color: "#1d4ed8"
    }
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        ...styles[tone]
      }}
    >
      {children}
    </span>
  );
}

export default function FacultyCard({ faculty, onClose, onCompare }) {
  const [activeTab, setActiveTab] = useState("Overview");

  const publications = useMemo(() => getPublications(faculty), [faculty]);
  const publicationCount = useMemo(() => getPublicationCount(faculty), [faculty]);
  const researchInterests = useMemo(() => getResearchInterests(faculty), [faculty]);
  const courses = useMemo(() => getCourses(faculty), [faculty]);
  const education = useMemo(() => getEducation(faculty), [faculty]);
  const professionalActivity = useMemo(() => getProfessionalActivity(faculty), [faculty]);
  const awards = useMemo(() => getAwards(faculty), [faculty]);
  const address = useMemo(() => getAddress(faculty), [faculty]);
  const synopsis = useMemo(() => getSynopsis(faculty), [faculty]);
  const webLinks = useMemo(() => getWebLinks(faculty), [faculty]);

  if (!faculty) return null;

  const name = safeText(faculty.name);
  const code = safeText(faculty.code);
  const designation = safeText(faculty.designation || faculty.role);
  const imageUrl = String(faculty.imageUrl || faculty.photoUrl || faculty.image || "").trim();
  const hasValidImage = isValidImageUrl(imageUrl);
  const thesisStatus = getThesisStatus(faculty);
  const thesisStatusLower = thesisStatus.toLowerCase();

  const thesisTone =
    thesisStatusLower.includes("accepting") && !thesisStatusLower.includes("not")
      ? "good"
      : thesisStatusLower.includes("not")
        ? "bad"
        : "neutral";

  function renderContent() {
    if (activeTab === "Overview") {
      return (
        <>
          <SectionTitle>Basic Information</SectionTitle>
          <p>
            <b>Designation:</b> {designation}
          </p>
          <p>
            <b>Email:</b> {safeText(faculty.email)}
          </p>

          <SectionTitle>Biography</SectionTitle>
          <p style={{ lineHeight: 1.45, marginTop: 6 }}>
            {safeText(faculty.biography)}
          </p>

          <SectionTitle>Education</SectionTitle>
          <ListView items={education} />

          <SectionTitle>Address</SectionTitle>
          <ListView items={address} />

          <SectionTitle>Professional Activity</SectionTitle>
          <ListView items={professionalActivity} />

          <SectionTitle>Awards</SectionTitle>
          <ListView items={awards} />
        </>
      );
    }

    if (activeTab === "Research") {
      return (
        <>
          <SectionTitle>Research Interests</SectionTitle>
          <ListView items={researchInterests} />
        </>
      );
    }

    if (activeTab === "Publications") {
      return (
        <>
          <SectionTitle>Publication Count</SectionTitle>
          <div
            style={{
              display: "inline-block",
              minWidth: 70,
              padding: "8px 12px",
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              fontSize: 24,
              fontWeight: 900,
              color: "#0f172a"
            }}
          >
            {publicationCount}
          </div>

          <SectionTitle>Publication List</SectionTitle>
          <ListView items={publications} />
        </>
      );
    }

    if (activeTab === "Teaching") {
      return (
        <>
          <SectionTitle>Courses Taught</SectionTitle>
          <ListView items={courses} />
        </>
      );
    }

    if (activeTab === "Thesis") {
      return (
        <>
          <SectionTitle>Thesis / Supervision</SectionTitle>

          <div style={{ marginBottom: 12 }}>
            <InfoPill tone={thesisTone}>{thesisStatus}</InfoPill>
          </div>

          <p>
            <b>Role:</b> {getThesisRole(faculty)}
          </p>
          <p>
            <b>Level:</b> {getThesisLevel(faculty)}
          </p>
          <p>
            <b>Type:</b> {getThesisType(faculty)}
          </p>

          <SectionTitle>Synopsis</SectionTitle>
          <ListView items={synopsis} />
        </>
      );
    }

    if (activeTab === "Links") {
      return (
        <>
          <SectionTitle>Websites and Profile Links</SectionTitle>
          <LinkView links={webLinks} />
        </>
      );
    }

    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 25,
        width: 390,
        maxWidth: "calc(100vw - 40px)",
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
        title="Close"
      >
        ×
      </button>

      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingRight: 28 }}>
        {hasValidImage ? (
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 12,
              background: "#e5e7eb"
            }}
            onError={(event) => {
              event.currentTarget.style.display = "none";
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
              fontWeight: 900,
              fontSize: 18
            }}
          >
            {getInitials(name)}
          </div>
        )}

        <div>
          <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.12 }}>
            {name}
          </h2>

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
            {code}
          </span>

          <div style={{ marginTop: 5, fontWeight: 800 }}>
            {designation}
          </div>
        </div>
      </div>
            {onCompare && (
  <button
    onClick={() => onCompare(faculty)}
    style={{
      marginTop: 14,
      width: "100%",
      border: "none",
      borderRadius: 10,
      padding: "9px 10px",
      background: "#2563eb",
      color: "white",
      fontWeight: 900,
      cursor: "pointer"
    }}
  >
    Add to Compare
  </button>
)}
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

      <div>{renderContent()}</div>
    </div>
  );
}