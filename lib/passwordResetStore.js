const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const supabase = require("../supabaseClient");

const LOCAL_RESETS = path.join(process.cwd(), "data", "password_resets.json");

function isMissingTableError(error) {
  if (!error) return false;
  const msg = (error.message || error.details || "").toLowerCase();
  return msg.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205";
}

function readLocal() {
  try {
    if (!fs.existsSync(LOCAL_RESETS)) return [];
    return JSON.parse(fs.readFileSync(LOCAL_RESETS, "utf8"));
  } catch {
    return [];
  }
}

function writeLocal(rows) {
  try {
    const dir = path.dirname(LOCAL_RESETS);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_RESETS, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn("Failed to write password resets locally (expected on read-only serverless like Vercel):", err.message);
  }
}

/**
 * Persist OTP row — Supabase first, local JSON fallback if table/columns missing.
 */
async function createReset(row) {
  const { data, error } = await supabase.from("password_resets").insert([row]).select("id").single();

  if (!error && data) {
    return { id: data.id, storage: "database" };
  }

  if (error && !isMissingTableError(error)) {
    const slim = {
      user_id: row.user_id,
      phone: row.phone || row.email || "",
      channel: row.channel,
      code_hash: row.code_hash,
      expires_at: row.expires_at,
    };
    const { data: slimData, error: slimErr } = await supabase
      .from("password_resets")
      .insert([slim])
      .select("id")
      .single();
    if (!slimErr && slimData) {
      return { id: slimData.id, storage: "database" };
    }
    if (slimErr && !isMissingTableError(slimErr)) {
      console.error("[password_resets] insert failed:", slimErr.message);
    }
  }

  const id = crypto.randomUUID();
  const localRow = {
    id,
    ...row,
    used_at: null,
    created_at: new Date().toISOString(),
  };
  const rows = readLocal();
  rows.push(localRow);
  writeLocal(rows);
  return { id, storage: "local" };
}

async function listActiveForUser(userId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("password_resets")
    .select("*")
    .eq("user_id", userId)
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!error) return data || [];

  if (isMissingTableError(error)) {
    return readLocal().filter(
      (r) => r.user_id === userId && !r.used_at && r.expires_at > now,
    );
  }

  throw error;
}

async function markUsed(resetId) {
  const { error } = await supabase
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", resetId);

  if (!error) return;

  const rows = readLocal();
  const idx = rows.findIndex((r) => r.id === resetId);
  if (idx >= 0) {
    rows[idx].used_at = new Date().toISOString();
    writeLocal(rows);
  }
}

module.exports = {
  createReset,
  listActiveForUser,
  markUsed,
};
