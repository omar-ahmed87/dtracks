const fs = require("fs");
const path = require("path");
const supabase = require("../supabaseClient");
const { buildCourseSyllabus, youtubeEmbedUrl } = require("./courseContent");

const LOCAL_SYLLABUS = path.join(process.cwd(), "data", "course_syllabus.json");

function readLocalSyllabus() {
  try {
    if (!fs.existsSync(LOCAL_SYLLABUS)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_SYLLABUS, "utf8"));
  } catch {
    return {};
  }
}

function writeLocalSyllabus(data) {
  try {
    const dir = path.dirname(LOCAL_SYLLABUS);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_SYLLABUS, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn("Failed to write local syllabus:", err.message);
  }
}

async function getSyllabus(courseId) {
  const cid = String(courseId).trim();
  
  // 1. Try fetching from Supabase
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, name, link, description, syllabus")
      .eq("id", parseInt(cid, 10))
      .maybeSingle();

    if (!error && data) {
      if (data.syllabus && typeof data.syllabus === "object" && data.syllabus.modules) {
        return data.syllabus;
      }
      // If syllabus doesn't exist, build from course defaults
      const defaultMeta = {
        m1: { en: "Module 1: Getting Started", ar: "الوحدة 1: البداية", time: "45 Min" },
        m2: { en: "Module 2: Practice & Core", ar: "الوحدة 2: التطبيق والأساسيات", time: "1 Hr" },
        m3: { en: "Module 3: Assessment & Summary", ar: "الوحدة 3: التقييم والملخص", time: "30 Min" }
      };
      const built = buildCourseSyllabus(data, defaultMeta);
      return built;
    }
  } catch (err) {
    console.warn("[getSyllabus] Supabase error, falling back to local:", err.message);
  }

  // 2. Local fallback
  const localData = readLocalSyllabus();
  if (localData[cid]) {
    return localData[cid];
  }

  // If local doesn't exist either, build standard mock syllabus
  const mockCourse = { id: cid, title: `Course #${cid}`, name: `Course #${cid}`, link: "", description: "" };
  return buildCourseSyllabus(mockCourse, null);
}

async function saveSyllabus(courseId, syllabus) {
  const cid = String(courseId).trim();

  // Validate structure
  if (!syllabus || !Array.isArray(syllabus.modules)) {
    throw new Error("Invalid syllabus structure");
  }

  // Ensure YouTube links in lessons are embedded correctly
  syllabus.modules.forEach(mod => {
    if (Array.isArray(mod.lessons)) {
      mod.lessons.forEach(lesson => {
        if (lesson.embedUrl) {
          lesson.embedUrl = youtubeEmbedUrl(lesson.embedUrl);
        }
      });
    }
  });

  // 1. Save locally first
  const localData = readLocalSyllabus();
  localData[cid] = syllabus;
  writeLocalSyllabus(localData);

  // 2. Try Supabase save
  try {
    const { error } = await supabase
      .from("courses")
      .update({ syllabus })
      .eq("id", parseInt(cid, 10));

    if (error) {
      console.warn("[saveSyllabus] Supabase update warning:", error.message);
    }
  } catch (err) {
    console.warn("[saveSyllabus] Supabase exception:", err.message);
  }

  return syllabus;
}

module.exports = {
  getSyllabus,
  saveSyllabus
};
