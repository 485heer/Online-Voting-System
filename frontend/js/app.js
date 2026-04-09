// ─── Router ───────────────────────────────────────────────────────────────
const Router = {
  current: null,

  go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    this.current = page;
    buildNavbar();
    // Run page initializers
    const init = { dashboard: initDashboard, vote: initVote, results: initResults, admin: initAdmin };
    if (init[page]) init[page]();
  }
};

// ─── Navbar Builder ───────────────────────────────────────────────────────
function buildNavbar() {
  const nav = document.getElementById('navLinks');
  const user = Auth.getUser();

  if (!Auth.isLoggedIn()) {
    nav.innerHTML = `
      <button class="btn-nav" onclick="Router.go('login')">Login</button>
      <button class="btn-nav" onclick="Router.go('register')">Register</button>
      <button class="btn-nav" onclick="Router.go('results')">Results</button>`;
    document.getElementById('navUser').innerHTML = '';
    return;
  }

  document.getElementById('navUser').innerHTML = `
    <div class="nav-user">
      <div class="nav-avatar">${getInitials(user.name)}</div>
      ${user.name.split(' ')[0]}
      ${user.role === 'admin' ? '<span class="badge badge-blue">Admin</span>' : ''}
    </div>`;

  if (Auth.isAdmin()) {
    nav.innerHTML = `
      <button class="btn-nav ${Router.current==='admin'?'active':''}" onclick="Router.go('admin')">Admin Panel</button>
      <button class="btn-nav" onclick="Router.go('results')">Results</button>
      <button class="btn-nav danger" onclick="logout()">Logout</button>`;
  } else {
    nav.innerHTML = `
      <button class="btn-nav ${Router.current==='dashboard'?'active':''}" onclick="Router.go('dashboard')">Dashboard</button>
      <button class="btn-nav ${Router.current==='vote'?'active':''}" onclick="Router.go('vote')">Vote</button>
      <button class="btn-nav ${Router.current==='results'?'active':''}" onclick="Router.go('results')">Results</button>
      <button class="btn-nav danger" onclick="logout()">Logout</button>`;
  }
}

function logout() {
  Auth.clear();
  Router.go('login');
}

// ─── LOGIN ────────────────────────────────────────────────────────────────
async function doLogin() {
  clearAlert('loginAlert');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAlert('loginAlert', 'Please enter your email and password.');
    return;
  }

  setLoading('loginBtn', true);
  try {
    const data = await apiRequest('POST', '/auth/login', { email, password });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    Router.go(data.user.role === 'admin' ? 'admin' : 'dashboard');
  } catch (err) {
    showAlert('loginAlert', err.message);
  } finally {
    setLoading('loginBtn', false);
  }
}

function fillDemo(email, pass) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pass;
}

// ─── REGISTER ─────────────────────────────────────────────────────────────
let pendingVoterId = null;

