// C:\Users\emilr\Documents\Projects\EventopiaDashboard\lib\rentman.js

const getBaseUrl = () => process.env.RENTMAN_API_BASE_URL || 'https://api.rentman.net';
const getToken = () => process.env.RENTMAN_API_TOKEN;

export async function fetchRentman(path, options = {}) {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();
  
  if (!token) {
    throw new Error('RENTMAN_API_TOKEN is missing from environment variables');
  }

  const defaultOptions = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    let errorMsg = `Rentman API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMsg += ` - ${JSON.stringify(errorData)}`;
    } catch (e) {
      // not JSON
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

export async function postRentman(path, body) {
  return fetchRentman(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function putRentman(path, body) {
  return fetchRentman(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteRentman(path) {
  return fetchRentman(path, {
    method: 'DELETE',
  });
}

export function extractId(refPath) {
  if (typeof refPath === 'number') return refPath;
  if (typeof refPath !== 'string') return null;
  const parts = refPath.split('/').filter(Boolean);
  const id = parts.length > 0 ? parseInt(parts[parts.length - 1], 10) : null;
  return Number.isNaN(id) ? null : id;
}
