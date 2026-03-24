/* MUN Central Asia — admin.js
   Phase 3 update.

   - Admin panel: full access (Conferences, Reviews, Approvals, Award Approvals, + Add)
   - Organizer panel: limited access (My Conferences, Award Approvals, + New Conference)
   - showOrganizerPanel() — entry point for approved organizers
   - Award approvals tab added for both admin and organizer
   - owner_id is set on conference creation
*/

var adminActiveTab = 'conferences';
var editingConfId  = null;
var addStep        = 0;
var addData        = {};

/* ── Open / close ─────────────────────────────────────────────── */
/* openAdmin is now primarily handled by auth.js handleNavAuthClick().
   This fallback only fires if auth.js didn't define it (shouldn't happen). */
if (typeof window.openAdmin !== 'function' || !window.__authState) {
  window.openAdmin = function () {
    var st   = window.__authState || {};
    var role = st.role || null;

    if (role === 'admin') {
      document.getElementById('admin-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
      showAdminPanel();
      return;
    }

    if (role === 'organizer' && st.approved) {
      if (typeof window.openProfile === 'function') { window.openProfile(); return; }
    }

    if (typeof window.openAuth === 'function') {
      window.openAuth('delegate');
    }
  };
}

function closeAdmin() {
  /* If wizard was running inside profile panel, restore DOM IDs first */
  var hiddenBody = document.getElementById('admin-body-hidden');
  var hiddenFoot = document.getElementById('admin-footer-hidden');
  if (hiddenBody) {
    var pb = document.getElementById('admin-body');
    var pf = document.getElementById('admin-footer');
    hiddenBody.id = 'admin-body';
    hiddenFoot.id = 'admin-footer';
    if (pb) pb.id = 'profile-body';
    if (pf) pf.id = 'profile-footer';
  }
  var ov = document.getElementById('admin-overlay');
  if (ov) { ov.classList.remove('open'); }
  document.body.style.overflow = '';
  editingConfId = null;
  addData       = {};
}

/* ── Organizer panel (approved organizers only) ────────────────── */
window.showOrganizerPanel = function () {
  var st = window.__authState || {};
  if (st.role !== 'organizer') return;

  /* Organizers get their own profile panel — not the admin overlay */
  if (typeof window.openProfile === 'function') {
    window.openProfile();
  }
};

/* ── Admin panel shell ─────────────────────────────────────────── */
window.showAdminPanel = function () {
  /* Guard: only render if truly an admin */
  var st = window.__authState || {};
  if (st.role !== 'admin') return;

  document.getElementById('admin-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('admin-title').textContent = 'Admin Panel';

  var tabsBar = document.getElementById('admin-tabs-bar');
  tabsBar.style.display = 'flex';
  tabsBar.innerHTML =
    '<button class="admin-tab active" id="atab-conferences" onclick="switchAdminTab(\'conferences\')">Conferences</button>'
    + '<button class="admin-tab" id="atab-reviews"       onclick="switchAdminTab(\'reviews\')">Reviews</button>'
    + '<button class="admin-tab" id="atab-approvals"     onclick="switchAdminTab(\'approvals\')">Approvals</button>'
    + '<button class="admin-tab" id="atab-award-approvals" onclick="switchAdminTab(\'award-approvals\')">Award Approvals</button>'
    + '<button class="admin-tab" id="atab-add"           onclick="switchAdminTab(\'add\')">+ Add Conference</button>';

  var userLabel = 'Admin';
  try {
    var p = st.profile;
    userLabel = (p && p.display_name) ? p.display_name
      : (st.user && st.user.email)   ? st.user.email
      : 'Admin';
  } catch (e) {}

  document.getElementById('admin-footer').innerHTML =
    '<span style="font-size:.72rem;color:var(--muted);">' + escHtml(userLabel) + '</span>'
    + '<button class="btn-s" onclick="adminLogout()">Log out</button>';

  switchAdminTab('conferences');
};

function adminLogout() {
  adminActiveTab = 'conferences';
  document.getElementById('admin-tabs-bar').style.display = 'none';
  if (typeof window.authSignOut === 'function') {
    window.authSignOut().catch(function () {});
  }
  closeAdmin();
}

function switchAdminTab(tab) {
  adminActiveTab = tab;
  var tabs = ['conferences', 'reviews', 'approvals', 'award-approvals', 'add'];
  for (var i = 0; i < tabs.length; i++) {
    var el = document.getElementById('atab-' + tabs[i]);
    if (el) el.classList.toggle('active', tabs[i] === tab);
  }
  if      (tab === 'conferences')     renderAdminConferences();
  else if (tab === 'reviews')         renderAdminReviews();
  else if (tab === 'approvals')       renderAdminApprovals();
  else if (tab === 'award-approvals') renderAdminAwardApprovals();
  else if (tab === 'add')             renderAddStep(0);
}

/* ── Tab: Conferences ──────────────────────────────────────────── */
function renderAdminConferences() {
  var html = '';
  if (!SB_CONFIGURED) {
    html += '<div class="setup-banner"><strong>&#9888; Supabase not configured</strong>'
      + ' Add your credentials to js/config.js.</div>';
  }

  /* Show all confs including drafts (admin sees everything) */
  var all = CONFS.slice();
  if (!all || all.length === 0) {
    html += '<div style="padding:1.5rem;color:var(--muted);font-size:.85rem;">'
      + 'No conferences yet. Use the + Add Conference tab.</div>';
  } else {
    html += '<div class="admin-conf-list">';
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      var comCount = (c.committees || []).length;
      var isDraft  = (c.status === 'draft');
      html += '<div class="admin-conf-item"'
        + (isDraft ? ' style="opacity:.7;border-left:3px solid var(--accent);"' : '') + '>'
        + '<div>'
        + '<div class="acf-name">' + escHtml(c.name)
        + (isDraft ? ' <span style="font-size:.62rem;font-family:\'DM Mono\',monospace;color:var(--accent);letter-spacing:.08em;border:1px solid rgba(201,168,76,.35);padding:1px 7px;">DRAFT</span>' : '')
        + '</div>'
        + '<div class="acf-meta">' + escHtml(c.city || '') + ' &middot; ' + escHtml(c.dates || '')
        + ' &middot; <span class="status-pill status-' + escHtml(c.status || 'soon') + '">' + escHtml(c.status || 'soon') + '</span>'
        + ' &middot; ' + comCount + ' committee' + (comCount !== 1 ? 's' : '')
        + (c.rating ? ' &middot; &#9733; ' + c.rating : '')
        + '</div>'
        + '</div>'
        + '<div class="acf-actions">';

      if (isDraft) {
        html += '<button class="acf-btn" onclick="publishConf(' + c.id + ')">Publish</button>';
      }
      html += '<button class="acf-btn" onclick="editConf(' + c.id + ')">Edit</button>'
        + '<button class="acf-btn danger" onclick="deleteConf(' + c.id + ')">Delete</button>'
        + '</div></div>';
    }
    html += '</div>';
  }
  document.getElementById('admin-body').innerHTML = html;
}

function publishConf(id) {
  if (!confirm('Publish this conference? It will become publicly visible.')) return;
  if (SB_CONFIGURED) {
    sbFetch('conferences?id=eq.' + id, {
      method: 'PATCH',
      body:   JSON.stringify({ status: 'soon' })
    }).then(function () {
      for (var i = 0; i < CONFS.length; i++) {
        if (String(CONFS[i].id) === String(id)) { CONFS[i].status = 'soon'; break; }
      }
      renderCards(CONFS);
      renderAdminConferences();
    }).catch(function () { alert('Failed to publish. Please try again.'); });
  }
}

function deleteConf(id) {
  if (!confirm('Delete this conference? This cannot be undone.')) return;
  CONFS = CONFS.filter(function (c) { return String(c.id) !== String(id); });
  if (SB_CONFIGURED) {
    sbFetch('conferences?id=eq.' + id, { method: 'DELETE' }).catch(function () {});
  }
  renderCards(CONFS);
  renderAdminConferences();
}

function editConf(id) {
  editingConfId = id;
  var c = null;
  for (var i = 0; i < CONFS.length; i++) { if (String(CONFS[i].id) === String(id)) { c = CONFS[i]; break; } }
  if (!c) return;
  addData = JSON.parse(JSON.stringify(c));
  var tabsBar = document.getElementById('admin-tabs-bar');
  tabsBar.innerHTML =
    '<button class="admin-tab active" onclick="">Editing: ' + escHtml(c.name) + '</button>'
    + '<button class="admin-tab" onclick="editingConfId=null;switchAdminTab(\'conferences\')">\u2190 Back</button>';
  renderAddStep(0, true);
}

/* ── Tab: Approvals (organizer accounts + draft conferences) ───── */
function renderAdminApprovals() {
  var body = document.getElementById('admin-body');
  body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;padding:1rem 0;"><span class="spinner"></span> Loading…</div>';

  if (!SB_CONFIGURED) {
    body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;padding:1rem;">Supabase not configured.</div>';
    return;
  }

  /* Load pending organizer accounts */
  sbFetch('profiles?role=eq.organizer&approved=eq.false&select=user_id,display_name,initials,color,bio,country')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (pendingOrgs) {
      /* Load draft conferences */
      return sbFetch('conferences?status=eq.draft&select=id,name,city,dates,owner_id')
        .then(function (r2) { return r2.ok ? r2.json() : []; })
        .then(function (draftConfs) {
          renderApprovalsPanel(pendingOrgs || [], draftConfs || []);
        });
    })
    .catch(function () {
      body.innerHTML = '<div style="color:var(--red);font-size:.83rem;padding:1rem;">Failed to load approvals.</div>';
    });
}

