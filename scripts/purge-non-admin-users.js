/**
 * Deletes all users except role=admin, plus enrollments & local registration files.
 * Usage: node scripts/purge-non-admin-users.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const supabase = require("../supabaseClient");

const DATA_FILES = [
  path.join(process.cwd(), "data", "enrollments.json"),
  path.join(process.cwd(), "data", "user-phones.json"),
  path.join(process.cwd(), "data", "password_resets.json"),
];

async function deleteAllEnrollments() {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .limit(5000);
  if (error) {
    const msg = String(error.message || "");
    if (
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      console.log("  enrollments table: not in Supabase (skipped — use local file)");
      return;
    }
    throw error;
  }
  const ids = (data || []).map((r) => r.id);
  if (!ids.length) {
    console.log("  enrollments: 0 rows");
    return;
  }
  const { error: delErr } = await supabase.from("enrollments").delete().in("id", ids);
  if (delErr) throw delErr;
  console.log(`  enrollments: deleted ${ids.length} row(s)`);
}

async function deleteNonAdminUsers() {
  const { data: admins, error: adminErr } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("role", "admin");
  if (adminErr) throw adminErr;

  if (!admins?.length) {
    console.warn("  WARNING: No admin user found (role=admin). Aborting user delete.");
    return { kept: [], deleted: 0 };
  }

  console.log("  Admin account(s) kept:");
  admins.forEach((a) => console.log(`    - ${a.email} (${a.id})`));

  const adminIds = admins.map((a) => a.id);

  const { data: toDelete, error: listErr } = await supabase
    .from("users")
    .select("id, email, role")
    .not("id", "in", `(${adminIds.join(",")})`);
  if (listErr) throw listErr;

  const users = toDelete || [];
  if (!users.length) {
    console.log("  users: no non-admin accounts to delete");
    return { kept: admins, deleted: 0 };
  }

  const ids = users.map((u) => u.id);
  const { error: delErr } = await supabase.from("users").delete().in("id", ids);
  if (delErr) throw delErr;

  console.log(`  users: deleted ${users.length} account(s):`);
  users.forEach((u) => console.log(`    - ${u.email} (${u.role || "user"})`));

  return { kept: admins, deleted: users.length };
}

function clearLocalData() {
  for (const file of DATA_FILES) {
    if (!fs.existsSync(file)) continue;
    if (file.endsWith("enrollments.json")) {
      fs.writeFileSync(file, "[]\n");
      console.log(`  cleared ${path.basename(file)}`);
    } else if (file.endsWith("user-phones.json")) {
      fs.writeFileSync(file, "{}\n");
      console.log(`  cleared ${path.basename(file)}`);
    } else if (file.endsWith("password_resets.json")) {
      fs.writeFileSync(file, "[]\n");
      console.log(`  cleared ${path.basename(file)}`);
    }
  }
}

async function main() {
  console.log("Purging non-admin data...\n");

  console.log("[1] Supabase enrollments (registration requests)");
  await deleteAllEnrollments();

  console.log("\n[2] Supabase users (except admin)");
  await deleteNonAdminUsers();

  console.log("\n[3] Local JSON fallbacks");
  clearLocalData();

  console.log("\nDone. Only admin account(s) remain.");
}

main().catch((err) => {
  console.error("Purge failed:", err.message);
  process.exit(1);
});
