// ─── API Configuration ─────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';

// ─── Token Management ─────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('vs_token'),
  setToken: (t) => localStorage.setItem('vs_token', t),
  getUser: () => {
    const u = localStorage.getItem('vs_user');
    return u ? JSON.parse(u) : null;
  },
  setUser: (u) => localStorage.setItem('vs_user', JSON.stringify(u)),
  clear: () => { localStorage.removeItem('vs_token'); localStorage.removeItem('vs_user'); },
  isLoggedIn: () => !!localStorage.getItem('vs_token'),
  isAdmin: () => {
    const u = Auth.getUser();
    return u && u.role === 'admin';
  }
};

// ─── HTTP Helper ──────────────────────────────────────────────────────────
async function apiRequest(method, endpoint, data = null, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = `Bearer ${Auth.getToken()}`;

  const options = { method, headers };
  if (data) options.body = JSON.stringify(data);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message || 'Something went wrong');
    }

    return json;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on port 5000.');
    }
    throw err;
  }
}

// ─── Alert Helper ─────────────────────────────────────────────────────────
function showAlert(containerId, message, type = 'error') {
  const icons = { error: '✗', success: '✓', info: 'ℹ', warning: '⚠' };
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}"><span>${icons[type]}</span>${message}</div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

// ─── Loading state helper ─────────────────────────────────────────────────
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Loading...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original || 'Submit';
  }
}

// ─── Avatar initials ──────────────────────────────────────────────────────
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarClass(index) {
  return ['av-1', 'av-2', 'av-3', 'av-4', 'av-5'][index % 5];
}