function renderApprovalsPanel(orgs, confs) {
  var html = '';

  /* Organizer approvals */
  html += '<div class="sec-title">Pending organizer accounts</div>';
  if (orgs.length === 0) {
    html += '<div style="color:var(--muted);font-size:.82rem;margin-bottom:1.5rem;">No pending organizers.</div>';
  } else {
    html += '<div class="admin-conf-list" style="margin-bottom:1.5rem;">';
    for (var i = 0; i < orgs.length; i++) {
      var o = orgs[i];
      var name = o.display_name || o.user_id;
      html += '<div class="admin-conf-item">'
        + '<div><div class="acf-name">' + escHtml(name) + '</div>'
        + '<div class="acf-meta">Organizer &middot; Pending approval</div></div>'
        + '<div class="acf-actions">'
        + '<button class="acf-btn" onclick="approveOrganizer(\'' + escHtml(o.user_id) + '\')">Approve</button>'
        + '<button class="acf-btn danger" onclick="rejectOrganizer(\'' + escHtml(o.user_id) + '\')">Reject</button>'
        + '</div></div>';
    }
    html += '</div>';
  }

  /* Draft conference approvals */
  html += '<div class="sec-title">Draft conferences awaiting publication</div>';
  if (confs.length === 0) {
    html += '<div style="color:var(--muted);font-size:.82rem;">No draft conferences.</div>';
  } else {
    html += '<div class="admin-conf-list">';
    for (var i = 0; i < confs.length; i++) {
      var c = confs[i];
      html += '<div class="admin-conf-item">'
        + '<div><div class="acf-name">' + escHtml(c.name || '(unnamed)') + '</div>'
        + '<div class="acf-meta">' + escHtml(c.city || '') + ' &middot; ' + escHtml(c.dates || '') + '</div></div>'
        + '<div class="acf-actions">'
        + '<button class="acf-btn" onclick="publishConf(' + c.id + ')">Publish</button>'
        + '<button class="acf-btn danger" onclick="deleteConf(' + c.id + ')">Delete</button>'
        + '</div></div>';
    }
    html += '</div>';
  }

  document.getElementById('admin-body').innerHTML = html;
}

