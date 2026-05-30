/**
 * Supabase Data Backup Script (Encrypted)
 * 
 * Exports all data from Supabase tables to AES-256 encrypted local files.
 * Nobody can read the backup files without the BACKUP_SECRET from .env
 * 
 * Commands:
 *   node backup.js                        — Create encrypted backup
 *   node backup.js --list                 — List available backups
 *   node backup.js --restore <folder>     — Restore from encrypted backup
 * 
 * Backups saved to: ./backups/<timestamp>/
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const BACKUP_SECRET = process.env.BACKUP_SECRET;
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 20;
const TABLES = ['users', 'courses']; // Add more table names as needed
const MUTATION_LOG = path.join(BACKUP_DIR, 'mutation_log.enc');

const IS_SERVERLESS = process.env.VERCEL || process.env.NETLIFY || process.env.NODE_ENV === 'production';

// ── Validation ──────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

if (!BACKUP_SECRET || BACKUP_SECRET === 'change-this-to-a-strong-backup-password') {
  console.error('❌ BACKUP_SECRET must be set to a strong password in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Encryption (AES-256-GCM) ────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret) {
  // Derive a 32-byte key from the password using scrypt
  return crypto.scryptSync(secret, 'etracks-backup-salt', 32);
}

function encrypt(plaintext) {
  const key = deriveKey(BACKUP_SECRET);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Store iv + authTag + encrypted data together
  return JSON.stringify({
    iv: iv.toString('hex'),
    tag: authTag,
    data: encrypted,
  });
}

function decrypt(encryptedStr) {
  const key = deriveKey(BACKUP_SECRET);
  const { iv, tag, data } = JSON.parse(encryptedStr);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ── Helpers ─────────────────────────────────────────────────────────
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Mutation Logging ────────────────────────────────────────────────
function logMutation(tableName, action, data, user) {
  if (IS_SERVERLESS) {
    console.log(`[BACKUP-MUTATION] ${action} on ${tableName} by ${user ? user.role : 'anonymous'}`);
    return;
  }
  
  ensureDir(BACKUP_DIR);
  const entry = {
    timestamp: new Date().toISOString(),
    table: tableName,
    action,
    data,
    user: user ? { id: user.sub, role: user.role } : 'anonymous'
  };
  
  const encrypted = encrypt(JSON.stringify(entry));
  fs.appendFileSync(MUTATION_LOG, encrypted + '\n');
}

// ── Debounced Auto-Backup ───────────────────────────────────────────
let backupTimer = null;
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes (adjust as needed)

function triggerAutoBackup() {
  if (IS_SERVERLESS) return; // Automatic full backups not supported on serverless read-only FS
  
  if (backupTimer) clearTimeout(backupTimer);
  
  backupTimer = setTimeout(async () => {
    console.log('🔄 Triggering automatic scheduled backup...');
    try {
      await runBackup();
    } catch (err) {
      console.error('❌ Automatic backup failed:', err.message);
    }
  }, DEBOUNCE_MS);
}

// ── Backup a single table ───────────────────────────────────────────
async function backupTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch "${tableName}": ${error.message}`);
  }

  return data || [];
}

// ── Cleanup old backups ─────────────────────────────────────────────
function cleanupOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const entries = fs.readdirSync(BACKUP_DIR)
    .filter(name => {
      const fullPath = path.join(BACKUP_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort()
    .reverse();

  if (entries.length <= MAX_BACKUPS) return;

  const toDelete = entries.slice(MAX_BACKUPS);
  for (const dir of toDelete) {
    const fullPath = path.join(BACKUP_DIR, dir);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`  🗑️  Deleted old backup: ${dir}`);
  }
}

// ── Main backup function ────────────────────────────────────────────
async function runBackup() {
  const timestamp = getTimestamp();
  const backupPath = path.join(BACKUP_DIR, timestamp);

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    E-Tracks Encrypted Supabase Backup    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📁 Backup to: ${backupPath}`);
  console.log(`🔒 Encryption: AES-256-GCM`);
  console.log('');

  ensureDir(backupPath);

  const summary = {
    timestamp: new Date().toISOString(),
    encryption: 'AES-256-GCM',
    tables: {},
    success: true,
    errors: [],
  };

  for (const table of TABLES) {
    try {
      process.stdout.write(`  ⏳ Backing up "${table}"...`);
      const data = await backupTable(table);

      // Encrypt and save
      const jsonStr = JSON.stringify(data, null, 2);
      const encrypted = encrypt(jsonStr);
      const filePath = path.join(backupPath, `${table}.enc`);
      fs.writeFileSync(filePath, encrypted, 'utf8');

      const fileSize = formatBytes(Buffer.byteLength(encrypted, 'utf8'));
      summary.tables[table] = { rows: data.length, size: fileSize };

      console.log(` ✅ ${data.length} rows (${fileSize}) 🔒`);
    } catch (err) {
      summary.success = false;
      summary.errors.push({ table, error: err.message });
      console.log(` ❌ ${err.message}`);
    }
  }

  // Save summary (not encrypted — contains no sensitive data, just counts)
  const summaryPath = path.join(backupPath, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('');
  cleanupOldBackups();

  if (summary.success) {
    console.log('✅ Encrypted backup completed successfully!');
  } else {
    console.log('⚠️  Backup completed with errors. Check _summary.json');
  }

  console.log('');
  return summary;
}

// ── Restore function ────────────────────────────────────────────────
async function restoreBackup(backupFolder) {
  const backupPath = path.join(BACKUP_DIR, backupFolder);

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup folder not found: ${backupPath}`);
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    E-Tracks Encrypted Supabase Restore   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`📁 Restoring from: ${backupPath}`);
  console.log(`🔓 Decrypting with BACKUP_SECRET`);
  console.log('');
  console.log('⚠️  WARNING: This will UPSERT data into your database.');
  console.log('   Existing rows with matching IDs will be overwritten.');
  console.log('');

  for (const table of TABLES) {
    const filePath = path.join(backupPath, `${table}.enc`);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⏭️  Skipping "${table}" (no backup file)`);
      continue;
    }

    try {
      process.stdout.write(`  ⏳ Restoring "${table}"...`);
      const encryptedStr = fs.readFileSync(filePath, 'utf8');
      
      let decrypted;
      try {
        decrypted = decrypt(encryptedStr);
      } catch (err) {
        throw new Error('Decryption failed — wrong BACKUP_SECRET?');
      }

      const data = JSON.parse(decrypted);

      if (data.length === 0) {
        console.log(` ⏭️  Empty (0 rows)`);
        continue;
      }

      // Upsert in batches of 100
      const BATCH_SIZE = 100;
      let restored = 0;

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from(table)
          .upsert(batch, { onConflict: 'id' });

        if (error) {
          throw new Error(error.message);
        }
        restored += batch.length;
      }

      console.log(` ✅ ${restored} rows restored 🔓`);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  console.log('');
  console.log('✅ Restore completed!');
  console.log('');
}

// ── List available backups ──────────────────────────────────────────
function listBackupsData() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  return fs.readdirSync(BACKUP_DIR)
    .filter(name => {
      const fullPath = path.join(BACKUP_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort()
    .reverse()
    .map(name => {
      const summaryPath = path.join(BACKUP_DIR, name, '_summary.json');
      let summary = null;
      if (fs.existsSync(summaryPath)) {
        try {
          summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        } catch (e) {}
      }
      return { id: name, timestamp: name, summary };
    });
}

function listBackups() {
  const entries = listBackupsData();
  if (entries.length === 0) {
    console.log('No backups found.');
    return;
  }

  console.log('');
  console.log('Available backups:');
  console.log('──────────────────────────────────────');
  entries.forEach((name, i) => {
    const summaryPath = path.join(BACKUP_DIR, name, '_summary.json');
    let info = '';
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      const tables = Object.entries(summary.tables)
        .map(([t, v]) => `${t}: ${v.rows} rows`)
        .join(', ');
      const enc = summary.encryption ? ' 🔒' : '';
      info = ` (${tables})${enc}`;
    }
    console.log(`  ${i + 1}. ${name}${info}`);
  });
  console.log('');
  console.log('To restore: node backup.js --restore <folder_name>');
  console.log('');
}

// ── API Exports ──────────────────────────────────────────────────
module.exports = {
  runBackup,
  listBackupsData,
  restoreBackup,
  logMutation,
  triggerAutoBackup
};

// ── CLI Support ──────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listBackups();
  } else if (args.includes('--restore')) {
    const folderIndex = args.indexOf('--restore') + 1;
    const folder = args[folderIndex];
    if (!folder) {
      console.error('Usage: node backup.js --restore <folder_name>');
      console.error('Run "node backup.js --list" to see available backups.');
      process.exit(1);
    }
    restoreBackup(folder).catch(err => {
      console.error('Restore failed:', err);
      process.exit(1);
    });
  } else {
    runBackup().catch(err => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
  }
}
