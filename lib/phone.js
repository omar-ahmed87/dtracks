const fs = require("fs");
const path = require("path");

const LOCAL_PHONES = path.join(process.cwd(), "data", "user-phones.json");

function readLocalPhones() {
  try {
    if (!fs.existsSync(LOCAL_PHONES)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_PHONES, "utf8"));
  } catch {
    return {};
  }
}

function writeLocalPhone(userId, phone) {
  try {
    const map = readLocalPhones();
    map[String(userId)] = phone;
    const dir = path.dirname(LOCAL_PHONES);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_PHONES, JSON.stringify(map, null, 2));
  } catch (err) {
    console.warn("Failed to write user phone locally (expected on read-only serverless like Vercel):", err.message);
  }
}

function getLocalPhone(userId) {
  return readLocalPhones()[String(userId)] || null;
}

/** @returns {{ display: string, digits: string } | null} */
function parsePhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  const display = phone.trim();
  const digits = display.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return { display, digits };
}

function phoneDigitsMatch(stored, inputDigits) {
  if (!stored || !inputDigits) return false;
  const a = String(stored).replace(/\D/g, "");
  const b = String(inputDigits).replace(/\D/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  const tail = 8;
  return a.endsWith(b.slice(-tail)) || b.endsWith(a.slice(-tail));
}

module.exports = {
  parsePhone,
  phoneDigitsMatch,
  readLocalPhones,
  writeLocalPhone,
  getLocalPhone,
};
