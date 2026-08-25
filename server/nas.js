// Synology NAS file storage via FileStation API
// Uploads go to the kriogriot-uploads shared folder on the NAS

const NAS_HOST   = process.env.NAS_HOST   || 'https://quickconnect.to/legacyarchives';
const NAS_USER   = process.env.NAS_USER   || 'kriogriot';
const NAS_PASS   = process.env.NAS_PASS;
const NAS_FOLDER = process.env.NAS_FOLDER || '/kriogriot-uploads';

const API_BASE = `${NAS_HOST}/webapi`;

async function nasRequest(path, params, opts = {}) {
  const url = new URL(`${API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000), ...opts });
  if (!res.ok) throw new Error(`NAS HTTP error: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(`NAS API error: ${JSON.stringify(data.error)}`);
  return data.data;
}

async function login() {
  if (!NAS_PASS) throw new Error('NAS_PASS not set in environment');
  const data = await nasRequest('auth.cgi', {
    api:     'SYNO.API.Auth',
    version: 3,
    method:  'login',
    account: NAS_USER,
    passwd:  NAS_PASS,
    session: 'FileStation',
    format:  'sid',
  });
  return data.sid;
}

async function logout(sid) {
  try {
    await nasRequest('auth.cgi', {
      api:     'SYNO.API.Auth',
      version: 3,
      method:  'logout',
      session: 'FileStation',
      _sid:    sid,
    });
  } catch (_) { /* best effort */ }
}

async function uploadToNAS(filename, buffer, mimeType) {
  const sid = await login();
  try {
    const formData = new FormData();
    formData.append('api',            'SYNO.FileStation.Upload');
    formData.append('version',        '2');
    formData.append('method',         'upload');
    formData.append('path',           NAS_FOLDER);
    formData.append('create_parents', 'true');
    formData.append('overwrite',      'false');
    formData.append('_sid',           sid);
    formData.append('file', new Blob([buffer], { type: mimeType }), filename);

    const res = await fetch(`${API_BASE}/entry.cgi`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`NAS upload HTTP error: ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(`NAS upload failed: ${JSON.stringify(data.error)}`);

    const filePath = `${NAS_FOLDER}/${filename}`;
    return await createShareLink(sid, filePath);
  } finally {
    await logout(sid);
  }
}

async function createShareLink(sid, filePath) {
  try {
    const data = await nasRequest('entry.cgi', {
      api:            'SYNO.FileStation.Sharing',
      version:        3,
      method:         'create',
      path:           filePath,
      date_expired:   '',
      date_available: '',
      _sid:           sid,
    });
    const link = data?.links?.[0];
    if (link?.url) return link.url;
  } catch (_) { /* sharing may not be enabled */ }
  return `${NAS_HOST}/#/file/${encodeURIComponent(filePath)}`;
}

module.exports = { uploadToNAS };
