import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'warehouse.json');

const DEFAULT_STATE = {
  packedSubprojects: {},
  returnedSubprojects: {},
  testedRepairs: {},
  notes: [],
  lostEquipment: []
};

function ensureWarehouseFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('Could not ensure local warehouse file:', err.message);
  }
}

export function getWarehouseData() {
  ensureWarehouseFile();
  try {
    if (!fs.existsSync(FILE_PATH)) return { ...DEFAULT_STATE };
    const content = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(content);
    return {
      packedSubprojects: parsed?.packedSubprojects || {},
      returnedSubprojects: parsed?.returnedSubprojects || {},
      testedRepairs: parsed?.testedRepairs || {},
      notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
      lostEquipment: Array.isArray(parsed?.lostEquipment) ? parsed.lostEquipment : []
    };
  } catch (err) {
    console.error('Error reading warehouse data:', err.message);
    return { ...DEFAULT_STATE };
  }
}

function saveWarehouseData(data) {
  ensureWarehouseFile();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing warehouse data:', err.message);
    return false;
  }
}

// Subprojects packing & return (preserved for future use)
export function setSubprojectPacked(subprojectId, isPacked = true, packedBy = 'Lagerpersonal') {
  const data = getWarehouseData();
  const idStr = String(subprojectId);
  if (!isPacked) {
    delete data.packedSubprojects[idStr];
  } else {
    data.packedSubprojects[idStr] = {
      packed: true,
      packedAt: new Date().toISOString(),
      packedBy
    };
  }
  saveWarehouseData(data);
  return data.packedSubprojects[idStr] || null;
}

export function setSubprojectReturned(subprojectId, isReturned = true, returnedBy = 'Lagerpersonal') {
  const data = getWarehouseData();
  const idStr = String(subprojectId);
  if (!isReturned) {
    delete data.returnedSubprojects[idStr];
  } else {
    data.returnedSubprojects[idStr] = {
      returned: true,
      returnedAt: new Date().toISOString(),
      returnedBy
    };
  }
  saveWarehouseData(data);
  return data.returnedSubprojects[idStr] || null;
}

// Repairs & Testing
export function setRepairTested(repairId, isTested = true, testedBy = 'Lagerpersonal', note = '') {
  const data = getWarehouseData();
  const idStr = String(repairId);
  if (!isTested) {
    delete data.testedRepairs[idStr];
  } else {
    data.testedRepairs[idStr] = {
      tested: true,
      testedAt: new Date().toISOString(),
      testedBy,
      note
    };
  }
  saveWarehouseData(data);
  return data.testedRepairs[idStr] || null;
}

// Manual Lost & Missing Equipment (Added directly from dashboard)
export function addLostEquipment({ name, model, quantity, category, details, project, reportedBy, estimatedCostPerUnit }) {
  if (!name || !name.trim()) return null;
  const data = getWarehouseData();
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const cost = parseFloat(estimatedCostPerUnit) || 0;
  const itemModel = (model || name).trim();

  const newLost = {
    id: `local-lost-${Date.now()}`,
    name: name.trim(),
    model: itemModel,
    category: (category || 'Övrigt').trim(),
    quantity: qty,
    details: (details || '').trim(),
    project: (project || '').trim(),
    reportedBy: (reportedBy || 'Lagerpersonal').trim(),
    reportedAt: new Date().toISOString(),
    status: 'missing',
    estimatedCostPerUnit: cost,
    source: 'manual'
  };

  data.lostEquipment.unshift(newLost);
  saveWarehouseData(data);
  return newLost;
}

export function resolveLostEquipment(lostId, status = 'found') {
  const data = getWarehouseData();
  const item = data.lostEquipment.find(l => l.id === lostId);
  if (!item) return null;

  item.status = status;
  item.resolvedAt = new Date().toISOString();
  saveWarehouseData(data);
  return item;
}

export function deleteLostEquipment(lostId) {
  const data = getWarehouseData();
  const initialLen = data.lostEquipment.length;
  data.lostEquipment = data.lostEquipment.filter(l => l.id !== lostId);
  if (data.lostEquipment.length !== initialLen) {
    saveWarehouseData(data);
    return true;
  }
  return false;
}

// Quick Notes
export function addWarehouseNote(text, author = 'Lager') {
  if (!text || !text.trim()) return null;
  const data = getWarehouseData();
  const newNote = {
    id: `note-${Date.now()}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    author: author || 'Lager',
    done: false
  };
  data.notes.unshift(newNote);
  saveWarehouseData(data);
  return newNote;
}

export function toggleWarehouseNote(noteId) {
  const data = getWarehouseData();
  const note = data.notes.find(n => n.id === noteId);
  if (note) {
    note.done = !note.done;
    saveWarehouseData(data);
    return note;
  }
  return null;
}

export function deleteWarehouseNote(noteId) {
  const data = getWarehouseData();
  const initialLen = data.notes.length;
  data.notes = data.notes.filter(n => n.id !== noteId);
  if (data.notes.length !== initialLen) {
    saveWarehouseData(data);
    return true;
  }
  return false;
}
