const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://cse.sds.bracu.ac.bd";
const FACULTY_LIST_URL = `${BASE_URL}/faculty_list`;
const THESIS_LIST_URL = `${BASE_URL}/thesis/supervising/list`;
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "faculty.json");

const DATA_NOT_GIVEN = "Data not given";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FacultyCity student portfolio scraper"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function prepareHtml(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $;
}

function makeAbsoluteUrl(href) {
  if (!href) return DATA_NOT_GIVEN;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_URL}${href}`;
  return `${BASE_URL}/${href}`;
}

function getOrderedLines($) {
  return $("body")
    .text()
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean);
}

function textWithSpaces($, element) {
  const html = $(element).html();

  if (!html) {
    return cleanText($(element).text());
  }

  const spacedHtml = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|td|th|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return cleanText(cheerio.load(`<div>${spacedHtml}</div>`).text());
}

function getProfileLines($) {
  const lines = [];

  $("body")
    .find("h1,h2,h3,h4,h5,h6,p,li,td,th")
    .each((_, element) => {
      const text = textWithSpaces($, element);

      if (text) {
        lines.push(text);
      }
    });

  if (lines.length < 20) {
    return getOrderedLines($);
  }

  return lines.filter((line, index) => line !== lines[index - 1]);
}

function normalizeLine(line) {
  return cleanText(line)
    .replace(/^#+\s*/, "")
    .replace(/^\*+\s*/, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
}

function parseNameAndCode(text) {
  const match = cleanText(text).match(/^(.+?)\s*\[([A-Za-z0-9]+)\]$/);

  if (!match) return null;

  return {
    name: match[1].trim(),
    code: match[2].trim()
  };
}

function findEmail(text) {
  const match = String(text || "").match(/[A-Za-z0-9._%+-]+@bracu\.ac\.bd/i);
  return match ? match[0] : DATA_NOT_GIVEN;
}

function normalizeDesignation(text) {
  const value = cleanText(text).toLowerCase();

  if (value.includes("associate professor")) return "Associate Professor";
  if (value.includes("assistant professor")) return "Assistant Professor";
  if (value.includes("senior lecturer")) return "Senior Lecturer";
  if (value.includes("adjunct lecturer")) return "Adjunct Lecturer";
  if (value.includes("lecturer")) return "Lecturer";
  if (value.includes("professor")) return "Professor";

  return DATA_NOT_GIVEN;
}

function sectionToDesignation(line) {
  const value = normalizeLine(line);

  if (value === "professors") return "Professor";
  if (value === "associate professors") return "Associate Professor";
  if (value === "assistant professors") return "Assistant Professor";
  if (value === "senior lecturers") return "Senior Lecturer";
  if (value === "lecturers") return "Lecturer";
  if (value === "adjunct faculty") return "Adjunct Lecturer";
  if (value === "adjunct lecturers") return "Adjunct Lecturer";

  return null;
}

function getProfileUrlMap($) {
  const urlMap = new Map();

  $("a[href*='faculty_profile']").each((_, element) => {
    const text = cleanText($(element).text());
    const parsed = parseNameAndCode(text);

    if (!parsed) return;

    const href = $(element).attr("href");
    urlMap.set(parsed.code.toLowerCase(), makeAbsoluteUrl(href));
  });

  return urlMap;
}

function collectChunkAfterLine(lines, startIndex, maxLines = 12) {
  const chunk = [];

  for (let i = startIndex + 1; i < lines.length && chunk.length < maxLines; i++) {
    const line = lines[i];

    if (parseNameAndCode(line)) break;
    if (sectionToDesignation(line)) break;

    chunk.push(line);
  }

  return chunk;
}

function parseFacultyList(html) {
  const $ = prepareHtml(html);
  const lines = getOrderedLines($);
  const profileUrlMap = getProfileUrlMap($);
  const facultyMap = new Map();

  let currentSectionDesignation = DATA_NOT_GIVEN;

  for (let i = 0; i < lines.length; i++) {
    const sectionDesignation = sectionToDesignation(lines[i]);

    if (sectionDesignation) {
      currentSectionDesignation = sectionDesignation;
      continue;
    }

    const parsed = parseNameAndCode(lines[i]);
    if (!parsed) continue;

    const key = parsed.code.toLowerCase();
    if (facultyMap.has(key)) continue;

    const chunk = collectChunkAfterLine(lines, i, 12);
    const chunkText = chunk.join(" ");

    let designation = DATA_NOT_GIVEN;

    for (const line of chunk) {
      const normalized = normalizeDesignation(line);

      if (normalized !== DATA_NOT_GIVEN) {
        designation = normalized;
        break;
      }
    }

    if (designation === DATA_NOT_GIVEN) {
      designation = currentSectionDesignation;
    }

    facultyMap.set(key, {
      id: facultyMap.size + 1,
      name: parsed.name,
      code: parsed.code,
      designation,
      role: DATA_NOT_GIVEN,
      imageUrl: DATA_NOT_GIVEN,
      biography: DATA_NOT_GIVEN,
      researchInterests: [DATA_NOT_GIVEN],
      publications: [DATA_NOT_GIVEN],
      publicationCount: 0,
      professionalActivity: [DATA_NOT_GIVEN],
      awards: [DATA_NOT_GIVEN],
      courses: [DATA_NOT_GIVEN],
      education: [DATA_NOT_GIVEN],
      thesisStatus: DATA_NOT_GIVEN,
      supervisionLevel: DATA_NOT_GIVEN,
      thesisRole: DATA_NOT_GIVEN,
      thesisType: DATA_NOT_GIVEN,
      synopsis: [DATA_NOT_GIVEN],
      email: findEmail(chunkText),
      websiteUrl: DATA_NOT_GIVEN,
      scholarUrl: DATA_NOT_GIVEN,
      profileUrl: profileUrlMap.get(key) || FACULTY_LIST_URL
    });
  }

  return facultyMap;
}

function parseThesisList(html) {
  const $ = prepareHtml(html);
  const lines = getOrderedLines($);
  const thesisMap = new Map();

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseNameAndCode(lines[i]);
    if (!parsed) continue;

    const key = parsed.code.toLowerCase();
    if (thesisMap.has(key)) continue;

    const chunk = collectChunkAfterLine(lines, i, 16);
    const chunkText = chunk.join(" ");
    const lower = chunkText.toLowerCase();

    let thesisStatus = DATA_NOT_GIVEN;

    if (lower.includes("not accepting")) {
      thesisStatus = "Not Accepting";
    } else if (lower.includes("accepting")) {
      thesisStatus = "Accepting";
    }

    let supervisionLevel = DATA_NOT_GIVEN;

    if (/\bu\s*&\s*p\b/i.test(chunkText)) {
      supervisionLevel = "Undergraduate & Postgraduate";
    } else if (/\bu\b/.test(chunkText)) {
      supervisionLevel = "Undergraduate";
    } else if (/\bp\b/.test(chunkText)) {
      supervisionLevel = "Postgraduate";
    }

    let designation = DATA_NOT_GIVEN;

    for (const line of chunk) {
      const normalized = normalizeDesignation(line);

      if (normalized !== DATA_NOT_GIVEN) {
        designation = normalized;
        break;
      }
    }

    thesisMap.set(key, {
      thesisStatus,
      supervisionLevel,
      designation,
      email: findEmail(chunkText)
    });
  }

  return thesisMap;
}

function findFirstIndex(lines, predicates, start = 0) {
  for (let i = start; i < lines.length; i++) {
    if (predicates.some((predicate) => predicate(lines[i], i))) return i;
  }

  return -1;
}

function cleanSectionText(text) {
  const value = cleanText(text)
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .trim();

  if (!value) return DATA_NOT_GIVEN;

  const lower = value.toLowerCase();

  const blocked = [
    "academic calendar",
    "contact",
    "login",
    "register",
    "programs",
    "people",
    "advising",
    "career",
    "forms",
    "bracu cse",
    "open sidebar",
    "about policy contact",
    "©",
    "document.",
    "document[",
    "document(",
    "queryselector",
    "getelement",
    "addeventlistener",
    "console.",
    "window.",
    "function",
    "onclick",
    "mouseover",
    "mousemove",
    "fontawesome",
    "bootstrap"
  ];

  if (blocked.some((item) => lower.includes(item))) return DATA_NOT_GIVEN;
  if (/[{}<>]/.test(value)) return DATA_NOT_GIVEN;
  if (value.length < 2) return DATA_NOT_GIVEN;

  return value;
}

function getRange(lines, startIndex, stopPredicate) {
  if (startIndex === -1) return [];

  const result = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    if (stopPredicate(lines[i], i)) break;

    const cleaned = cleanSectionText(lines[i]);

    if (cleaned !== DATA_NOT_GIVEN) {
      result.push(cleaned);
    }
  }

  return [...new Set(result)];
}

function extractImageUrl($) {
  const candidates = [];

  $("img").each((_, element) => {
    const src = $(element).attr("src") || $(element).attr("data-src");
    if (!src) return;

    const lower = src.toLowerCase();

    const bad =
      lower.includes("logo") ||
      lower.includes("icon") ||
      lower.includes("loader") ||
      lower.includes("blank") ||
      lower.includes("transparent");

    if (!bad) {
      candidates.push(makeAbsoluteUrl(src));
    }
  });

  return candidates.length ? candidates[0] : DATA_NOT_GIVEN;
}

function extractExternalLinks($) {
  let websiteUrl = DATA_NOT_GIVEN;
  let scholarUrl = DATA_NOT_GIVEN;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const lower = href.toLowerCase();

    if (lower.includes("scholar.google")) {
      scholarUrl = href;
    }

    if (
      websiteUrl === DATA_NOT_GIVEN &&
      !lower.includes("faculty_profile") &&
      !lower.includes("mailto:") &&
      !lower.includes("javascript") &&
      (lower.startsWith("http://") || lower.startsWith("https://"))
    ) {
      websiteUrl = href;
    }
  });

  return { websiteUrl, scholarUrl };
}

function extractBiography(lines) {
  const startIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "biography"
  ]);

  if (startIndex === -1) return DATA_NOT_GIVEN;

  const stopMarkers = [
    "publication",
    "publications",
    "journals",
    "journal",
    "journal publication",
    "journal publications",
    "conference",
    "conferences",
    "conference papers",
    "professional activity",
    "professional activities",
    "awards",
    "award",
    "courses taught",
    "education",
    "membership",
    "thesis",
    "research interest",
    "research interests",
    "synopsis"
  ];

  const tabLabels = [
    "biography",
    "publication",
    "publications",
    "professional activity",
    "professional activities",
    "awards",
    "award",
    "courses taught",
    "education"
  ];

  const result = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const lower = normalizeLine(rawLine);

    if (tabLabels.includes(lower) && result.length === 0) {
      continue;
    }

    if (stopMarkers.includes(lower) && result.length > 0) {
      break;
    }

    const cleaned = cleanSectionText(rawLine);

    if (cleaned === DATA_NOT_GIVEN) continue;

    const cleanedLower = cleaned.toLowerCase();

    const looksLikeAddress =
      cleanedLower.includes("websites") ||
      cleanedLower.includes("address") ||
      cleanedLower.includes("room no") ||
      cleanedLower.includes("brac university") ||
      cleanedLower.includes("kha 224") ||
      cleanedLower.includes("merul badda");

    const looksLikeNavigation =
      cleanedLower.includes("academic calendar") ||
      cleanedLower.includes("contact") ||
      cleanedLower.includes("login") ||
      cleanedLower.includes("register") ||
      cleanedLower.includes("programs") ||
      cleanedLower.includes("people") ||
      cleanedLower.includes("advising") ||
      cleanedLower.includes("career") ||
      cleanedLower.includes("forms");

    if (looksLikeAddress || looksLikeNavigation) {
      continue;
    }

    result.push(cleaned);
  }

  const unique = [...new Set(result)];

  return unique.length ? unique.join(" ") : DATA_NOT_GIVEN;
}

function isPublicationHeader(line) {
  const lower = normalizeLine(line);

  return [
    "journals",
    "journal",
    "journal publication",
    "journal publications",
    "publication",
    "publications",
    "conference papers",
    "conference paper",
    "conference publications",
    "conference publication",
    "book chapters",
    "book chapter"
  ].includes(lower);
}

function isPublicationStopLine(line) {
  const lower = normalizeLine(line);

  return (
    lower.startsWith("academic leadership") ||
    lower.startsWith("academic appointments") ||
    [
      "professional activity",
      "professional activities",
      "awards",
      "award",
      "courses taught",
      "course taught",
      "education",
      "membership",
      "thesis",
      "research interest",
      "research interests",
      "synopsis"
    ].includes(lower)
  );
}

function isLikelyPublication(line) {
  const value = cleanSectionText(line);

  if (value === DATA_NOT_GIVEN) return false;

  const lower = value.toLowerCase();

  if (value.length < 20) return false;

  const obviousNonPublication =
    lower.includes("reviewer") ||
    lower.includes("committee") ||
    lower.includes("academic leadership") ||
    lower.includes("academic appointments") ||
    lower.includes("excellence in service award") ||
    lower.includes("scholarship") ||
    lower.includes("honor list") ||
    lower.includes("honour list") ||
    lower.includes("courses taught") ||
    lower.includes("education") ||
    lower.includes("thesis") ||
    lower.includes("runners up") ||
    lower.includes("runner up") ||
    lower.includes("olympiad") ||
    lower.includes("distinction in mathematics") ||
    lower.includes("credit in science") ||
    lower.includes("credit in computer") ||
    lower.includes("google scripting") ||
    lower.includes("discord bots") ||
    lower.includes("automation");

  if (obviousNonPublication) return false;

  const strongPublicationSignal =
    lower.includes("journal") ||
    lower.includes("conference") ||
    lower.includes("proceedings") ||
    lower.includes("symposium") ||
    lower.includes("ieee") ||
    lower.includes("acm") ||
    lower.includes("springer") ||
    lower.includes("elsevier") ||
    lower.includes("scopus") ||
    lower.includes("doi") ||
    lower.includes("volume") ||
    lower.includes("vol.") ||
    lower.includes("issue") ||
    lower.includes("pp.") ||
    lower.includes("transactions");

  const hasYear = /\b(19|20)\d{2}\b/.test(value);

  const hasAuthorPattern =
    value.includes(",") &&
    (
      lower.includes("shakil") ||
      lower.includes("ahmed") ||
      lower.includes("hossain") ||
      lower.includes("rahman") ||
      lower.includes("alam") ||
      lower.includes("haque") ||
      lower.includes("chowdhury") ||
      lower.includes("kabir") ||
      lower.includes("khan") ||
      lower.includes("jahan") ||
      lower.includes("noor") ||
      lower.includes("tasnim")
    );

  return strongPublicationSignal || (hasYear && hasAuthorPattern);
}

function extractPublications(lines) {
  const startIndex = findFirstIndex(lines, [
    (line) => isPublicationHeader(line)
  ]);

  if (startIndex === -1) {
    return [DATA_NOT_GIVEN];
  }

  const rawLines = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (isPublicationStopLine(line)) {
      break;
    }

    if (isPublicationHeader(line)) {
      continue;
    }

    const cleaned = cleanSectionText(line);

    if (cleaned !== DATA_NOT_GIVEN) {
      rawLines.push(cleaned);
    }
  }

  const groupedEntries = [];
  let currentEntryLines = [];

  for (const line of rawLines) {
    const startsNumberedEntry = /^\d+\.\s+/.test(line);

    if (startsNumberedEntry) {
      if (currentEntryLines.length > 0) {
        groupedEntries.push(currentEntryLines);
      }

      currentEntryLines = [line.replace(/^\d+\.\s*/, "").trim()];
    } else if (currentEntryLines.length > 0) {
      currentEntryLines.push(line);
    } else {
      groupedEntries.push([line]);
    }
  }

  if (currentEntryLines.length > 0) {
    groupedEntries.push(currentEntryLines);
  }

  const acceptedEntries = [];

  for (const entryLines of groupedEntries) {
    const joinedEntry = cleanText(entryLines.join(" "));
    const firstLine = cleanText(entryLines[0] || "");

    const obviousNonPublication =
      /discord bots|google scripting|automation|runners up|runner up|olympiad|scholarship|award|distinction in mathematics|credit in science|credit in computer/i.test(
        joinedEntry
      );

    if (obviousNonPublication) {
      if (acceptedEntries.length > 0) break;
      continue;
    }

    const publicationLike = isLikelyPublication(joinedEntry);
    const hasMultipleLines = entryLines.length >= 2;

    if (publicationLike || hasMultipleLines) {
      acceptedEntries.push(joinedEntry);
      continue;
    }

    if (acceptedEntries.length > 0 && firstLine.length < 90) {
      break;
    }
  }

  const cleanedEntries = acceptedEntries
    .map((entry) => cleanText(entry))
    .filter((entry) => entry.length > 20)
    .filter((entry) => {
      const lower = entry.toLowerCase();

      return !(
        lower.includes("professional activity") ||
        lower.includes("academic leadership") ||
        lower.includes("academic appointments") ||
        lower.includes("courses taught") ||
        lower.includes("education") ||
        lower.includes("thesis") ||
        lower.includes("runners up") ||
        lower.includes("runner up") ||
        lower.includes("olympiad") ||
        lower.includes("scholarship") ||
        lower.includes("distinction in mathematics") ||
        lower.includes("credit in science") ||
        lower.includes("credit in computer") ||
        lower.includes("discord bots") ||
        lower.includes("google scripting") ||
        lower.includes("automation")
      );
    });

  const unique = [...new Set(cleanedEntries)];

  return unique.length ? unique : [DATA_NOT_GIVEN];
}

function extractProfessionalActivity(lines) {
  let startIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "professional activity",
    (line) => normalizeLine(line) === "professional activities",
    (line) => normalizeLine(line).startsWith("academic leadership"),
    (line) => normalizeLine(line).startsWith("academic appointments")
  ]);

  if (startIndex !== -1 && normalizeLine(lines[startIndex]) === "professional activity") {
    const nextLeadership = findFirstIndex(
      lines,
      [
        (line) => normalizeLine(line).startsWith("academic leadership"),
        (line) => normalizeLine(line).startsWith("academic appointments")
      ],
      startIndex
    );

    if (nextLeadership !== -1) startIndex = nextLeadership;
  }

  const firstCourseIndex = findFirstIndex(lines, [
    (line) => /\b[A-Z]{2,4}\s?\d{3}\b/.test(line)
  ]);

  const firstAwardIndex = findFirstIndex(
    lines,
    [(line) => /award|scholarship|honou?r list/i.test(line)],
    startIndex === -1 ? 0 : startIndex
  );

  const raw = getRange(lines, startIndex, (line, index) => {
    const lower = normalizeLine(line);

    if (firstAwardIndex !== -1 && index >= firstAwardIndex) return true;
    if (firstCourseIndex !== -1 && index >= firstCourseIndex) return true;

    return [
      "awards",
      "courses taught",
      "education",
      "membership",
      "thesis",
      "research interest"
    ].includes(lower);
  });

  return raw.length ? raw : [DATA_NOT_GIVEN];
}

function extractAwards(lines) {
  let startIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "awards",
    (line) => normalizeLine(line) === "award"
  ]);

  if (startIndex === -1) {
    startIndex = findFirstIndex(lines, [
      (line) => /award|scholarship|honou?r list/i.test(line)
    ]);

    if (startIndex !== -1) startIndex -= 1;
  }

  const firstCourseIndex = findFirstIndex(lines, [
    (line) => /\b[A-Z]{2,4}\s?\d{3}\b/.test(line)
  ]);

  const raw = getRange(lines, startIndex, (line, index) => {
    const lower = normalizeLine(line);

    if (firstCourseIndex !== -1 && index >= firstCourseIndex) return true;

    return [
      "courses taught",
      "education",
      "membership",
      "thesis",
      "research interest"
    ].includes(lower);
  });

  const filtered = raw.filter((line) =>
    /award|scholarship|honou?r list|merit|distinction|runners up|runner up|olympiad|credit/i.test(line)
  );

  return filtered.length ? [...new Set(filtered)] : [DATA_NOT_GIVEN];
}

function extractCourses(lines) {
  const courses = lines.filter((line) => /\b[A-Z]{2,4}\s?\d{3}\b/.test(line));

  return courses.length ? [...new Set(courses.map(cleanText))] : [DATA_NOT_GIVEN];
}

function extractEducation(lines) {
  const firstCourseIndex = findFirstIndex(lines, [
    (line) => /\b[A-Z]{2,4}\s?\d{3}\b/.test(line)
  ]);

  const thesisIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "thesis"
  ]);

  const educationPattern =
    /master|bachelor|ph\.?d|doctor|msc|bsc|science|engineering|university|college|school|certificate|examination|ssc|hsc/i;

  let start = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "education"
  ]);

  if (start === -1) start = firstCourseIndex;

  const result = [];

  for (let i = start + 1; i < lines.length; i++) {
    if (thesisIndex !== -1 && i >= thesisIndex) break;
    if (normalizeLine(lines[i]) === "membership") break;

    const cleaned = cleanSectionText(lines[i]);

    if (cleaned === DATA_NOT_GIVEN) continue;

    if (
      educationPattern.test(cleaned) &&
      !/\b[A-Z]{2,4}\s?\d{3}\b/.test(cleaned)
    ) {
      result.push(cleaned);
    }
  }

  const unique = [...new Set(result)];

  return unique.length ? unique : [DATA_NOT_GIVEN];
}

function normalizeResearchItem(item) {
  return cleanText(item)
    .replace(/^research interests?\s*:?\s*/i, "")
    .replace(/^research areas?\s*:?\s*/i, "")
    .replace(/^area of interest\s*:?\s*/i, "")
    .replace(/^include\s+/i, "")
    .replace(/^includes\s+/i, "")
    .replace(/^included\s+/i, "")
    .replace(/^including\s+/i, "")
    .replace(/^mainly\s+/i, "")
    .replace(/^primarily\s+/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\.$/, "")
    .trim();
}

function isJunkResearchItem(item) {
  const lower = normalizeResearchItem(item).toLowerCase();

  const blocked = [
    "data not given",
    "unknown",
    "project",
    "internship",
    "thesis",
    "supervisor",
    "co-supervisor",
    "level",
    "synopsis",
    "accepting",
    "not accepting",
    "publication",
    "conference",
    "professional activity",
    "award",
    "biography",
    "education",
    "email",
    "office",
    "address",
    "road",
    "dhaka",
    "badda",
    "room no",
    "profile",
    "view profile",
    "bracu",
    "document.",
    "queryselector",
    "getelement",
    "console.",
    "window.",
    "function"
  ];

  if (!lower || lower.length < 3 || lower.length > 90) return true;
  if (blocked.some((word) => lower.includes(word))) return true;
  if (lower.includes("@") || lower.includes("http")) return true;
  if (/[{}<>;]/.test(item)) return true;
  if (/^[A-Z]{2,4}\s?\d{3}$/i.test(item)) return true;
  if (/^[0-9\s.,#()-]+$/.test(item)) return true;

  return false;
}

function extractResearchInterests(lines) {
  const starts = [];

  for (let i = 0; i < lines.length; i++) {
    const lower = normalizeLine(lines[i]);

    if (lower === "research interest" || lower === "research interests") {
      starts.push(i);
    }
  }

  if (!starts.length) return [DATA_NOT_GIVEN];

  let startIndex = starts[starts.length - 1];

  for (const candidate of starts) {
    const lookAhead = lines.slice(candidate + 1, candidate + 12).join(" ");

    if (/\b\d+\.\s+/.test(lookAhead)) {
      startIndex = candidate;
    }
  }

  const result = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const lower = normalizeLine(lines[i]);

    if (lower === "synopsis" || lower === "about policy contact") break;
    if (lower === "thesis" && result.length > 0) break;

    const cleaned = normalizeResearchItem(cleanSectionText(lines[i]));

    if (cleaned !== DATA_NOT_GIVEN && !isJunkResearchItem(cleaned)) {
      result.push(cleaned);
    }
  }

  const unique = [...new Set(result)];

  return unique.length ? unique.slice(0, 10) : [DATA_NOT_GIVEN];
}

function extractThesisDetails(lines, existingFaculty) {
  const thesisIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "thesis"
  ]);

  const synopsisIndex = findFirstIndex(
    lines,
    [(line) => normalizeLine(line) === "synopsis"],
    thesisIndex === -1 ? 0 : thesisIndex
  );

  const thesisLines =
    thesisIndex === -1
      ? []
      : lines.slice(thesisIndex, synopsisIndex === -1 ? thesisIndex + 40 : synopsisIndex);

  const joined = thesisLines.join(" ").toLowerCase();

  let thesisRole = DATA_NOT_GIVEN;
  let thesisType = DATA_NOT_GIVEN;
  let thesisStatus = existingFaculty.thesisStatus;
  let supervisionLevel = existingFaculty.supervisionLevel;

  if (joined.includes("not accepting")) thesisStatus = "Not Accepting";
  else if (joined.includes("accepting")) thesisStatus = "Accepting";

  if (joined.includes("co-supervisor")) thesisRole = "Supervisor / Co-supervisor";
  else if (joined.includes("supervisor")) thesisRole = "Supervisor";

  const types = [];

  if (joined.includes("thesis")) types.push("Thesis");
  if (joined.includes("project")) types.push("Project");
  if (joined.includes("internship")) types.push("Internship");

  if (types.length) thesisType = types.join(" / ");

  if (joined.includes("undergraduate & postgraduate")) {
    supervisionLevel = "Undergraduate & Postgraduate";
  } else if (joined.includes("undergraduate")) {
    supervisionLevel = "Undergraduate";
  } else if (joined.includes("postgraduate")) {
    supervisionLevel = "Postgraduate";
  }

  return { thesisRole, thesisType, thesisStatus, supervisionLevel };
}

function extractSynopsis(lines) {
  const startIndex = findFirstIndex(lines, [
    (line) => normalizeLine(line) === "synopsis"
  ]);

  if (startIndex === -1) return [DATA_NOT_GIVEN];

  const result = [];

  const blockedExact = [
    "thesis registration",
    "thesis response",
    "workshop/seminar",
    "workshop / seminar",
    "evaluation form",
    "research interest",
    "websites",
    "website",
    "address",
    "academic calendar",
    "contact",
    "login",
    "register",
    "programs",
    "people",
    "advising",
    "career",
    "forms"
  ];

  const hardStopLabels = [
    "biography",
    "publication",
    "publications",
    "journal",
    "journals",
    "journal publication",
    "journal publications",
    "conference",
    "conferences",
    "conference papers",
    "professional activity",
    "professional activities",
    "awards",
    "award",
    "courses taught",
    "education",
    "membership",
    "about policy contact"
  ];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const lower = normalizeLine(rawLine);

    if (hardStopLabels.includes(lower)) break;

    if (blockedExact.includes(lower)) {
      continue;
    }

    const cleaned = cleanSectionText(rawLine);

    if (cleaned === DATA_NOT_GIVEN) continue;

    const cleanedLower = cleaned.toLowerCase();

    const looksLikeFacultyCode = /^[A-Z]{2,6}$/.test(cleaned);
    const looksLikeEmail = cleanedLower.includes("@bracu.ac.bd");

    const looksLikeDesignation = [
      "professor",
      "associate professor",
      "assistant professor",
      "senior lecturer",
      "lecturer",
      "adjunct lecturer",
      "chairperson"
    ].includes(cleanedLower);

    const looksLikeAddress =
      cleanedLower.includes("room no") ||
      cleanedLower.includes("brac university") ||
      cleanedLower.includes("kha 224") ||
      cleanedLower.includes("merul badda") ||
      cleanedLower.includes("dhaka") ||
      cleanedLower.includes("bangladesh");

    const looksLikeBiography =
      cleanedLower.includes("has joined") ||
      cleanedLower.includes("is a lecturer") ||
      cleanedLower.includes("is a senior lecturer") ||
      cleanedLower.includes("department of computer science") ||
      cleanedLower.includes("before this") ||
      cleanedLower.includes("currently pursuing") ||
      cleanedLower.includes("completed his") ||
      cleanedLower.includes("completed her");

    if (
      result.length > 0 &&
      (looksLikeFacultyCode ||
        looksLikeEmail ||
        looksLikeDesignation ||
        looksLikeAddress ||
        looksLikeBiography)
    ) {
      break;
    }

    if (
      looksLikeFacultyCode ||
      looksLikeEmail ||
      looksLikeDesignation ||
      looksLikeAddress
    ) {
      continue;
    }

    result.push(cleaned);
  }

  const unique = [...new Set(result)];

  return unique.length ? unique : [DATA_NOT_GIVEN];
}

async function enrichFacultyProfile(faculty) {
  try {
    const html = await fetchHtml(faculty.profileUrl);
    const $ = prepareHtml(html);
    const lines = getProfileLines($);
    const links = extractExternalLinks($);
    const imageUrl = extractImageUrl($);
    const publications = extractPublications(lines);
    const thesis = extractThesisDetails(lines, faculty);

    return {
      ...faculty,
      email: faculty.email !== DATA_NOT_GIVEN ? faculty.email : findEmail(lines.join(" ")),
      role: DATA_NOT_GIVEN,
      imageUrl,
      biography: extractBiography(lines),
      researchInterests: extractResearchInterests(lines),
      publications,
      publicationCount: publications[0] === DATA_NOT_GIVEN ? 0 : publications.length,
      professionalActivity: extractProfessionalActivity(lines),
      awards: extractAwards(lines),
      courses: extractCourses(lines),
      education: extractEducation(lines),
      thesisStatus: thesis.thesisStatus,
      supervisionLevel: thesis.supervisionLevel,
      thesisRole: thesis.thesisRole,
      thesisType: thesis.thesisType,
      synopsis: extractSynopsis(lines),
      websiteUrl: links.websiteUrl,
      scholarUrl: links.scholarUrl
    };
  } catch (error) {
    console.warn(`Could not enrich ${faculty.name}: ${error.message}`);
    return faculty;
  }
}

async function main() {
  console.log("Fetching faculty list...");
  const facultyHtml = await fetchHtml(FACULTY_LIST_URL);
  const facultyMap = parseFacultyList(facultyHtml);
  console.log(`Found ${facultyMap.size} faculty entries.`);

  console.log("Fetching thesis supervisor list...");
  const thesisHtml = await fetchHtml(THESIS_LIST_URL);
  const thesisMap = parseThesisList(thesisHtml);
  console.log(`Found ${thesisMap.size} thesis supervisor entries.`);

  let facultyList = Array.from(facultyMap.values());

  facultyList = facultyList.map((faculty) => {
    const thesisInfo = thesisMap.get(faculty.code.toLowerCase());

    if (!thesisInfo) return faculty;

    return {
      ...faculty,
      thesisStatus: thesisInfo.thesisStatus,
      supervisionLevel: thesisInfo.supervisionLevel,
      designation:
        faculty.designation !== DATA_NOT_GIVEN
          ? faculty.designation
          : thesisInfo.designation,
      email: faculty.email !== DATA_NOT_GIVEN ? faculty.email : thesisInfo.email
    };
  });

  console.log("Fetching individual profile details...");

  const enrichedFaculty = [];

  for (const faculty of facultyList) {
    console.log(`Enriching: ${faculty.name} [${faculty.code}]`);
    const enriched = await enrichFacultyProfile(faculty);
    enrichedFaculty.push(enriched);
    await delay(200);
  }

  const finalData = enrichedFaculty.map((faculty, index) => ({
    ...faculty,
    id: index + 1
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2), "utf8");

  console.log(`Done. Saved ${finalData.length} entries to:`);
  console.log(OUTPUT_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});