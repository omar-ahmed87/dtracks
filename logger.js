const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'error.log');

const IS_SERVERLESS = process.env.VERCEL || process.env.NETLIFY || process.env.NODE_ENV === 'production';

if (!IS_SERVERLESS && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function formatRequestMetadata(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || '';

  return {
    method: req.method,
    path: req.originalUrl,
    ip,
    userAgent: req.get('User-Agent') || '',
    user: req.user ? { username: req.user.sub, role: req.user.role } : null,
  };
}

function logError(err, req) {
  const entry = {
    timestamp: new Date().toISOString(),
    message: err.message || 'Unknown error',
    stack: err.stack || null,
    request: req ? formatRequestMetadata(req) : null,
  };

  if (IS_SERVERLESS) {
    console.error('[SERVER ERROR]', JSON.stringify(entry));
  } else {
    try {
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
      console.error('[LOG ERROR] Could not write to log file:', e.message);
      console.error('[SERVER ERROR]', JSON.stringify(entry));
    }
  }
}

async function readLogs(limit = 100) {
  try {
    const contents = await fs.promises.readFile(logFile, 'utf8');
    const lines = contents
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return { raw: line };
        }
      });

    return lines.slice(-limit);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function clearLogs() {
  await fs.promises.writeFile(logFile, '');
}

module.exports = {
  logError,
  readLogs,
  clearLogs,
};
