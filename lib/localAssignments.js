import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'assignments.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({ assignments: [] }, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('Could not ensure local assignments file:', err.message);
  }
}

export function getLocalAssignments() {
  ensureDataFile();
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const content = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data?.assignments) ? data.assignments : [];
  } catch (err) {
    console.error('Error reading local assignments:', err.message);
    return [];
  }
}

export function addLocalAssignment(functionId, crewId) {
  ensureDataFile();
  try {
    const assignments = getLocalAssignments();
    const existing = assignments.find(
      a => String(a.functionId) === String(functionId) && Number(a.crewId) === Number(crewId)
    );
    if (existing) return existing;

    const newAssignment = {
      id: `local-${Date.now()}-${crewId}`,
      functionId: String(functionId),
      crewId: Number(crewId),
      createdAt: new Date().toISOString()
    };

    assignments.push(newAssignment);
    fs.writeFileSync(FILE_PATH, JSON.stringify({ assignments }, null, 2), 'utf8');
    return newAssignment;
  } catch (err) {
    console.error('Error saving local assignment:', err.message);
    return {
      id: `local-${Date.now()}-${crewId}`,
      functionId: String(functionId),
      crewId: Number(crewId)
    };
  }
}

export function removeLocalAssignment(idOrProjectCrewId, functionId, crewId) {
  ensureDataFile();
  try {
    let assignments = getLocalAssignments();
    const initialLen = assignments.length;

    assignments = assignments.filter(a => {
      if (idOrProjectCrewId && String(a.id) === String(idOrProjectCrewId)) return false;
      if (functionId && crewId && String(a.functionId) === String(functionId) && Number(a.crewId) === Number(crewId)) return false;
      return true;
    });

    if (assignments.length !== initialLen) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({ assignments }, null, 2), 'utf8');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error removing local assignment:', err.message);
    return false;
  }
}
