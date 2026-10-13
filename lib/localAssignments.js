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

export function addLocalAssignment(dataOrFunctionId, optionalCrewId) {
  ensureDataFile();
  try {
    const assignments = getLocalAssignments();
    
    const payload = typeof dataOrFunctionId === 'object' && dataOrFunctionId !== null
      ? dataOrFunctionId
      : { functionId: dataOrFunctionId, crewId: optionalCrewId };

    const functionId = String(payload.functionId);
    const crewId = Number(payload.crewId);

    const existingIndex = assignments.findIndex(
      a => String(a.functionId) === functionId && Number(a.crewId) === crewId
    );
    if (existingIndex >= 0) return assignments[existingIndex];

    const newAssignment = {
      id: `local-${Date.now()}-${crewId}`,
      functionId,
      crewId,
      functionName: payload.functionName || '',
      projectName: payload.projectName || '',
      projectColor: payload.projectColor || '#14B4EC',
      planperiod_start: payload.planperiod_start || null,
      planperiod_end: payload.planperiod_end || null,
      crewName: payload.crewName || 'Okänd',
      crewCategory: payload.crewCategory || 'internal',
      createdAt: new Date().toISOString()
    };

    assignments.push(newAssignment);
    fs.writeFileSync(FILE_PATH, JSON.stringify({ assignments }, null, 2), 'utf8');
    return newAssignment;
  } catch (err) {
    console.error('Error saving local assignment:', err.message);
    const functionId = typeof dataOrFunctionId === 'object' ? dataOrFunctionId.functionId : dataOrFunctionId;
    const crewId = typeof dataOrFunctionId === 'object' ? dataOrFunctionId.crewId : optionalCrewId;
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

export function clearAllLocalAssignments() {
  ensureDataFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify({ assignments: [] }, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}
