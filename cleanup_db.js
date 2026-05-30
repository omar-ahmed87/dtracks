require("dotenv").config();
const fs = require("fs");
const path = require("path");
const supabase = require("./supabaseClient");

async function cleanup() {
  console.log("Starting database cleanup...");

  // 1. Delete all enrollments
  const { data: enrollData, error: enrollError } = await supabase
    .from("enrollments")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all

  if (enrollError) {
    console.error("Error deleting enrollments:", enrollError);
  } else {
    console.log("Successfully deleted all enrollments.");
  }

  // 2. Delete all non-admin users
  const { data: userData, error: userError } = await supabase
    .from("users")
    .delete()
    .neq("role", "admin");

  if (userError) {
    console.error("Error deleting non-admin users:", userError);
  } else {
    console.log("Successfully deleted all non-admin users.");
  }

  // 3. Clear local JSON data backup
  const localEnrollments = path.join(__dirname, "data", "enrollments.json");
  if (fs.existsSync(localEnrollments)) {
    try {
      fs.unlinkSync(localEnrollments);
      console.log("Successfully deleted local enrollments.json file.");
    } catch (e) {
      console.error("Failed to delete local enrollments.json:", e);
    }
  }

  console.log("Cleanup complete!");
  process.exit(0);
}

cleanup();
