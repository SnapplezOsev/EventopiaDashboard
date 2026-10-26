// C:\Users\emilr\Documents\Projects\EventopiaDashboard\lib\rentman.js

const getBaseUrl = () => process.env.RENTMAN_API_BASE_URL || 'https://api.rentman.net';
const getToken = () => process.env.RENTMAN_API_TOKEN;

// Concurrency limiter to protect Rentman rate limits and prevent socket exhaustion / fetch failed
const MAX_CONCURRENT = 5;
let activeRequests = 0;
const queue = [];

function dequeue() {
  if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;
  const { fn, resolve, reject } = queue.shift();
  activeRequests++;
  fn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeRequests--;
      dequeue();
    });
}

function rateLimitedFetch(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    dequeue();
  });
}

// In-flight request deduplication and micro-cache for GET requests
if (!globalThis._rentmanGetCache) {
  globalThis._rentmanGetCache = new Map();
}
if (!globalThis._rentmanInFlightRequests) {
  globalThis._rentmanInFlightRequests = new Map();
}
const getCache = globalThis._rentmanGetCache;
const inFlightRequests = globalThis._rentmanInFlightRequests;

function getTtlForPath(path) {
  // Reference data like projects, subprojects, crew, vehicles, contacts, statuses change infrequently
  if (/^\/(projects|subprojects|crew|vehicles|contacts|statuses|projectstatuses|taskstatuses|projectfunctiongroups)/.test(path)) {
    return 5 * 60 * 1000; // 5 minutes
  }
  return 60 * 1000; // 60 seconds default
}

export async function fetchRentman(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = getToken();

  if (!token) {
    throw new Error('RENTMAN_API_TOKEN is missing from environment variables');
  }

  // Cache and in-flight deduplication only for pure GET requests without custom headers/bodies
  if (method === 'GET' && !options.noCache) {
    const cached = getCache.get(path);
    const ttl = getTtlForPath(path);
    if (cached && (Date.now() - cached.timestamp < ttl)) {
      return cached.data;
    }

    if (inFlightRequests.has(path)) {
      return inFlightRequests.get(path);
    }
  }

  const execRequest = async () => {
    const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    const defaultOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(20000), // 20s timeout to prevent hanging connections
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

    const data = await response.json();

    if (method === 'GET' && !options.noCache) {
      getCache.set(path, { data, timestamp: Date.now() });
    }

    return data;
  };

  const reqPromise = rateLimitedFetch(execRequest);

  if (method === 'GET' && !options.noCache) {
    inFlightRequests.set(path, reqPromise);
    reqPromise.finally(() => {
      inFlightRequests.delete(path);
    });
  }

  return reqPromise;
}

export function clearRentmanApiCache() {
  getCache.clear();
}

export async function postRentman(path, body) {
  clearRentmanApiCache();
  return fetchRentman(path, {
    method: 'POST',
    body: JSON.stringify(body),
    noCache: true
  });
}

export async function putRentman(path, body) {
  clearRentmanApiCache();
  return fetchRentman(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    noCache: true
  });
}

export async function deleteRentman(path) {
  clearRentmanApiCache();
  return fetchRentman(path, {
    method: 'DELETE',
    noCache: true
  });
}

export function extractId(refPath) {
  if (typeof refPath === 'number') return refPath;
  if (typeof refPath !== 'string') return null;
  const parts = refPath.split('/').filter(Boolean);
  const id = parts.length > 0 ? parseInt(parts[parts.length - 1], 10) : null;
  return Number.isNaN(id) ? null : id;
}