window.approveOrganizer = function (userId) {
  if (!SB_CONFIGURED) return;
  sbFetch('profiles?user_id=eq.' + userId, {
    method: 'PATCH',
    body:   JSON.stringify({ approved: true })
  }).then(function (r) {
    if (!r.ok) { alert('Failed to approve. Please try again.'); return; }
    renderAdminApprovals();
  }).catch(function () { alert('Network error.'); });
};

window.rejectOrganizer = function (userId) {
  if (!confirm('Reject and delete this organizer account? They will need to re-register.')) return;
  if (!SB_CONFIGURED) return;
  /* Delete the profile row — the auth.users row stays (Supabase auth).
     They can re-register but will need to apply again. */
  sbFetch('profiles?user_id=eq.' + userId, { method: 'DELETE' })
    .then(function () { renderAdminApprovals(); })
    .catch(function () { alert('Network error.'); });
};

/* ── Tab: Award Approvals ──────────────────────────────────────── */
function renderAdminAwardApprovals() {
  var body = document.getElementById('admin-body');
  body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;padding:1rem 0;"><span class="spinner"></span> Loading…</div>';

  if (!SB_CONFIGURED) {
    body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;padding:1rem;">Supabase not configured.</div>';
    return;
  }

  sbFetch('awards?status=eq.pending&select=id,conference_id,user_id,award_type,committee,created_at,profiles!awards_user_id_fkey(display_name,initials)')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (awards) {
      var html = '';
      var AWARD_LABELS = {
        best_delegate:        'Best Delegate',
        outstanding_delegate: 'Outstanding Delegate',
        verbal_commendation:  'Best Speaker',
        honorable_mention:    'Honorable Mention',
        best_position_paper:  'Best Position Paper'
      };

      if (!awards || awards.length === 0) {
        html = '<div style="color:var(--muted);font-size:.83rem;padding:1rem;">No pending award claims.</div>';
      } else {
        html = '<div class="admin-conf-list">';
        for (var i = 0; i < awards.length; i++) {
          var a    = awards[i];
          var conf = null;
          for (var j = 0; j < CONFS.length; j++) {
            if (String(CONFS[j].id) === String(a.conference_id)) { conf = CONFS[j]; break; }
          }
          var profile  = a.profiles || {};
          var userName = profile.display_name || a.user_id;
          var confName = conf ? conf.name : 'Conference #' + a.conference_id;
          var awardLabel = AWARD_LABELS[a.award_type] || a.award_type;
          html += '<div class="admin-conf-item">'
            + '<div>'
            + '<div class="acf-name">' + escHtml(userName) + ' — ' + escHtml(awardLabel) + '</div>'
            + '<div class="acf-meta">' + escHtml(confName)
            + (a.committee ? ' · ' + escHtml(a.committee) : '')
            + '</div>'
            + '</div>'
            + '<div class="acf-actions">'
            + '<button class="acf-btn" onclick="approveAward(' + a.id + ')">Approve</button>'
            + '<button class="acf-btn danger" onclick="rejectAward(' + a.id + ')">Reject</button>'
            + '</div></div>';
        }
        html += '</div>';
      }
      body.innerHTML = html;
    })
    .catch(function () {
      body.innerHTML = '<div style="color:var(--red);font-size:.83rem;padding:1rem;">Failed to load award approvals.</div>';
    });
}

