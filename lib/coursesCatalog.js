/**
 * Approved courses — same source as /api/courses/all and /courses page.
 */
const supabase = require("../supabaseClient");

async function listApprovedCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, link, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((c) => ({
    id: c.id,
    title: c.title || c.name || `Course ${c.id}`,
    description: c.description,
    link: c.link,
  }));
}

module.exports = { listApprovedCourses };
