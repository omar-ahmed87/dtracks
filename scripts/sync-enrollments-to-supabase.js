/**
 * Push local data/enrollments.json rows into Supabase enrollments table.
 * Run sql/001_student_schema.sql in Supabase first.
 *
 * Usage: node scripts/sync-enrollments-to-supabase.js
 */
require("dotenv").config();
const studentStore = require("../lib/studentStore");
const { readFileSync, existsSync } = require("fs");
const path = require("path");

async function main() {
  const file = path.join(process.cwd(), "data", "enrollments.json");
  if (!existsSync(file)) {
    console.log("No data/enrollments.json — nothing to sync.");
    return;
  }

  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!rows.length) {
    console.log("enrollments.json is empty.");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    try {
      const saved = await studentStore.persistEnrollment(row);
      if (saved?.id) {
        console.log(`✓ ${saved.applicant_email || saved.user_id} → course ${saved.course_id} (${saved.status})`);
        ok += 1;
      } else {
        console.warn(`⚠ skipped (no id):`, row.applicant_email || row.user_id);
        fail += 1;
      }
    } catch (err) {
      console.error(`✗`, row.applicant_email || row.user_id, err.message);
      fail += 1;
    }
  }

  console.log(`\nDone: ${ok} synced, ${fail} failed.`);
  if (fail > 0) {
    console.log("If you see 'enrollments' table missing, run sql/001_student_schema.sql in Supabase.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
