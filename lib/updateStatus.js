import fs from 'fs';
import path from 'path';

const STATUS_FILE = path.join(process.cwd(), 'data/update-status.json');

export function getUpdateStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const content = fs.readFileSync(STATUS_FILE, 'utf8');
      const data = JSON.parse(content);
      // Timeout guard: if status is 'running' for more than 10 minutes, treat as timed out
      if (data.status === 'running') {
        const timeRef = data.updatedAt || data.startedAt || 0;
        if (Date.now() - timeRef > 10 * 60 * 1000) {
          return {
            status: 'error',
            stage: 'timeout',
            message: 'Uppdateringen tog för lång tid (över 10 minuter) och avbröts.',
            progress: 0,
            updatedAt: Date.now()
          };
        }
      }
      return data;
    }
  } catch (err) {
    console.warn('Could not read update-status.json:', err.message);
  }
  return {
    status: 'idle',
    stage: 'none',
    message: '',
    progress: 0,
    updatedAt: 0
  };
}

export function setUpdateStatus(statusObj) {
  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = getUpdateStatus();
    const payload = {
      ...current,
      ...statusObj,
      updatedAt: Date.now()
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  } catch (err) {
    console.warn('Could not write update-status.json:', err.message);
    return statusObj;
  }
}

export function resetUpdateStatus() {
  return setUpdateStatus({
    status: 'idle',
    stage: 'none',
    message: '',
    progress: 0,
    error: null
  });
}