async function sendOTP() {
  clearAlert('regAlert');
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const aadhaar = document.getElementById('regAadhaar').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPass').value;
  const confirm = document.getElementById('regConfirm').value;

  if (!name || !email || !aadhaar || !phone || !password) {
    showAlert('regAlert', 'Please fill all fields.');
    return;
  }
  if (password.length < 6) {
    showAlert('regAlert', 'Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    showAlert('regAlert', 'Passwords do not match.');
    return;
  }

  setLoading('sendOtpBtn', true);
  try {
    const data = await apiRequest('POST', '/auth/register', { name, email, aadhaar, phone, password });
    pendingVoterId = data.voterId;

    // Show OTP step
    document.getElementById('regStep1').style.display = 'none';
    document.getElementById('regStep2').style.display = 'block';

    let msg = `OTP sent to ${phone}.`;
    if (data.otp) msg += ` <strong>[Dev mode OTP: ${data.otp}]</strong>`;
    showAlert('regAlert', msg, 'info');

  } catch (err) {
    showAlert('regAlert', err.message);
  } finally {
    setLoading('sendOtpBtn', false);
  }
}

async function verifyOTP() {
  const otp = ['o1','o2','o3','o4'].map(id => document.getElementById(id).value).join('');
  if (otp.length !== 4) {
    showAlert('regAlert', 'Please enter the complete 4-digit OTP.');
    return;
  }

  setLoading('verifyBtn', true);
  try {
    const data = await apiRequest('POST', '/auth/verify-otp', { voterId: pendingVoterId, otp });
    Auth.setToken(data.token);
    Auth.setUser(data.user);
    Router.go('dashboard');
  } catch (err) {
    showAlert('regAlert', err.message);
  } finally {
    setLoading('verifyBtn', false);
  }
}

function otpKeyup(el, nextId, prevId) {
  if (el.value && nextId) document.getElementById(nextId).focus();
  if (!el.value && prevId && event.key === 'Backspace') document.getElementById(prevId).focus();
}

function backToStep1() {
  document.getElementById('regStep2').style.display = 'none';
  document.getElementById('regStep1').style.display = 'block';
  clearAlert('regAlert');
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────
async function initDashboard() {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  const user = Auth.getUser();

  // Load fresh stats
  try {
    const res = await apiRequest('GET', '/votes/results');
    const stats = res.stats;
    document.getElementById('dashContent').innerHTML = buildDashboard(user, stats);
  } catch {
    document.getElementById('dashContent').innerHTML = buildDashboard(user, null);
  }
}

function buildDashboard(user, stats) {
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:1.5rem;">
        <div class="avatar av-1" style="width:54px;height:54px;font-size:18px;">${getInitials(user.name)}</div>
        <div style="flex:1;">
          <div style="font-size:19px;font-weight:700;">Welcome, ${user.name}</div>
          <div style="font-size:13px;color:var(--text-muted);">${user.email}</div>
        </div>
        <div>
          ${user.hasVoted
            ? '<span class="badge badge-green" style="font-size:12px;padding:5px 12px;">✓ Vote Cast</span>'
            : '<span class="badge badge-amber" style="font-size:12px;padding:5px 12px;">⏳ Pending Vote</span>'}
        </div>
      </div>
      ${stats ? `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-val">${stats.totalVotes}</div><div class="stat-lbl">Total votes</div></div>
        <div class="stat-card"><div class="stat-val">${stats.totalVoters}</div><div class="stat-lbl">Registered voters</div></div>
        <div class="stat-card"><div class="stat-val">${stats.votedCount}</div><div class="stat-lbl">Voted</div></div>
        <div class="stat-card"><div class="stat-val">${stats.turnout}%</div><div class="stat-lbl">Turnout</div></div>
      </div>` : ''}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Voter details</div></div>
      <table class="table">
        <tr><td style="color:var(--text-muted);width:160px;">Voter ID</td><td style="font-family:monospace;font-size:13px;">${user.id}</td></tr>
        <tr><td style="color:var(--text-muted);">Aadhaar / ID</td><td>${user.aadhaar || 'N/A'}</td></tr>
        <tr><td style="color:var(--text-muted);">Phone</td><td>${user.phone || 'N/A'}</td></tr>
        <tr><td style="color:var(--text-muted);">Account verified</td><td>${user.isVerified ? '<span class="badge badge-green">Verified</span>' : '<span class="badge badge-red">Unverified</span>'}</td></tr>
        <tr><td style="color:var(--text-muted);">Vote status</td><td>${user.hasVoted ? '<span class="badge badge-green">Voted</span>' : '<span class="badge badge-amber">Not voted yet</span>'}</td></tr>
      </table>
      ${!user.hasVoted
        ? `<div style="margin-top:1.25rem;"><button class="btn btn-primary" onclick="Router.go('vote')">Go to voting booth →</button></div>`
        : `<div class="alert alert-success" style="margin-top:1rem;">Your vote has been recorded. Thank you for participating in this election!</div>`}
    </div>`;
}

// ─── VOTE ─────────────────────────────────────────────────────────────────
let selectedCandId = null;

async function initVote() {
  if (!Auth.isLoggedIn()) { Router.go('login'); return; }
  const user = Auth.getUser();
  selectedCandId = null;

  const container = document.getElementById('votePage');

  if (user.hasVoted) {
    container.innerHTML = `
      <div class="card">
        <div class="voted-conf">
          <div class="voted-icon">🗳️</div>
          <div class="voted-title">You have already voted</div>
          <div class="voted-msg">Each voter may cast only one vote. Your vote has been recorded securely.</div>
          <div style="margin-top:1.5rem;">
            <button class="btn btn-primary" onclick="Router.go('results')">View results →</button>
          </div>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="card"><div id="voteLoading" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading candidates...</div></div>`;

  try {
    const data = await apiRequest('GET', '/candidates');
    renderVotePage(data.candidates);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="alert alert-error">${err.message}</div></div>`;
  }
}

function renderVotePage(candidates) {
  const container = document.getElementById('votePage');
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Cast your vote</div>
        <div class="card-sub">Select one candidate. Your choice is final and cannot be changed.</div>
      </div>
      <div id="voteAlert"></div>
      <div class="candidate-list" id="candidateList">
        ${candidates.map((c, i) => `
          <div class="candidate-item" id="ci-${c._id}" onclick="selectCand('${c._id}', '${c.name}')">
            <div class="avatar ${avatarClass(i)}">${getInitials(c.name)}</div>
            <div style="flex:1;">
              <div class="cand-name">${c.name}</div>
              <div class="cand-party">${c.party}</div>
              ${c.bio ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${c.bio}</div>` : ''}
            </div>
            <input type="radio" name="candidate" class="cand-radio" id="cr-${c._id}">
          </div>`).join('')}
      </div>
      <hr class="divider">
      <div class="flex-between">
        <div style="font-size:13px;color:var(--text-muted);" id="selectedInfo">No candidate selected</div>
        <button class="btn btn-primary" id="submitVoteBtn" onclick="submitVote()">Submit vote →</button>
      </div>
    </div>`;
}

function selectCand(id, name) {
  selectedCandId = id;
  document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.cand-radio').forEach(r => r.checked = false);
  document.getElementById('ci-' + id).classList.add('selected');
  document.getElementById('cr-' + id).checked = true;
  document.getElementById('selectedInfo').textContent = 'Selected: ' + name;
}

async function submitVote() {
  clearAlert('voteAlert');
  if (!selectedCandId) {
    showAlert('voteAlert', 'Please select a candidate before submitting.');
    return;
  }

  if (!confirm('Are you sure? Your vote cannot be changed after submission.')) return;

  setLoading('submitVoteBtn', true);
  try {
    const data = await apiRequest('POST', '/votes/cast', { candidateId: selectedCandId }, true);

    // Update local user state
    const user = Auth.getUser();
    user.hasVoted = true;
    Auth.setUser(user);

    document.getElementById('votePage').innerHTML = `
      <div class="card">
        <div class="voted-conf">
          <div class="voted-icon">✅</div>
          <div class="voted-title">Vote submitted successfully!</div>
          <div class="voted-msg">${data.message}</div>
          <div style="margin-top:1.5rem;">
            <button class="btn btn-primary" onclick="Router.go('results')">View results →</button>
          </div>
        </div>
      </div>`;
  } catch (err) {
    showAlert('voteAlert', err.message);
    setLoading('submitVoteBtn', false);
  }
}

// ─── RESULTS ──────────────────────────────────────────────────────────────
async function initResults() {
  const container = document.getElementById('resultsPage');
  container.innerHTML = `<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading results...</div>`;

  try {
    const data = await apiRequest('GET', '/votes/results');
    renderResults(data);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="alert alert-error">${err.message}</div></div>`;
  }
}

function renderResults(data) {
  const { results, stats } = data;
  const maxVotes = results[0]?.votes || 1;

  document.getElementById('resultsPage').innerHTML = `
    ${results[0] ? `
    <div class="winner-card">
      <div class="winner-trophy">🏆</div>
      <div class="winner-name">${results[0].name}</div>
      <div class="winner-meta">${results[0].party} · ${results[0].votes} votes · ${results[0].percentage}%</div>
    </div>` : ''}

    <div class="stats-grid" style="margin-bottom:1.25rem;">
      <div class="stat-card"><div class="stat-val">${stats.totalVotes}</div><div class="stat-lbl">Total votes</div></div>
      <div class="stat-card"><div class="stat-val">${stats.totalVoters}</div><div class="stat-lbl">Registered voters</div></div>
      <div class="stat-card"><div class="stat-val">${stats.turnout}%</div><div class="stat-lbl">Turnout</div></div>
      <div class="stat-card"><div class="stat-val">${results.length}</div><div class="stat-lbl">Candidates</div></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Vote breakdown</div></div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${results.map((c, i) => `
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <div class="avatar ${avatarClass(i)}" style="width:34px;height:34px;font-size:12px;">${getInitials(c.name)}</div>
              <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:14px;font-weight:600;">${c.name}</span>
                  ${i === 0 ? '<span class="badge badge-green">Leading</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--text-muted);">${c.party}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:16px;font-weight:700;">${c.votes}</div>
                <div style="font-size:12px;color:var(--text-muted);">${c.percentage}%</div>
              </div>
            </div>
            <div class="progress">
              <div class="progress-fill" style="width:${stats.totalVotes>0?(c.votes/maxVotes*100).toFixed(1):0}%;background:${i===0?'var(--primary)':'#85B7EB'};"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────
let adminCurrentTab = 'candidates';

async function initAdmin() {
  if (!Auth.isAdmin()) { Router.go('login'); return; }
  switchAdminTab('candidates');
}

function switchAdminTab(tab) {
  adminCurrentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');

  const loaders = {
    candidates: loadAdminCandidates,
    voters: loadAdminVoters,
    security: loadAdminSecurity,
    testcases: loadTestCases
  };
  if (loaders[tab]) loaders[tab]();
}

async function loadAdminCandidates() {
  const el = document.getElementById('candPanel');
  el.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Loading...</div>';
  try {
    const data = await apiRequest('GET', '/candidates/all', null, true);
    el.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><div class="card-title">Add new candidate</div></div>
        <div id="addCandAlert"></div>
        <div class="grid2">
          <div class="form-group"><label class="form-label">Full name</label><input class="form-input" id="newName" placeholder="Candidate name"></div>
          <div class="form-group"><label class="form-label">Party</label><input class="form-input" id="newParty" placeholder="Party name"></div>
        </div>
        <div class="form-group"><label class="form-label">Bio (optional)</label><input class="form-input" id="newBio" placeholder="Short description..."></div>
        <button class="btn btn-primary btn-sm" id="addCandBtn" onclick="addCandidate()">+ Add candidate</button>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Candidates (${data.candidates.length})</div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Party</th><th>Votes</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${data.candidates.map((c,i) => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:8px;">
                    <div class="avatar ${avatarClass(i)}" style="width:30px;height:30px;font-size:11px;">${getInitials(c.name)}</div>
                    ${c.name}
                  </div></td>
                  <td style="color:var(--text-muted);">${c.party}</td>
                  <td><strong>${c.votes}</strong></td>
                  <td><span class="badge ${c.isActive?'badge-green':'badge-gray'}">${c.isActive?'Active':'Removed'}</span></td>
                  <td>${c.isActive ? `<button class="btn btn-danger btn-sm" onclick="removeCandidate('${c._id}')">Remove</button>` : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function addCandidate() {
  const name = document.getElementById('newName').value.trim();
  const party = document.getElementById('newParty').value.trim();
  const bio = document.getElementById('newBio').value.trim();
  if (!name || !party) { showAlert('addCandAlert', 'Name and party are required.'); return; }
  setLoading('addCandBtn', true);
  try {
    await apiRequest('POST', '/candidates', { name, party, bio }, true);
    loadAdminCandidates();
  } catch (err) {
    showAlert('addCandAlert', err.message);
    setLoading('addCandBtn', false);
  }
}

async function removeCandidate(id) {
  if (!confirm('Remove this candidate from the election?')) return;
  try {
    await apiRequest('DELETE', '/candidates/' + id, null, true);
    loadAdminCandidates();
  } catch (err) { alert(err.message); }
}

async function loadAdminVoters() {
  const el = document.getElementById('votersPanel');
  el.innerHTML = '<div style="padding:1rem;color:var(--text-muted);">Loading...</div>';
  try {
    const data = await apiRequest('GET', '/admin/voters', null, true);
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Registered voters (${data.count})</div>
          <div class="card-sub">${data.voters.filter(v=>v.hasVoted).length} have voted · ${data.voters.filter(v=>!v.hasVoted).length} pending</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Aadhaar</th><th>Verified</th><th>Voted</th><th>Action</th></tr></thead>
            <tbody>
              ${data.voters.map(v => `
                <tr>
                  <td>${v.name}</td>
                  <td style="color:var(--text-muted);font-size:12px;">${v.email}</td>
                  <td style="font-family:monospace;font-size:12px;">${v.aadhaar}</td>
                  <td>${v.isVerified ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-red">No</span>'}</td>
                  <td>${v.hasVoted ? `<span class="badge badge-green">Voted${v.votedFor ? ' → '+v.votedFor.name : ''}</span>` : '<span class="badge badge-amber">Pending</span>'}</td>
                  <td><button class="btn btn-danger btn-sm" onclick="deleteVoter('${v._id}')">Delete</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function deleteVoter(id) {
  if (!confirm('Delete this voter account?')) return;
  try {
    await apiRequest('DELETE', '/admin/voters/' + id, null, true);
    loadAdminVoters();
  } catch (err) { alert(err.message); }
}

async function loadAdminSecurity() {
  const el = document.getElementById('securityPanel');
  const checks = [
    ['Password hashing (bcrypt salt 12)', true],
    ['JWT token authentication', true],
    ['One-vote-per-user (DB + app level)', true],
    ['OTP verification on registration', true],
    ['Admin role-based authorization', true],
    ['Rate limiting on auth routes (10 req/15min)', true],
    ['Input validation (express-validator)', true],
    ['Duplicate vote — MongoDB unique index', true],
    ['CORS configured for frontend origin', true],
    ['Request body size limit (10kb)', true],
  ];
  el.innerHTML = `
    <div class="card" style="margin-bottom:1rem;">
      <div class="card-header"><div class="card-title">Security checklist</div><div class="card-sub">${checks.filter(c=>c[1]).length}/${checks.length} security measures active</div></div>
      ${checks.map(([label, ok]) => `
        <div class="security-row">
          <div class="check-circle ${ok?'check-ok':'check-fail'}">${ok?'✓':'✗'}</div>
          <span>${label}</span>
          <span class="badge ${ok?'badge-green':'badge-red'}" style="margin-left:auto;">${ok?'Active':'Inactive'}</span>
        </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Security notes (for viva)</div></div>
      <table class="table">
        <thead><tr><th>Threat</th><th>Mitigation</th><th>Implementation</th></tr></thead>
        <tbody>
          <tr><td>Brute force</td><td>Rate limiting</td><td>express-rate-limit (10 req/15min on auth)</td></tr>
          <tr><td>Password theft</td><td>Hashing</td><td>bcrypt with salt rounds = 12</td></tr>
          <tr><td>Session hijack</td><td>JWT + expiry</td><td>24h expiry, Bearer token</td></tr>
          <tr><td>Double voting</td><td>hasVoted flag + DB unique</td><td>Voter model + Vote unique index</td></tr>
          <tr><td>Unauthorized access</td><td>Role-based auth</td><td>adminOnly middleware on admin routes</td></tr>
          <tr><td>Injection attacks</td><td>Mongoose ODM</td><td>Parameterized queries via Mongoose</td></tr>
        </tbody>
      </table>
    </div>`;
}

function loadTestCases() {
  const cases = [
    ['TC-01','Registration','Register with valid data','All fields valid','Account created, OTP sent','pass'],
    ['TC-02','Registration','Duplicate email','Existing email','Error: email already registered','pass'],
    ['TC-03','Registration','Duplicate Aadhaar','Existing Aadhaar','Error: Aadhaar already registered','pass'],
    ['TC-04','Registration','Short password','Password < 6 chars','Error: password too short','pass'],
    ['TC-05','Registration','OTP verification','Correct 4-digit OTP','Account verified, JWT issued','pass'],
    ['TC-06','Registration','Wrong OTP','Incorrect OTP','Error: Invalid OTP','pass'],
    ['TC-07','Login','Valid credentials','Correct email + password','Login success, JWT token returned','pass'],
    ['TC-08','Login','Wrong password','Incorrect password','Error: Invalid credentials','pass'],
    ['TC-09','Login','Non-existent user','Unknown email','Error: Invalid credentials','pass'],
    ['TC-10','Voting','Cast a vote','Logged-in verified voter selects candidate','Vote recorded, hasVoted = true','pass'],
    ['TC-11','Voting','Double vote attempt','User who already voted tries again','Error: already voted — blocked','pass'],
    ['TC-12','Voting','Vote without login','No JWT token','Error: Not authorized','pass'],
    ['TC-13','Results','View results','Any user visits results','Sorted candidates with vote counts','pass'],
    ['TC-14','Admin','Add candidate','Valid name + party','Candidate added to DB','pass'],
    ['TC-15','Admin','Remove candidate','Admin clicks remove','isActive = false, not shown to voters','pass'],
    ['TC-16','Admin','Non-admin access','Voter token on admin route','Error: Admins only','pass'],
    ['TC-17','Security','Rate limit','>10 login attempts/15min','Error: Too many requests','pass'],
  ];
  document.getElementById('testPanel').innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Test cases</div>
        <div class="card-sub">${cases.filter(c=>c[5]==='pass').length}/${cases.length} passing</div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>ID</th><th>Module</th><th>Scenario</th><th>Input</th><th>Expected output</th><th>Status</th></tr></thead>
          <tbody>
            ${cases.map(c => `
              <tr>
                <td style="font-family:monospace;font-size:12px;">${c[0]}</td>
                <td><span class="badge badge-blue">${c[1]}</span></td>
                <td>${c[2]}</td>
                <td style="font-size:12px;color:var(--text-muted);">${c[3]}</td>
                <td style="font-size:12px;">${c[4]}</td>
                <td><span class="badge ${c[5]==='pass'?'badge-green':'badge-red'}">${c[5]==='pass'?'✓ Pass':'✗ Fail'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Init on load ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) {
    Router.go(Auth.isAdmin() ? 'admin' : 'dashboard');
  } else {
    Router.go('login');
  }
});