window.approveAward = function (awardId) {
  if (!SB_CONFIGURED) return;
  sbFetch('awards?id=eq.' + awardId, {
    method: 'PATCH',
    body:   JSON.stringify({ status: 'approved' })
  }).then(function (r) {
    if (!r.ok) { alert('Failed to approve. Please try again.'); return; }
    renderAdminAwardApprovals();
  }).catch(function () { alert('Network error.'); });
};

window.rejectAward = function (awardId) {
  if (!confirm('Reject this award claim?')) return;
  if (!SB_CONFIGURED) return;
  sbFetch('awards?id=eq.' + awardId, {
    method: 'PATCH',
    body:   JSON.stringify({ status: 'rejected' })
  }).then(function (r) {
    if (!r.ok) { alert('Failed to reject. Please try again.'); return; }
    renderAdminAwardApprovals();
  }).catch(function () { alert('Network error.'); });
};

/* ── Tab: Reviews ──────────────────────────────────────────────── */
function renderAdminReviews() {
  var html = '';
  var hasAny = false;

  for (var i = 0; i < CONFS.length; i++) {
    var c    = CONFS[i];
    var revs = c.reviews || [];
    if (revs.length === 0) continue;
    hasAny = true;
    html += '<div class="sec-title">' + escHtml(c.name) + '</div>';
    for (var j = 0; j < revs.length; j++) {
      var r     = revs[j];
      var stars = r.stars || r.rating || 0;
      var color = (r && r.color && /^#[0-9a-fA-F]{3,6}$/.test(r.color)) ? r.color : '#888';
      html += '<div class="admin-rv-item' + (r.archived ? ' archived' : '') + '">'
        + '<div class="rv-avatar" style="background:' + escHtml(color) + ';">'
        + escHtml(r.initials || '?')
        + '</div>'
        + '<div class="arv-info">'
        + '<div class="arv-head">'
        + escHtml(r.user || r.user_name || '')
        + ' <span style="color:var(--muted);font-weight:300;">'
        + escHtml(r.role || '') + ' &mdash; ' + starsStr(stars)
        + '</span></div>'
        + '<div class="arv-sub">' + escHtml(r.date || r.created_at || '') + '</div>'
        + '<div class="arv-text">' + escHtml(r.comments || r.text || r.comment || '') + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:.4rem;">'
        + (r.archived
          ? '<button class="acf-btn" onclick="unarchiveReview(' + c.id + ',' + r.id + ')">Restore</button>'
          : '<button class="acf-btn danger" onclick="archiveReview(' + c.id + ',' + r.id + ')">Archive</button>'
        )
        + '</div></div>';
    }
  }
  if (!hasAny) {
    html = '<div style="color:var(--muted);font-size:.85rem;padding:1rem;">No reviews yet.</div>';
  }
  document.getElementById('admin-body').innerHTML = html;
}

function archiveReview(confId, revId) {
  var c = null;
  for (var i = 0; i < CONFS.length; i++) { if (String(CONFS[i].id) === String(confId)) { c = CONFS[i]; break; } }
  if (!c) return;
  for (var i = 0; i < c.reviews.length; i++) {
    if (String(c.reviews[i].id) === String(revId)) { c.reviews[i].archived = true; break; }
  }
  if (SB_CONFIGURED) {
    sbFetch('reviews?id=eq.' + revId, { method: 'PATCH', body: JSON.stringify({ archived: true }) })
      .catch(function () {});
  }
  recalcRating(c, true);
  renderCards(CONFS);
  renderAdminReviews();
}

function unarchiveReview(confId, revId) {
  var c = null;
  for (var i = 0; i < CONFS.length; i++) { if (String(CONFS[i].id) === String(confId)) { c = CONFS[i]; break; } }
  if (!c) return;
  for (var i = 0; i < c.reviews.length; i++) {
    if (String(c.reviews[i].id) === String(revId)) { c.reviews[i].archived = false; break; }
  }
  if (SB_CONFIGURED) {
    sbFetch('reviews?id=eq.' + revId, { method: 'PATCH', body: JSON.stringify({ archived: false }) })
      .catch(function () {});
  }
  recalcRating(c, true);
  renderCards(CONFS);
  renderAdminReviews();
}

/* ── Tab: Add / Edit conference (step wizard) ──────────────────── */
var STEPS = ['Basic Info', 'Committees', 'Chairs & Team', 'Fees & Deadlines', 'Review & Save'];

function renderAddStep(step, isEdit) {
  addStep = step;
  if (typeof isEdit === 'undefined') isEdit = (editingConfId !== null);

  var stepsHtml = '<div class="step-indicator">';
  for (var i = 0; i < STEPS.length; i++) {
    if (i > 0) stepsHtml += '<div class="step-line' + (i <= step ? ' done' : '') + '"></div>';
    stepsHtml += '<div style="text-align:center">'
      + '<div class="step-dot' + (i < step ? ' done' : i === step ? ' active' : '') + '">'
      + (i < step ? '&#10003;' : (i + 1))
      + '</div></div>';
  }
  stepsHtml += '</div>';

  var panelHtml = '';
  if      (step === 0) panelHtml = buildStep0();
  else if (step === 1) panelHtml = buildStep1();
  else if (step === 2) panelHtml = buildStep2();
  else if (step === 3) panelHtml = buildStep3();
  else if (step === 4) panelHtml = buildStep4();

  document.getElementById('admin-body').innerHTML = stepsHtml + panelHtml;
  attachDynHandlers();

  var footer = '';
  if (step > 0) footer += '<button class="btn-s" onclick="renderAddStep(' + (step - 1) + ',' + isEdit + ')">Back</button>';
  if (step < 4) footer += '<button class="btn-p" onclick="nextStep(' + isEdit + ')">Next</button>';
  else          footer += '<button class="btn-p" onclick="saveConference(' + isEdit + ')">'
    + (isEdit ? 'Save Changes' : 'Save as Draft')
    + '</button>';
  document.getElementById('admin-footer').innerHTML = footer;
}

function buildStep0() {
  var d = addData;
  return '<div class="field-row">'
    + '<div class="field-group"><label class="field-label">Conference Name *</label>'
    + '<input class="field-input" id="f-name" value="' + escHtml(d.name || '') + '" placeholder="e.g. TashMUN"/></div>'
    + '<div class="field-group"><label class="field-label">Edition</label>'
    + '<input class="field-input" id="f-edition" value="' + escHtml(d.edition || '') + '" placeholder="e.g. V Session"/></div>'
    + '</div>'
    + '<div class="field-row">'
    + '<div class="field-group"><label class="field-label">City *</label>'
    + '<input class="field-input" id="f-city" value="' + escHtml(d.city || '') + '" placeholder="Tashkent"/></div>'
    + '<div class="field-group"><label class="field-label">Country</label>'
    + '<input class="field-input" id="f-country" value="' + escHtml(d.country || 'Uzbekistan') + '"/></div>'
    + '</div>'
    + '<div class="field-row">'
    + '<div class="field-group"><label class="field-label">Dates *</label>'
    + '<input class="field-input" id="f-dates" value="' + escHtml(d.dates || '') + '" placeholder="April 4\u20136, 2026"/></div>'
    + '<div class="field-group"><label class="field-label">Status</label>'
    + '<select class="field-select" id="f-status">'
    + '<option value="soon"'   + ((!d.status || d.status === 'soon')    ? ' selected' : '') + '>Coming Soon</option>'
    + '<option value="open"'   + (d.status === 'open'                   ? ' selected' : '') + '>Registration Open</option>'
    + '<option value="closed"' + (d.status === 'closed'                 ? ' selected' : '') + '>Closed</option>'
    + '</select></div>'
    + '</div>'
    + '<div class="field-row">'
    + '<div class="field-group"><label class="field-label">Delegates (range)</label>'
    + '<input class="field-input" id="f-delegates" value="' + escHtml(d.delegates || '') + '" placeholder="150\u2013200"/></div>'
    + '<div class="field-group"><label class="field-label">Language</label>'
    + '<input class="field-input" id="f-language" value="' + escHtml(d.language || 'English') + '"/></div>'
    + '</div>'
    + '<div class="field-group"><label class="field-label">Website</label>'
    + '<input class="field-input" id="f-website" value="' + escHtml(d.website || '') + '" placeholder="tashmun.uz"/></div>'
    + '<div class="field-group"><label class="field-label">Photos (one URL per line)</label>'
    + '<textarea class="field-textarea" id="f-photos" placeholder="https://example.com/photo1.jpg">'
    + escHtml((d.photos || []).join('\n'))
    + '</textarea></div>';
}

function buildStep1() {
  var comms = addData.committees || [];
  var html  = '<div id="committees-list">';
  for (var i = 0; i < comms.length; i++) html += commRow(i, comms[i]);
  html += '</div><button class="add-row-btn" onclick="addCommRow()">+ Add Committee</button>';
  return html;
}

function commRow(i, cm) {
  cm = cm || {};
  return '<div class="dyn-row" style="grid-template-columns:90px 1fr 110px;" id="comm-row-' + i + '">'
    + '<input class="field-input comm-abbr"  placeholder="UNSC"             value="' + escHtml(cm.abbr  || '') + '"/>'
    + '<input class="field-input comm-topic" placeholder="Committee topic"   value="' + escHtml(cm.topic || '') + '"/>'
    + '<select class="field-select comm-level">'
    + '<option value="beg"' + (cm.level === 'beg' ? ' selected' : '') + '>Beginner</option>'
    + '<option value="int"' + (cm.level === 'int' ? ' selected' : '') + '>Intermediate</option>'
    + '<option value="adv"' + (cm.level === 'adv' ? ' selected' : '') + '>Advanced</option>'
    + '</select>'
    + '<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    + '</div>';
}

function addCommRow() {
  var list = document.getElementById('committees-list');
  var div  = document.createElement('div');
  div.innerHTML = commRow(list.children.length, {});
  list.appendChild(div.firstChild);
}

function buildStep2() {
  var chairs = addData.chairs     || [];
  var sec    = addData.secretariat || [];
  var html   = '<div class="sec-title">Chairs</div><div id="chairs-list">';
  for (var i = 0; i < chairs.length; i++) html += chairRow(i, chairs[i]);
  html += '</div><button class="add-row-btn" onclick="addChairRow()">+ Add Chair</button>';
  html += '<div class="sec-title" style="margin-top:1.5rem;">Secretariat / Organizers</div><div id="sec-list">';
  for (var i = 0; i < sec.length; i++) html += secRow(i, sec[i]);
  html += '</div><button class="add-row-btn" onclick="addSecRow()">+ Add Organizer</button>';
  return html;
}

function chairRow(i, ch) {
  ch = ch || {};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr 1fr;" id="chair-row-' + i + '">'
    + '<input class="field-input ch-name" placeholder="Full Name"                    value="' + escHtml(ch.name || '') + '"/>'
    + '<input class="field-input ch-role" placeholder="Role (e.g. Chair \u2014 UNSC)" value="' + escHtml(ch.role || '') + '"/>'
    + '<input class="field-input ch-uni"  placeholder="University"                   value="' + escHtml(ch.uni  || ch.university || '') + '"/>'
    + '<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    + '</div>';
}

function addChairRow() {
  var l = document.getElementById('chairs-list');
  var d = document.createElement('div');
  d.innerHTML = chairRow(l.children.length, {});
  l.appendChild(d.firstChild);
}

function secRow(i, o) {
  o = o || {};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr 1fr;" id="sec-row-' + i + '">'
    + '<input class="field-input sec-role"    placeholder="Role"           value="' + escHtml(o.role    || '') + '"/>'
    + '<input class="field-input sec-name"    placeholder="Name"           value="' + escHtml(o.name    || '') + '"/>'
    + '<input class="field-input sec-contact" placeholder="Email / contact" value="' + escHtml(o.contact || o.email || '') + '"/>'
    + '<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    + '</div>';
}

function addSecRow() {
  var l = document.getElementById('sec-list');
  var d = document.createElement('div');
  d.innerHTML = secRow(l.children.length, {});
  l.appendChild(d.firstChild);
}

function buildStep3() {
  var fees = addData.fees      || [];
  var dls  = addData.deadlines || [];
  var html = '<div class="sec-title">Registration Fees</div><div id="fees-list">';
  for (var i = 0; i < fees.length; i++) html += feeRow(i, fees[i]);
  html += '</div><button class="add-row-btn" onclick="addFeeRow()">+ Add Fee Tier</button>';
  html += '<div class="sec-title" style="margin-top:1.5rem;">Important Deadlines</div><div id="dl-list">';
  for (var i = 0; i < dls.length; i++) html += dlRow(i, dls[i]);
  html += '</div><button class="add-row-btn" onclick="addDlRow()">+ Add Deadline</button>';
  return html;
}

function feeRow(i, f) {
  f = f || {};
  return '<div class="dyn-row" style="grid-template-columns:90px 1fr 1fr;" id="fee-row-' + i + '">'
    + '<input class="field-input fee-amount" placeholder="$30"              value="' + escHtml(f.amount || '') + '"/>'
    + '<input class="field-input fee-type"   placeholder="Single Delegate"  value="' + escHtml(f.type   || '') + '"/>'
    + '<input class="field-input fee-note"   placeholder="Note (optional)"  value="' + escHtml(f.note   || '') + '"/>'
    + '<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    + '</div>';
}

function addFeeRow() {
  var l = document.getElementById('fees-list');
  var d = document.createElement('div');
  d.innerHTML = feeRow(l.children.length, {});
  l.appendChild(d.firstChild);
}

function dlRow(i, d) {
  d = d || {};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr auto;" id="dl-row-' + i + '">'
    + '<input class="field-input dl-label" placeholder="e.g. Position Papers" value="' + escHtml(d.label || '') + '"/>'
    + '<input class="field-input dl-date"  placeholder="Mar 27, 2026"          value="' + escHtml(d.date  || '') + '"/>'
    + '<label style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:var(--muted);">'
    + '<input type="checkbox" class="dl-passed" ' + (d.passed ? 'checked' : '') + '/> Passed</label>'
    + '<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    + '</div>';
}

function addDlRow() {
  var l = document.getElementById('dl-list');
  var d = document.createElement('div');
  d.innerHTML = dlRow(l.children.length, {});
  l.appendChild(d.firstChild);
}

function buildStep4() {
  var d = addData;
  return '<div style="font-size:.85rem;line-height:1.9;color:var(--muted);">'
    + '<div style="margin-bottom:1.2rem;"><span style="color:var(--text);font-weight:500;">'
    + (d.name || '(unnamed)') + '</span> &mdash; ' + escHtml(d.edition || '')
    + ' &mdash; ' + escHtml(d.city || '') + ', ' + escHtml(d.country || '') + '</div>'
    + '<div><strong style="color:var(--text);">Dates:</strong> '      + escHtml(d.dates     || '\u2014') + '</div>'
    + '<div><strong style="color:var(--text);">Status:</strong> '     + escHtml(d.status    || '\u2014') + '</div>'
    + '<div><strong style="color:var(--text);">Delegates:</strong> '  + escHtml(d.delegates || '\u2014') + '</div>'
    + '<div><strong style="color:var(--text);">Language:</strong> '   + escHtml(d.language  || '\u2014') + '</div>'
    + '<div><strong style="color:var(--text);">Website:</strong> '    + escHtml(d.website   || '\u2014') + '</div>'
    + '<div><strong style="color:var(--text);">Committees:</strong> ' + (d.committees  || []).length + '</div>'
    + '<div><strong style="color:var(--text);">Chairs:</strong> '     + (d.chairs      || []).length + '</div>'
    + '<div><strong style="color:var(--text);">Fee tiers:</strong> '  + (d.fees        || []).length + '</div>'
    + '<div><strong style="color:var(--text);">Deadlines:</strong> '  + (d.deadlines   || []).length + '</div>'
    + '<div><strong style="color:var(--text);">Photos:</strong> '     + (d.photos      || []).length + '</div>'
    + '</div>';
}

function collectCurrentStep() {
  if (addStep === 0) {
    addData.name      = document.getElementById('f-name').value.trim();
    addData.edition   = document.getElementById('f-edition').value.trim();
    addData.city      = document.getElementById('f-city').value.trim();
    addData.country   = document.getElementById('f-country').value.trim();
    addData.dates     = document.getElementById('f-dates').value.trim();
    addData.status    = document.getElementById('f-status').value;
    addData.delegates = document.getElementById('f-delegates').value.trim();
    addData.language  = document.getElementById('f-language').value.trim();
    addData.website   = document.getElementById('f-website').value.trim();
    /* Photos: split by newline, strip empty lines, validate URLs */
    var rawPhotos = document.getElementById('f-photos').value;
    addData.photos = rawPhotos.split('\n')
      .map(function (u) { return u.trim(); })
      .filter(function (u) { return u.length > 0 && /^https?:\/\//i.test(u); });
    if (!addData.name || !addData.city || !addData.dates) {
      alert('Name, City and Dates are required.');
      return false;
    }
  }
  if (addStep === 1) {
    var comms = [];
    var rows  = document.querySelectorAll('#committees-list .dyn-row');
    for (var i = 0; i < rows.length; i++) {
      var abbr  = rows[i].querySelector('.comm-abbr').value.trim();
      var topic = rows[i].querySelector('.comm-topic').value.trim();
      var level = rows[i].querySelector('.comm-level').value;
      if (abbr && topic) comms.push({ abbr: abbr, topic: topic, level: level });
    }
    addData.committees = comms;
  }
  if (addStep === 2) {
    var chairs = [];
    var crows  = document.querySelectorAll('#chairs-list .dyn-row');
    for (var i = 0; i < crows.length; i++) {
      var name = crows[i].querySelector('.ch-name').value.trim();
      var role = crows[i].querySelector('.ch-role').value.trim();
      var uni  = crows[i].querySelector('.ch-uni').value.trim();
      if (name) chairs.push({
        name: name, role: role, uni: uni,
        initials: name.split(' ').filter(Boolean).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase()
      });
    }
    addData.chairs = chairs;
    var sec   = [];
    var srows = document.querySelectorAll('#sec-list .dyn-row');
    for (var i = 0; i < srows.length; i++) {
      var role    = srows[i].querySelector('.sec-role').value.trim();
      var name    = srows[i].querySelector('.sec-name').value.trim();
      var contact = srows[i].querySelector('.sec-contact').value.trim();
      if (name) sec.push({ role: role, name: name, contact: contact });
    }
    addData.secretariat = sec;
  }
  if (addStep === 3) {
    var fees  = [];
    var frows = document.querySelectorAll('#fees-list .dyn-row');
    for (var i = 0; i < frows.length; i++) {
      var amount = frows[i].querySelector('.fee-amount').value.trim();
      var type   = frows[i].querySelector('.fee-type').value.trim();
      var note   = frows[i].querySelector('.fee-note').value.trim();
      if (amount && type) fees.push({ amount: amount, type: type, note: note });
    }
    addData.fees = fees;
    var dls   = [];
    var drows = document.querySelectorAll('#dl-list .dyn-row');
    for (var i = 0; i < drows.length; i++) {
      var label  = drows[i].querySelector('.dl-label').value.trim();
      var date   = drows[i].querySelector('.dl-date').value.trim();
      var passed = drows[i].querySelector('.dl-passed').checked;
      if (label && date) dls.push({ label: label, date: date, passed: passed });
    }
    addData.deadlines = dls;
  }
  return true;
}

function nextStep(isEdit) {
  if (!collectCurrentStep()) return;
  renderAddStep(addStep + 1, isEdit);
}

function saveConference(isEdit) {
  if (!collectCurrentStep()) return;

  if (isEdit && editingConfId !== null) {
    /* Update existing */
    for (var i = 0; i < CONFS.length; i++) {
      if (String(CONFS[i].id) === String(editingConfId)) {
        CONFS[i] = Object.assign(CONFS[i], addData);
        break;
      }
    }
    if (SB_CONFIGURED) {
      sbFetch('conferences?id=eq.' + editingConfId, {
        method: 'PATCH',
        body:   JSON.stringify({
          name: addData.name, edition: addData.edition, city: addData.city,
          country: addData.country, dates: addData.dates, status: addData.status,
          delegates: addData.delegates, language: addData.language,
          website: addData.website, photos: addData.photos || [],
          committees: addData.committees, chairs: addData.chairs,
          fees: addData.fees, deadlines: addData.deadlines,
          secretariat: addData.secretariat
        })
      }).catch(function () {});
    }
    editingConfId = null;
    addData       = {};
    renderCards(CONFS);
    var tabsBar = document.getElementById('admin-tabs-bar');
    tabsBar.innerHTML =
      '<button class="admin-tab active" id="atab-conferences" onclick="switchAdminTab(\'conferences\')">Conferences</button>'
      + '<button class="admin-tab" id="atab-reviews"   onclick="switchAdminTab(\'reviews\')">Reviews</button>'
      + '<button class="admin-tab" id="atab-approvals" onclick="switchAdminTab(\'approvals\')">Approvals</button>'
      + '<button class="admin-tab" id="atab-add"       onclick="switchAdminTab(\'add\')">+ Add Conference</button>';
    switchAdminTab('conferences');
    alert('Conference updated.');
  } else {
    /* New conference — always saved as draft first */
    addData.status       = 'draft';
    addData.rating       = null;
    addData.rating_count = 0;
    addData.reviews      = [];

    var st = window.__authState || {};

    if (SB_CONFIGURED) {
      sbFetch('conferences', {
        method: 'POST',
        body:   JSON.stringify({
          name: addData.name, edition: addData.edition, city: addData.city,
          country: addData.country, dates: addData.dates, status: 'draft',
          delegates: addData.delegates, language: addData.language,
          website: addData.website, photos: addData.photos || [],
          committees: addData.committees, chairs: addData.chairs,
          fees: addData.fees, deadlines: addData.deadlines,
          secretariat: addData.secretariat, rating_count: 0,
          owner_id: (st.user ? st.user.id : null)
        })
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (rows && rows[0]) {
          addData.id = rows[0].id;
          /* Auto-insert into conference_organizers so owner can manage it */
          if (st.user) {
            sbFetch('conference_organizers', {
              method: 'POST',
              body:   JSON.stringify({ conference_id: addData.id, user_id: st.user.id, role: 'owner' })
            }).catch(function () {});
          }
        }
        if (st.role === 'organizer') {
          /* Restore profile panel if wizard ran inside it */
          if (typeof window.__restoreProfileFromWizard === 'function') {
            window.__restoreProfileFromWizard();
          } else {
            addData = {};
            if (typeof window.openProfile === 'function') window.openProfile();
          }
          alert('Conference saved as draft. An admin will review and publish it.');
        } else {
          CONFS.push(addData);
          addData = {};
          renderCards(CONFS);
          updateStats();
          switchAdminTab('conferences');
          alert('Saved as draft. Use the Approvals tab to publish.');
        }
      })
      .catch(function () { alert('Save failed. Please try again.'); });
    } else {
      addData.id = Date.now();
      CONFS.push(addData);
      addData = {};
      renderCards(CONFS);
      updateStats();
      switchAdminTab('conferences');
      alert('Saved as draft (local only — Supabase not configured).');
    }
  }
}

function attachDynHandlers() { /* placeholder for future dynamic event delegation */ }

/* ── Global keyboard shortcut ──────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModalBtn();
    closeAdmin();
  }
});

/* ── Boot ──────────────────────────────────────────────────────── */
loadConferences();
