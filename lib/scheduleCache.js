import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data', '.cache');
const SCHEDULE_TTL_MS = 45 * 1000; // 45 seconds

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignore error
  }
}

export function getCachedSchedule(weekStr, maxAge = SCHEDULE_TTL_MS) {
  try {
    const filePath = path.join(CACHE_DIR, `schedule_${weekStr}.json`);
    if (!fs.existsSync(filePath)) return null;

    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;
    if (age > maxAge) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return {
      ...data,
      cacheAge: age,
      lastUpdated: data.lastUpdated || stats.mtime.toISOString()
    };
  } catch (err) {
    return null;
  }
}

export function getLastKnownSchedule(weekStr) {
  // Returns any previously cached schedule up to 30 days old as emergency offline fallback
  return getCachedSchedule(weekStr, 30 * 24 * 60 * 60 * 1000);
}

export function setCachedSchedule(weekStr, data) {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `schedule_${weekStr}.json`);
    const payload = {
      ...data,
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
  } catch (err) {
    // Ignore error
  }
}

export function getCachedReferenceData() {
  try {
    const filePath = path.join(CACHE_DIR, 'reference_data.json');
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

export function setCachedReferenceData(data) {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, 'reference_data.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (err) {
    // Ignore error
  }
}

export function clearCachedSchedule() {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const f of files) {
        if (f.startsWith('schedule_')) {
          fs.unlinkSync(path.join(CACHE_DIR, f));
        }
      }
    }
  } catch (err) {
    // Ignore error
  }
}
