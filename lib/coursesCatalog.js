/**
 * Approved courses — same source as /api/courses/all and /courses page.
 */
const supabase = require("../supabaseClient");
const fs = require("fs");
const path = require("path");

const META_FILE_PATH = path.join(process.cwd(), "data", "courses_meta.json");

function getCourseMeta() {
  try {
    if (fs.existsSync(META_FILE_PATH)) {
      const data = fs.readFileSync(META_FILE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("[coursesCatalog] error reading meta file:", err.message);
  }
  return {};
}

function updateCourseMeta(courseId, metaData) {
  try {
    const dir = path.dirname(META_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const currentMeta = getCourseMeta();
    currentMeta[courseId] = { ...(currentMeta[courseId] || {}), ...metaData };
    fs.writeFileSync(META_FILE_PATH, JSON.stringify(currentMeta, null, 2));
    return true;
  } catch (err) {
    console.warn("[coursesCatalog] error writing meta file:", err.message);
    return false;
  }
}

async function listApprovedCourses() {
  if (!supabase) {
    console.warn("[coursesCatalog] Supabase not configured");
    return [];
  }

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, link, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const extraMeta = getCourseMeta();

  return (data || []).map((c) => {
    const stringId = String(c.id);
    const meta = extraMeta[stringId] || {};
    return {
      id: c.id,
      title: c.title || c.name || `Course ${c.id}`,
      description: c.description,
      link: c.link,
      img: meta.img || null,
      tagStr: meta.tagStr || null,
      weeks: meta.weeks || null,
      rating: meta.rating || null,
    };
  });
}

module.exports = { listApprovedCourses, updateCourseMeta };
