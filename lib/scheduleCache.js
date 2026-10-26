import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data', '.cache');
const SCHEDULE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
    return { ...data, cacheAge: age };
  } catch (err) {
    return null;
  }
}

export function setCachedSchedule(weekStr, data) {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `schedule_${weekStr}.json`);
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
