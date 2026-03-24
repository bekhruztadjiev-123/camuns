/* MUN Central Asia — profile.js
   Phase 3.

   Provides two profile views that open in a slide-in panel:
   - Delegate:  attended conferences, reviews written, awards, committees, countries
   - Organizer: conferences managed, aggregate stats, co-organizer management

   Public API:
     openProfile()          — open the current user's own profile
     openProfile(userId)    — open another user's profile (read-only, approved awards only)

   The panel reuses the existing admin-overlay + admin-modal DOM.
   It does not interfere with the admin panel — openProfile() is only
   called when role !== 'admin'.

   All data is fetched fresh from Supabase on each open.
   Sensitive data (pending awards of other users) is hidden by RLS server-side.
*/

/* ── Profile panel open/close ──────────────────────────────────── */
var __profileOverlayOpen = false;
var __profileUserId      = null; /* null = own profile */

window.openProfile = function (userId) {
  var st = window.__authState || {};
  if (!st.user) {
    /* Not logged in — prompt login */
    if (typeof window.openAuth === 'function') window.openAuth('delegate');
    return;
  }

  __profileUserId     = userId || st.user.id;
  var isOwnProfile    = (__profileUserId === st.user.id);
  var profileRole     = st.role || 'delegate';

  /* Render shell immediately, then populate async */
  __openProfileOverlay();
  __renderProfileLoading();
  __fetchAndRenderProfile(__profileUserId, isOwnProfile, profileRole);
};

function __openProfileOverlay() {
  var ov = document.getElementById('profile-overlay');
  if (!ov) {
    /* Create the overlay if it doesn't exist yet */
    ov = document.createElement('div');
    ov.id = 'profile-overlay';
    ov.className = 'admin-overlay';
    ov.onclick = function (e) {
      if (e.target === ov) closeProfile();
    };
    ov.innerHTML =
      '<div class="admin-modal" id="profile-modal" style="max-width:680px;">'
      + '<div class="admin-header">'
      + '<div class="admin-title" id="profile-title">Profile</div>'
      + '<button class="modal-close" onclick="closeProfile()">&#10005;</button>'
      + '</div>'
      + '<div class="admin-tabs" id="profile-tabs-bar" style="display:none;"></div>'
      + '<div class="admin-body" id="profile-body"></div>'
      + '<div class="admin-footer" id="profile-footer"></div>'
      + '</div>';
    document.body.appendChild(ov);
  }
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  __profileOverlayOpen = true;
}

window.closeProfile = function () {
  var ov = document.getElementById('profile-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
  __profileOverlayOpen = false;
};

function __setProfileTitle(t) {
  var el = document.getElementById('profile-title');
  if (el) el.textContent = t;
}

function __setProfileBody(html) {
  var el = document.getElementById('profile-body');
  if (el) el.innerHTML = html;
}

function __setProfileFooter(html) {
  var el = document.getElementById('profile-footer');
  if (el) el.innerHTML = html;
}

function __setProfileTabs(html) {
  var el = document.getElementById('profile-tabs-bar');
  if (!el) return;
  if (html) { el.style.display = 'flex'; el.innerHTML = html; }
  else      { el.style.display = 'none'; el.innerHTML = ''; }
}

function __renderProfileLoading() {
  __setProfileTitle('Profile');
  __setProfileTabs(null);
  __setProfileBody('<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem;"><span class="spinner"></span> Loading…</div>');
  __setProfileFooter('');
}

/* ── Data fetching ─────────────────────────────────────────────── */
function __fetchAndRenderProfile(userId, isOwnProfile, role) {
  if (!SB_CONFIGURED) {
    __renderProfileOffline(isOwnProfile, role);
    return;
  }

  /* Fetch profile row */
  var profilePromise = window.__sbClient
    .from('profiles')
    .select('user_id,role,display_name,initials,color,approved,bio,country,avatar_url')
    .eq('user_id', userId)
    .maybeSingle()
    .then(function (r) { return r ? r.data || r : null; });

  /* Fetch attendance records */
  var attendancePromise = window.__sbClient
    .from('conference_attendance')
    .select('conference_id,status,created_at')
    .eq('user_id', userId)
    .then(function (r) { return (r && r.data) ? r.data : []; });

  /* Fetch awards — RLS ensures only approved ones visible for other users */
  var awardsPromise = window.__sbClient
    .from('awards')
    .select('conference_id,award_type,status,created_at')
    .eq('user_id', userId)
    .then(function (r) { return (r && r.data) ? r.data : []; });

  /* Fetch reviews written by this user */
  var reviewsPromise = window.__sbClient
    .from('reviews')
    .select('conference_id,rating,comments,created_at,role')
    .eq('user_id', userId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .then(function (r) { return (r && r.data) ? r.data : []; });

  Promise.all([profilePromise, attendancePromise, awardsPromise, reviewsPromise])
    .then(function (results) {
      var profile    = results[0];
      var attendance = results[1];
      var awards     = results[2];
      var reviews    = results[3];

      if (!profile) {
        __setProfileBody('<div style="padding:2rem;color:var(--muted);font-size:.85rem;">Profile not found.</div>');
        return;
      }

      var actualRole = profile.role || role;

      if (actualRole === 'organizer') {
        __fetchAndRenderOrganizerProfile(profile, isOwnProfile);
      } else {
        __renderDelegateProfile(profile, attendance, awards, reviews, isOwnProfile);
      }
    })
    .catch(function () {
      __setProfileBody('<div style="padding:2rem;color:var(--red);font-size:.85rem;">Failed to load profile. Please try again.</div>');
    });
}

/* ── Offline fallback ──────────────────────────────────────────── */
function __renderProfileOffline(isOwnProfile, role) {
  var st      = window.__authState || {};
  var profile = st.profile || {};
  __renderDelegateProfile(profile, [], [], [], isOwnProfile);
}

/* ══════════════════════════════════════════════════════════════════
   DELEGATE PROFILE
   ══════════════════════════════════════════════════════════════════ */
var __profileTab = 'overview';

function __renderDelegateProfile(profile, attendance, awards, reviews, isOwnProfile) {
  var name     = profile.display_name || 'Delegate';
  var initials = profile.initials || __makeInitials(name);
  var color    = (profile.color && /^#[0-9a-fA-F]{3,6}$/.test(profile.color)) ? profile.color : pal(name);

  var verified = attendance.filter(function (a) { return a.status === 'verified'; });
  var pending  = attendance.filter(function (a) { return a.status === 'pending'; });
  var approved = awards.filter(function (a) { return a.status === 'approved'; });
  var myPend   = awards.filter(function (a) { return a.status === 'pending' && isOwnProfile; });

  /* Countries from CONFS local cache */
  var countries = __countriesFromConfs(verified.map(function (a) { return a.conference_id; }));

  __setProfileTitle(isOwnProfile ? 'My Profile' : name);

  /* Tab bar */
  var tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'history',   label: 'Conferences (' + verified.length + ')' },
    { key: 'awards',    label: 'Awards (' + approved.length + ')' },
    { key: 'reviews',   label: 'Reviews (' + reviews.length + ')' }
  ];
  if (isOwnProfile) tabs.push({ key: 'settings', label: 'Settings' });

  var tabsHtml = '';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    tabsHtml += '<button class="admin-tab' + (__profileTab === t.key ? ' active' : '') + '"'
      + ' onclick="__switchProfileTab(\'' + t.key + '\',' + JSON.stringify({ profile: profile, attendance: attendance, awards: awards, reviews: reviews, isOwnProfile: isOwnProfile, verified: verified, pending: pending, approved: approved, countries: countries }).split('"').join('&quot;') + ')">'
      + escHtml(t.label) + '</button>';
  }
  /* Avoid passing huge objects through inline onclick — use a global store instead */
  window.__profileData = { profile: profile, attendance: attendance, awards: awards, reviews: reviews, isOwnProfile: isOwnProfile, verified: verified, pending: pending, approved: approved, myPend: myPend, countries: countries };

  tabsHtml = '';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    tabsHtml += '<button class="admin-tab' + (__profileTab === t.key ? ' active' : '') + '"'
      + ' onclick="__switchProfileTab(\'' + t.key + '\')">'
      + escHtml(t.label) + '</button>';
  }
  __setProfileTabs(tabsHtml);

  /* Footer */
  var footerHtml = '';
  if (isOwnProfile) {
    footerHtml = '<button class="btn-s" onclick="authSignOut()">Sign out</button>';
    footerHtml += '<button class="btn-p" onclick="__claimAwardModal()">Claim Award</button>';
  }
  footerHtml += '<button class="btn-s" onclick="closeProfile()">Close</button>';
  __setProfileFooter(footerHtml);

  __switchProfileTab(__profileTab);
}

window.__switchProfileTab = function (tab) {
  __profileTab = tab;
  var d = window.__profileData || {};

  /* Update active tab button */
  var btns = document.querySelectorAll('#profile-tabs-bar .admin-tab');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent.trim().startsWith(
      tab === 'overview' ? 'Overview'
      : tab === 'history'  ? 'Conferences'
      : tab === 'awards'   ? 'Awards'
      : tab === 'reviews'  ? 'Reviews'
      : 'Settings'
    ));
  }

  if      (tab === 'overview')  __renderDelegateOverview(d);
  else if (tab === 'history')   __renderDelegateHistory(d);
  else if (tab === 'awards')    __renderDelegateAwards(d);
  else if (tab === 'reviews')   __renderDelegateReviews(d);
  else if (tab === 'settings')  __renderDelegateSettings(d);
};

/* Overview tab */
function __renderDelegateOverview(d) {
  var profile    = d.profile   || {};
  var verified   = d.verified  || [];
  var approved   = d.approved  || [];
  var reviews    = d.reviews   || [];
  var countries  = d.countries || [];
  var name       = profile.display_name || 'Delegate';
  var initials   = profile.initials || __makeInitials(name);
  var color      = (profile.color && /^#[0-9a-fA-F]{3,6}$/.test(profile.color)) ? profile.color : pal(name);

  /* Committees from CONFS local cache */
  var committees = __committeesFromAttendance(verified.map(function (a) { return a.conference_id; }));

  var html =
    /* Avatar + name block */
    '<div style="display:flex;align-items:center;gap:1.2rem;margin-bottom:1.8rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border);">'
    + '<div style="width:64px;height:64px;border-radius:50%;background:' + escHtml(color) + ';display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:700;color:#fff;flex-shrink:0;">'
    + escHtml(initials) + '</div>'
    + '<div>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:700;">' + escHtml(name) + '</div>'
    + '<div style="font-size:.75rem;color:var(--muted);margin-top:2px;">'
    + (profile.country ? escHtml(profile.country) + ' &middot; ' : '')
    + 'Delegate'
    + '</div>'
    + (profile.bio ? '<div style="font-size:.8rem;color:var(--muted);margin-top:.4rem;line-height:1.5;">' + escHtml(profile.bio) + '</div>' : '')
    + '</div>'
    + '</div>'

    /* Stats row */
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border:1px solid var(--border);margin-bottom:1.5rem;">'
    + __statBlock(String(verified.length),  'Conferences attended')
    + __statBlock(String(approved.length),  'Awards')
    + __statBlock(String(reviews.length),   'Reviews written')
    + __statBlock(String(countries.length), 'Countries')
    + '</div>'

    /* Countries visited */
    + (countries.length > 0
      ? '<div class="sec-title">Countries</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.5rem;">'
        + countries.map(function (c) {
            return '<span style="font-size:.75rem;padding:4px 12px;border:1px solid var(--border);color:var(--muted);border-radius:2px;">' + escHtml(c) + '</span>';
          }).join('')
        + '</div>'
      : '')

    /* Committees */
    + (committees.length > 0
      ? '<div class="sec-title">Committees participated in</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:.5rem;">'
        + committees.map(function (c) {
            return '<span class="tag tag-hl">' + escHtml(c) + '</span>';
          }).join('')
        + '</div>'
      : '');

  __setProfileBody(html);
}

/* Conference history tab */
function __renderDelegateHistory(d) {
  var attendance = d.attendance || [];
  var isOwn      = d.isOwnProfile;

  if (attendance.length === 0) {
    __setProfileBody(
      '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem;">'
      + (isOwn
        ? 'No conferences recorded yet. <br><br>'
          + '<button class="btn-p" onclick="__selfReportAttendance()">Report Attendance</button>'
        : 'No conference history recorded.')
      + '</div>'
    );
    return;
  }

  var html = '';

  /* Group by status */
  var groups = { verified: [], pending: [], rejected: [] };
  for (var i = 0; i < attendance.length; i++) {
    var a = attendance[i];
    var s = a.status || 'pending';
    if (groups[s]) groups[s].push(a);
  }

  var order = [
    { key: 'verified', label: 'Verified attendance' },
    { key: 'pending',  label: 'Pending verification' },
    { key: 'rejected', label: 'Rejected' }
  ];

  for (var g = 0; g < order.length; g++) {
    var group = groups[order[g].key];
    if (!group || group.length === 0) continue;
    html += '<div class="sec-title">' + order[g].label + ' (' + group.length + ')</div>';
    html += '<div class="admin-conf-list" style="margin-bottom:1.2rem;">';
    for (var i = 0; i < group.length; i++) {
      var a    = group[i];
      var conf = __confById(a.conference_id);
      var name = conf ? escHtml(conf.name) : 'Conference #' + escHtml(String(a.conference_id));
      var meta = conf ? escHtml(conf.city || '') + ' &middot; ' + escHtml(conf.dates || '') : '';
      var statusColor = a.status === 'verified' ? 'var(--green)' : a.status === 'rejected' ? 'var(--red)' : 'var(--accent)';
      html += '<div class="admin-conf-item">'
        + '<div><div class="acf-name">' + name + '</div>'
        + '<div class="acf-meta">' + meta + '</div></div>'
        + '<div style="font-family:\'DM Mono\',monospace;font-size:.65rem;color:' + statusColor + ';letter-spacing:.06em;text-transform:uppercase;">'
        + escHtml(a.status) + '</div>'
        + '</div>';
    }
    html += '</div>';
  }

  if (isOwn) {
    html += '<button class="add-row-btn" onclick="__selfReportAttendance()">+ Report attendance at a conference</button>';
  }

  __setProfileBody(html);
}

/* Awards tab */
function __renderDelegateAwards(d) {
  var awards   = d.awards   || [];
  var approved = d.approved || [];
  var myPend   = d.myPend   || [];
  var isOwn    = d.isOwnProfile;

  /* Labels for award types */
  var AWARD_LABELS = {
    best_delegate:       'Best Delegate',
    outstanding_delegate:'Outstanding Delegate',
    verbal_commendation: 'Verbal Commendation',
    honorable_mention:   'Honorable Mention',
    best_position_paper: 'Best Position Paper'
  };

  var html = '';

  if (approved.length === 0 && myPend.length === 0) {
    html = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem;">'
      + (isOwn ? 'No awards yet. Claim an award you received using the button below.' : 'No approved awards.')
      + '</div>';
    __setProfileBody(html);
    return;
  }

  if (approved.length > 0) {
    html += '<div class="sec-title">Approved awards</div><div class="admin-conf-list" style="margin-bottom:1.2rem;">';
    for (var i = 0; i < approved.length; i++) {
      var a    = approved[i];
      var conf = __confById(a.conference_id);
      html += '<div class="admin-conf-item">'
        + '<div>'
        + '<div class="acf-name">' + escHtml(AWARD_LABELS[a.award_type] || a.award_type) + '</div>'
        + '<div class="acf-meta">'
        + (conf ? escHtml(conf.name) + ' &middot; ' + escHtml(conf.city || '') + ' &middot; ' + escHtml(conf.dates || '') : 'Conference #' + escHtml(String(a.conference_id)))
        + (a.committee ? ' &middot; ' + escHtml(a.committee) : '')
        + '</div>'
        + '</div>'
        + '<div style="font-size:1.2rem;">&#127942;</div>'
        + '</div>';
    }
    html += '</div>';
  }

  if (isOwn && myPend.length > 0) {
    html += '<div class="sec-title">Pending approval (' + myPend.length + ')</div>'
      + '<div style="color:var(--muted);font-size:.78rem;margin-bottom:.8rem;">These will appear publicly once an organizer or admin approves them.</div>'
      + '<div class="admin-conf-list">';
    for (var i = 0; i < myPend.length; i++) {
      var a    = myPend[i];
      var conf = __confById(a.conference_id);
      html += '<div class="admin-conf-item" style="opacity:.6;">'
        + '<div>'
        + '<div class="acf-name">' + escHtml(AWARD_LABELS[a.award_type] || a.award_type) + '</div>'
        + '<div class="acf-meta">'
        + (conf ? escHtml(conf.name) : 'Conference #' + escHtml(String(a.conference_id)))
        + ' &middot; Awaiting approval'
        + '</div></div>'
        + '</div>';
    }
    html += '</div>';
  }

  __setProfileBody(html);
}

/* Reviews tab */
function __renderDelegateReviews(d) {
  var reviews = d.reviews || [];

  if (reviews.length === 0) {
    __setProfileBody('<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem;">No reviews written yet.</div>');
    return;
  }

  var html = '<div class="review-list" style="border:1px solid var(--border);">';
  for (var i = 0; i < reviews.length; i++) {
    var r    = reviews[i];
    var conf = __confById(r.conference_id);
    var date = r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : '';
    html += '<div class="review-item">'
      + '<div class="review-header">'
      + '<div style="flex:1;">'
      + '<div style="font-size:.82rem;font-weight:500;">'
      + (conf ? escHtml(conf.name) : 'Conference #' + escHtml(String(r.conference_id)))
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted);">' + escHtml(r.role || '') + '</div>'
      + '</div>'
      + '<div class="rv-stars">' + starsStr(r.rating || 0) + '</div>'
      + '</div>'
      + '<div class="rv-text">' + escHtml(r.comments || '') + '</div>'
      + '<div class="rv-date">' + escHtml(date) + '</div>'
      + '</div>';
  }
  html += '</div>';
  __setProfileBody(html);
}

/* Settings tab (own profile only) */
function __renderDelegateSettings(d) {
  var profile = d.profile || {};

  var html =
    '<div class="field-group">'
    + '<label class="field-label">Display Name</label>'
    + '<input class="field-input" id="ps-name" value="' + escHtml(profile.display_name || '') + '" placeholder="Your name"/>'
    + '</div>'
    + '<div class="field-group">'
    + '<label class="field-label">Country</label>'
    + '<input class="field-input" id="ps-country" value="' + escHtml(profile.country || '') + '" placeholder="e.g. Uzbekistan"/>'
    + '</div>'
    + '<div class="field-group">'
    + '<label class="field-label">Short bio</label>'
    + '<textarea class="field-textarea" id="ps-bio" placeholder="A sentence about yourself…" maxlength="200">'
    + escHtml(profile.bio || '')
    + '</textarea>'
    + '</div>'
    + '<div class="field-group">'
    + '<label class="field-label">Avatar URL <span style="color:var(--muted);font-weight:300;">(optional)</span></label>'
    + '<input class="field-input" id="ps-avatar" value="' + escHtml(profile.avatar_url || '') + '" placeholder="https://…"/>'
    + '</div>'
    + '<div class="admin-error" id="ps-error" style="margin-top:.5rem;"></div>'
    + '<div class="admin-success" id="ps-success" style="margin-top:.5rem;"></div>';

  __setProfileBody(html);
  __setProfileFooter(
    '<button class="btn-s" onclick="authSignOut()">Sign out</button>'
    + '<button class="btn-s" onclick="closeProfile()">Cancel</button>'
    + '<button class="btn-p" onclick="__saveProfileSettings()">Save</button>'
  );
}

window.__saveProfileSettings = function () {
  var st = window.__authState || {};
  if (!st.user) return;

  var nameEl   = document.getElementById('ps-name');
  var countryEl= document.getElementById('ps-country');
  var bioEl    = document.getElementById('ps-bio');
  var avatarEl = document.getElementById('ps-avatar');
  var errEl    = document.getElementById('ps-error');
  var okEl     = document.getElementById('ps-success');
  if (!nameEl) return;

  var name    = nameEl.value.trim();
  var country = countryEl ? countryEl.value.trim() : '';
  var bio     = bioEl     ? bioEl.value.trim()     : '';
  var avatar  = avatarEl  ? avatarEl.value.trim()  : '';

  /* Validate avatar URL if provided */
  if (avatar && !/^https?:\/\//i.test(avatar)) {
    if (errEl) { errEl.textContent = 'Avatar URL must start with https://'; errEl.classList.add('visible'); }
    return;
  }

  /* Build initials from name */
  var initials = name.split(' ').filter(Boolean).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();

  var payload = {
    display_name: name  || null,
    initials:     initials || null,
    country:      country || null,
    bio:          bio     || null,
    avatar_url:   (avatar && /^https?:\/\//i.test(avatar)) ? avatar : null
  };

  if (!SB_CONFIGURED) {
    /* Update local state only */
    if (st.profile) Object.assign(st.profile, payload);
    if (okEl) { okEl.textContent = 'Saved (local only).'; okEl.classList.add('visible'); }
    return;
  }

  window.__sbClient
    .from('profiles')
    .update(payload)
    .eq('user_id', st.user.id)
    .then(function (res) {
      if (res && res.error) {
        if (errEl) { errEl.textContent = 'Save failed: ' + res.error.message; errEl.classList.add('visible'); }
        return;
      }
      /* Update local auth state */
      if (st.profile) Object.assign(st.profile, payload);
      if (okEl) { okEl.textContent = 'Profile saved.'; okEl.classList.add('visible'); }
      if (errEl) errEl.classList.remove('visible');
    })
    .catch(function () {
      if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.classList.add('visible'); }
    });
};

/* ── Self-report attendance ────────────────────────────────────── */
window.__selfReportAttendance = function () {
  var st = window.__authState || {};
  if (!st.user) return;

  /* Build a list of conferences the delegate hasn't yet reported */
  var existing = (window.__profileData && window.__profileData.attendance || [])
    .map(function (a) { return String(a.conference_id); });

  var available = CONFS.filter(function (c) {
    return c.status !== 'draft' && existing.indexOf(String(c.id)) === -1;
  });

  var bodyEl = document.getElementById('profile-body');
  if (!bodyEl) return;

  var html = '<div class="field-group">'
    + '<label class="field-label">Select a conference you attended</label>'
    + '<select class="field-select" id="report-conf-select">';

  if (available.length === 0) {
    html += '<option value="">All listed conferences already reported</option>';
  } else {
    html += '<option value="">— Choose —</option>';
    for (var i = 0; i < available.length; i++) {
      var c = available[i];
      html += '<option value="' + escHtml(String(c.id)) + '">'
        + escHtml(c.name) + ' — ' + escHtml(c.dates || '')
        + '</option>';
    }
  }
  html += '</select></div>'
    + '<div class="admin-error" id="report-error" style="margin-top:.5rem;"></div>';

  bodyEl.innerHTML = html;

  __setProfileFooter(
    '<button class="btn-s" onclick="__switchProfileTab(\'history\')">Back</button>'
    + '<button class="btn-p" onclick="__submitAttendanceReport()" '
    + (available.length === 0 ? 'disabled' : '') + '>Submit</button>'
  );
};

window.__submitAttendanceReport = function () {
  var st     = window.__authState || {};
  var selEl  = document.getElementById('report-conf-select');
  var errEl  = document.getElementById('report-error');
  if (!selEl || !st.user) return;

  var confId = selEl.value;
  if (!confId) {
    if (errEl) { errEl.textContent = 'Please select a conference.'; errEl.classList.add('visible'); }
    return;
  }

  if (!SB_CONFIGURED) {
    alert('Supabase not configured — cannot save attendance.');
    return;
  }

  window.__sbClient
    .from('conference_attendance')
    .insert({ conference_id: Number(confId), user_id: st.user.id, status: 'pending' })
    .then(function (res) {
      if (res && res.error) {
        if (errEl) { errEl.textContent = res.error.message || 'Failed to submit.'; errEl.classList.add('visible'); }
        return;
      }
      /* Refresh profile */
      window.openProfile();
    })
    .catch(function () {
      if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.classList.add('visible'); }
    });
};

/* ── Claim award modal (inside profile panel) ──────────────────── */
var AWARD_TYPES = [
  { key: 'best_delegate',        label: 'Best Delegate' },
  { key: 'outstanding_delegate', label: 'Outstanding Delegate' },
  { key: 'verbal_commendation',  label: 'Verbal Commendation' },
  { key: 'honorable_mention',    label: 'Honorable Mention' },
  { key: 'best_position_paper',  label: 'Best Position Paper' }
];

window.__claimAwardModal = function () {
  var st = window.__authState || {};
  if (!st.user) return;

  /* Only show conferences the delegate has verified attendance at */
  var verified = (window.__profileData && window.__profileData.verified || []);
  var verifiedIds = verified.map(function (a) { return String(a.conference_id); });
  var confOptions = CONFS.filter(function (c) {
    return verifiedIds.indexOf(String(c.id)) !== -1;
  });

  var html = '<div class="field-group">'
    + '<label class="field-label">Conference</label>'
    + '<select class="field-select" id="claim-conf">';

  if (confOptions.length === 0) {
    html += '<option value="">No verified conferences yet — report attendance first</option>';
  } else {
    html += '<option value="">— Choose —</option>';
    for (var i = 0; i < confOptions.length; i++) {
      var c = confOptions[i];
      html += '<option value="' + escHtml(String(c.id)) + '">' + escHtml(c.name) + '</option>';
    }
  }
  html += '</select></div>'
    + '<div class="field-group">'
    + '<label class="field-label">Award type</label>'
    + '<select class="field-select" id="claim-type">';

  for (var i = 0; i < AWARD_TYPES.length; i++) {
    html += '<option value="' + AWARD_TYPES[i].key + '">' + escHtml(AWARD_TYPES[i].label) + '</option>';
  }
  html += '</select></div>'
    + '<div class="field-group">'
    + '<label class="field-label">Committee <span style="color:var(--muted);font-weight:300;">(optional)</span></label>'
    + '<input class="field-input" id="claim-committee" placeholder="e.g. UNSC, UNEP, GA1" maxlength="80"/>'
    + '</div>'
    + '<p style="font-size:.76rem;color:var(--muted);line-height:1.6;margin-top:.5rem;">'
    + 'The organizer or admin of that conference will be notified to approve your claim.'
    + '</p>'
    + '<div class="admin-error" id="claim-error" style="margin-top:.5rem;"></div>';

  document.getElementById('profile-body').innerHTML = html;

  __setProfileFooter(
    '<button class="btn-s" onclick="__switchProfileTab(\'awards\')">Back</button>'
    + '<button class="btn-p" onclick="__submitAwardClaim()" '
    + (confOptions.length === 0 ? 'disabled' : '') + '>Submit claim</button>'
  );
};

window.__submitAwardClaim = function () {
  var st     = window.__authState || {};
  var confEl = document.getElementById('claim-conf');
  var typeEl  = document.getElementById('claim-type');
  var commEl  = document.getElementById('claim-committee');
  var errEl   = document.getElementById('claim-error');
  if (!confEl || !typeEl || !st.user) return;

  var confId    = confEl.value;
  var awardType = typeEl.value;
  var committee = commEl ? commEl.value.trim() : '';

  if (!confId) {
    if (errEl) { errEl.textContent = 'Please select a conference.'; errEl.classList.add('visible'); }
    return;
  }

  if (!SB_CONFIGURED) {
    alert('Supabase not configured — cannot save award claim.');
    return;
  }

  window.__sbClient
    .from('awards')
    .insert({
      conference_id: Number(confId),
      user_id:       st.user.id,
      award_type:    awardType,
      committee:     committee || null,
      granted_by:    st.user.id,
      status:        'pending'
    })
    .then(function (res) {
      if (res && res.error) {
        var msg = res.error.message || 'Failed to submit.';
        /* Unique constraint = duplicate claim */
        if (msg.indexOf('unique') !== -1 || msg.indexOf('duplicate') !== -1) {
          msg = 'You already claimed this award for this conference.';
        }
        if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
        return;
      }
      /* Refresh profile */
      __profileTab = 'awards';
      window.openProfile();
    })
    .catch(function () {
      if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.classList.add('visible'); }
    });
};

/* ══════════════════════════════════════════════════════════════════
   ORGANIZER PROFILE
   ══════════════════════════════════════════════════════════════════ */
function __fetchAndRenderOrganizerProfile(profile, isOwnProfile) {
  var userId = profile.user_id;

  /* Load conferences this organizer owns or co-manages */
  window.__sbClient
    .from('conference_organizers')
    .select('conference_id,role')
    .eq('user_id', userId)
    .then(function (r) {
      var links = (r && r.data) ? r.data : [];
      var confIds = links.map(function (l) { return l.conference_id; });

      /* Also include conferences where owner_id = userId (set on creation) */
      return window.__sbClient
        .from('conferences')
        .select('id,name,city,dates,status,rating,rating_count,delegates,owner_id')
        .or('owner_id.eq.' + userId + (confIds.length ? ',id.in.(' + confIds.join(',') + ')' : ''))
        .then(function (r2) {
          var confs = (r2 && r2.data) ? r2.data : [];
          __renderOrganizerProfile(profile, confs, links, isOwnProfile);
        });
    })
    .catch(function () {
      __renderOrganizerProfile(profile, [], [], isOwnProfile);
    });
}

var __orgTab = 'overview';

function __renderOrganizerProfile(profile, confs, links, isOwnProfile) {
  var name     = profile.display_name || 'Organizer';
  var initials = profile.initials || __makeInitials(name);
  var color    = (profile.color && /^#[0-9a-fA-F]{3,6}$/.test(profile.color)) ? profile.color : pal(name);

  window.__orgProfileData = { profile: profile, confs: confs, links: links, isOwnProfile: isOwnProfile };

  __setProfileTitle(isOwnProfile ? 'My Profile' : name);

  var tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'myconfs',   label: 'My Conferences (' + confs.length + ')' }
  ];
  if (isOwnProfile) tabs.push({ key: 'settings', label: 'Settings' });

  var tabsHtml = '';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    tabsHtml += '<button class="admin-tab' + (__orgTab === t.key ? ' active' : '') + '"'
      + ' onclick="__switchOrgTab(\'' + t.key + '\')">'
      + escHtml(t.label) + '</button>';
  }
  __setProfileTabs(tabsHtml);

  var footerHtml = '';
  if (isOwnProfile) {
    footerHtml = '<button class="btn-s" onclick="authSignOut()">Sign out</button>';
    if (profile.approved) {
      footerHtml += '<button class="btn-p" onclick="__openOrgConferenceForm()">+ New Conference</button>';
    }
  }
  footerHtml += '<button class="btn-s" onclick="closeProfile()">Close</button>';
  __setProfileFooter(footerHtml);

  __switchOrgTab(__orgTab);
}

window.__switchOrgTab = function (tab) {
  __orgTab = tab;
  var d    = window.__orgProfileData || {};

  var btns = document.querySelectorAll('#profile-tabs-bar .admin-tab');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].textContent.trim().startsWith(
      tab === 'overview' ? 'Overview'
      : tab === 'myconfs'  ? 'My Conferences'
      : 'Settings'
    ));
  }

  if      (tab === 'overview') __renderOrgOverview(d);
  else if (tab === 'myconfs')  __renderOrgConfs(d);
  else if (tab === 'settings') __renderDelegateSettings(d); /* reuse same settings form */
};

function __renderOrgOverview(d) {
  var profile = d.profile || {};
  var confs   = d.confs   || [];
  var name    = profile.display_name || 'Organizer';
  var initials= profile.initials || __makeInitials(name);
  var color   = (profile.color && /^#[0-9a-fA-F]{3,6}$/.test(profile.color)) ? profile.color : pal(name);

  /* Aggregate stats */
  var totalDelegates = 0;
  var totalRatings   = 0;
  var ratingCount    = 0;
  for (var i = 0; i < confs.length; i++) {
    var c = confs[i];
    var parts = c.delegates ? String(c.delegates).split(/[–\-]/g) : [];
    var n = parts.length > 0 ? parseInt(parts[parts.length - 1], 10) : 0;
    if (!isNaN(n)) totalDelegates += n;
    if (c.rating && c.rating_count) {
      totalRatings += (c.rating * c.rating_count);
      ratingCount  += c.rating_count;
    }
  }
  var avgRating = ratingCount > 0 ? Math.round((totalRatings / ratingCount) * 10) / 10 : null;

  var pendingApproval = !profile.approved;

  var html =
    '<div style="display:flex;align-items:center;gap:1.2rem;margin-bottom:1.8rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border);">'
    + '<div style="width:64px;height:64px;border-radius:50%;background:' + escHtml(color) + ';display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',serif;font-size:1.4rem;font-weight:700;color:#fff;flex-shrink:0;">'
    + escHtml(initials) + '</div>'
    + '<div>'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:1.2rem;font-weight:700;">' + escHtml(name) + '</div>'
    + '<div style="font-size:.75rem;color:var(--muted);margin-top:2px;">'
    + (profile.country ? escHtml(profile.country) + ' &middot; ' : '')
    + 'Organizer'
    + (pendingApproval ? ' &middot; <span style="color:var(--accent);">Pending approval</span>' : '')
    + '</div>'
    + (profile.bio ? '<div style="font-size:.8rem;color:var(--muted);margin-top:.4rem;line-height:1.5;">' + escHtml(profile.bio) + '</div>' : '')
    + '</div>'
    + '</div>';

  if (pendingApproval) {
    html += '<div style="background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.25);padding:1rem 1.2rem;font-size:.82rem;line-height:1.7;margin-bottom:1.2rem;">'
      + '<strong style="display:block;color:var(--accent);margin-bottom:.3rem;">Account pending approval</strong>'
      + 'An admin will review your organizer account shortly. Once approved, you can create and manage conferences.'
      + '</div>';
  }

  html +=
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);margin-bottom:1.5rem;">'
    + __statBlock(String(confs.length), 'Conferences')
    + __statBlock(totalDelegates > 0 ? totalDelegates + '+' : '—', 'Total delegates')
    + __statBlock(avgRating ? String(avgRating) + ' ★' : '—', 'Avg rating')
    + '</div>';

  __setProfileBody(html);
}

function __renderOrgConfs(d) {
  var confs      = d.confs       || [];
  var isOwn      = d.isOwnProfile;
  var links      = d.links       || [];

  if (confs.length === 0) {
    __setProfileBody(
      '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem;">'
      + (isOwn ? 'No conferences yet. Use the button below to create one.' : 'No conferences managed.')
      + '</div>'
    );
    return;
  }

  var html = '<div class="admin-conf-list">';
  for (var i = 0; i < confs.length; i++) {
    var c        = confs[i];
    var myLink   = links.filter(function (l) { return String(l.conference_id) === String(c.id); })[0];
    var myRole   = myLink ? myLink.role : (String(c.owner_id) === String(d.profile.user_id) ? 'owner' : 'co-organizer');
    var isDraft  = c.status === 'draft';

    html += '<div class="admin-conf-item"'
      + (isDraft ? ' style="opacity:.7;"' : '') + '>'
      + '<div>'
      + '<div class="acf-name">' + escHtml(c.name || '')
      + (isDraft ? ' <span style="font-size:.6rem;font-family:\'DM Mono\',monospace;color:var(--accent);border:1px solid rgba(201,168,76,.3);padding:1px 6px;">DRAFT</span>' : '')
      + '</div>'
      + '<div class="acf-meta">'
      + escHtml(c.city || '') + ' &middot; ' + escHtml(c.dates || '')
      + ' &middot; <span style="color:var(--muted);">' + escHtml(myRole) + '</span>'
      + (c.rating ? ' &middot; &#9733; ' + c.rating : '')
      + '</div>'
      + '</div>'
      + (isOwn
        ? '<div class="acf-actions">'
          + '<button class="acf-btn" onclick="__openOrgEditConf(' + c.id + ')">Edit</button>'
          + (myRole === 'owner' ? '<button class="acf-btn" onclick="__openCoOrgPanel(' + c.id + ')">Co-organizers</button>' : '')
          + '</div>'
        : '')
      + '</div>';
  }
  html += '</div>';

  if (isOwn) {
    html += '<button class="add-row-btn" style="margin-top:.8rem;" onclick="__openOrgConferenceForm()">+ Create new conference</button>';
  }

  __setProfileBody(html);
}

/* ── Organizer: new/edit conference (draft only) ───────────────── */
window.__openOrgConferenceForm = function () {
  var st = window.__authState || {};
  if (!st.user || st.role !== 'organizer' || !st.approved) return;

  /* Reuse admin.js step wizard but force status = draft */
  window.addData = { status: 'draft', owner_id: st.user.id };
  window.editingConfId = null;

  /* Switch to admin tab UI temporarily inside profile panel */
  __setProfileTabs(null);
  __setProfileTitle('New Conference');

  /* Delegate to admin.js renderAddStep */
  if (typeof window.renderAddStep === 'function') {
    /* Redirect body output to profile-body by temporarily swapping admin-body */
    var adminBody = document.getElementById('admin-body');
    var adminFoot = document.getElementById('admin-footer');
    var profBody  = document.getElementById('profile-body');
    var profFoot  = document.getElementById('profile-footer');

    /* Save originals and swap */
    adminBody.id = 'admin-body-hidden';
    adminFoot.id = 'admin-footer-hidden';
    profBody.id  = 'admin-body';
    profFoot.id  = 'admin-footer';

    window.renderAddStep(0, false);

    /* Add a back button that restores IDs and reopens profile */
    var footEl = document.getElementById('admin-footer');
    var existingBack = footEl.innerHTML;
    footEl.innerHTML = '<button class="btn-s" onclick="__restoreProfileFromWizard()">Cancel</button>'
      + existingBack;
  }
};

window.__restoreProfileFromWizard = function () {
  /* Restore swapped IDs */
  var hiddenBody = document.getElementById('admin-body-hidden');
  var hiddenFoot = document.getElementById('admin-footer-hidden');
  var profBody   = document.getElementById('admin-body');
  var profFoot   = document.getElementById('admin-footer');
  if (hiddenBody) hiddenBody.id = 'admin-body';
  if (hiddenFoot) hiddenFoot.id = 'admin-footer';
  if (profBody)   profBody.id   = 'profile-body';
  if (profFoot)   profFoot.id   = 'profile-footer';
  __orgTab = 'myconfs';
  window.openProfile();
};

window.__openOrgEditConf = function (confId) {
  /* Open the admin overlay directly and call the shared edit wizard.
     The organizer has access via conference_organizers, not admin role. */
  var st = window.__authState || {};
  if (!st.user || st.role !== 'organizer') return;
  closeProfile();

  /* Open admin overlay directly (bypass role check — organizer is allowed to edit own confs) */
  var ov = document.getElementById('admin-overlay');
  if (ov) { ov.classList.add('open'); document.body.style.overflow = 'hidden'; }

  /* Set up minimal tabs for organizer editing context */
  var tabsBar = document.getElementById('admin-tabs-bar');
  if (tabsBar) tabsBar.style.display = 'none';
  document.getElementById('admin-title').textContent = 'Edit Conference';
  document.getElementById('admin-footer').innerHTML =
    '<button class="btn-s" onclick="closeAdmin()">Cancel</button>';

  setTimeout(function () {
    if (typeof window.editConf === 'function') window.editConf(confId);
  }, 100);
};

/* ── Co-organizer management ───────────────────────────────────── */
window.__openCoOrgPanel = function (confId) {
  var st = window.__authState || {};
  if (!st.user) return;

  var conf = __confById(confId);
  __setProfileTitle('Co-organizers — ' + (conf ? conf.name : ''));
  __setProfileTabs(null);

  var body = document.getElementById('profile-body');
  if (body) body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;"><span class="spinner"></span> Loading…</div>';

  if (!SB_CONFIGURED) {
    if (body) body.innerHTML = '<div style="color:var(--muted);font-size:.83rem;">Supabase not configured.</div>';
    return;
  }

  window.__sbClient
    .from('conference_organizers')
    .select('user_id,role,profiles(display_name,initials,color)')
    .eq('conference_id', confId)
    .then(function (r) {
      var members = (r && r.data) ? r.data : [];
      __renderCoOrgPanel(confId, members);
    })
    .catch(function () {
      if (body) body.innerHTML = '<div style="color:var(--red);font-size:.83rem;">Failed to load.</div>';
    });
};

function __renderCoOrgPanel(confId, members) {
  var html = '<div class="admin-conf-list" style="margin-bottom:1rem;">';

  if (members.length === 0) {
    html += '<div style="color:var(--muted);font-size:.82rem;padding:.8rem 0;">No co-organizers yet.</div>';
  } else {
    for (var i = 0; i < members.length; i++) {
      var m    = members[i];
      var p    = m.profiles || {};
      var name = p.display_name || m.user_id;
      html += '<div class="admin-conf-item">'
        + '<div><div class="acf-name">' + escHtml(name) + '</div>'
        + '<div class="acf-meta">' + escHtml(m.role) + '</div></div>'
        + (m.role !== 'owner'
          ? '<button class="acf-btn danger" onclick="__removeCoOrg(' + confId + ',\'' + escHtml(m.user_id) + '\')">Remove</button>'
          : '<span style="font-size:.68rem;color:var(--muted);">Owner</span>')
        + '</div>';
    }
  }
  html += '</div>'
    + '<div class="field-group">'
    + '<label class="field-label">Invite by email</label>'
    + '<input class="field-input" id="corg-email" type="email" placeholder="colleague@example.com"/>'
    + '</div>'
    + '<div class="admin-error" id="corg-error" style="margin-top:.4rem;"></div>';

  document.getElementById('profile-body').innerHTML = html;

  __setProfileFooter(
    '<button class="btn-s" onclick="__switchOrgTab(\'myconfs\')">Back</button>'
    + '<button class="btn-p" onclick="__inviteCoOrg(' + confId + ')">Send Invite</button>'
  );
}

window.__inviteCoOrg = function (confId) {
  var emailEl = document.getElementById('corg-email');
  var errEl   = document.getElementById('corg-error');
  if (!emailEl) return;

  var email = emailEl.value.trim().toLowerCase();
  if (!email || email.indexOf('@') < 1) {
    if (errEl) { errEl.textContent = 'Please enter a valid email.'; errEl.classList.add('visible'); }
    return;
  }

  if (!SB_CONFIGURED) {
    alert('Supabase not configured.');
    return;
  }

  /* Look up the profile by email via auth.users (requires service role in production).
     With anon key we can only search profiles by user_id.
     Workaround: ask user to provide the other organizer's user ID, OR
     use a display_name search as a best-effort lookup. */
  window.__sbClient
    .from('profiles')
    .select('user_id,role,display_name')
    .ilike('display_name', email.split('@')[0] + '%')
    .limit(5)
    .then(function (r) {
      var matches = (r && r.data) ? r.data : [];
      /* Filter to organizer role only */
      var orgs = matches.filter(function (p) { return p.role === 'organizer'; });
      if (orgs.length === 0) {
        if (errEl) {
          errEl.textContent = 'No organizer account found matching that email prefix. Ask them to share their display name.';
          errEl.classList.add('visible');
        }
        return;
      }
      /* If exactly one match, invite them */
      if (orgs.length === 1) {
        __doInviteCoOrg(confId, orgs[0].user_id, errEl);
      } else {
        /* Show disambiguation if multiple */
        if (errEl) {
          errEl.textContent = 'Multiple accounts found. Please use a more specific display name.';
          errEl.classList.add('visible');
        }
      }
    })
    .catch(function () {
      if (errEl) { errEl.textContent = 'Lookup failed. Please try again.'; errEl.classList.add('visible'); }
    });
};

function __doInviteCoOrg(confId, userId, errEl) {
  var st = window.__authState || {};
  window.__sbClient
    .from('conference_organizers')
    .insert({ conference_id: confId, user_id: userId, role: 'co-organizer' })
    .then(function (res) {
      if (res && res.error) {
        var msg = res.error.message || 'Failed to invite.';
        if (msg.indexOf('unique') !== -1) msg = 'This organizer is already on this conference.';
        if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
        return;
      }
      __openCoOrgPanel(confId);
    })
    .catch(function () {
      if (errEl) { errEl.textContent = 'Network error.'; errEl.classList.add('visible'); }
    });
}

window.__removeCoOrg = function (confId, userId) {
  if (!confirm('Remove this co-organizer?')) return;
  window.__sbClient
    .from('conference_organizers')
    .delete()
    .eq('conference_id', confId)
    .eq('user_id', userId)
    .then(function () { __openCoOrgPanel(confId); })
    .catch(function () { alert('Failed to remove.'); });
};

/* ══════════════════════════════════════════════════════════════════
   SMALL HELPERS
   ══════════════════════════════════════════════════════════════════ */
function __statBlock(value, label) {
  return '<div style="background:var(--surface2);padding:1rem 1.2rem;">'
    + '<div style="font-family:\'Playfair Display\',serif;font-size:1.5rem;font-weight:700;color:var(--accent);line-height:1;">' + escHtml(value) + '</div>'
    + '<div style="font-size:.62rem;letter-spacing:.1em;color:var(--muted);text-transform:uppercase;margin-top:4px;">' + escHtml(label) + '</div>'
    + '</div>';
}

function __makeInitials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .map(function (w) { return w[0]; })
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function __confById(id) {
  for (var i = 0; i < CONFS.length; i++) {
    if (String(CONFS[i].id) === String(id)) return CONFS[i];
  }
  return null;
}

function __countriesFromConfs(confIds) {
  var seen = {};
  var list = [];
  for (var i = 0; i < confIds.length; i++) {
    var c = __confById(confIds[i]);
    if (c && c.country && !seen[c.country]) {
      seen[c.country] = true;
      list.push(c.country);
    }
  }
  return list;
}

function __committeesFromAttendance(confIds) {
  /* Committees are stored per conference — collect all distinct abbrs */
  var seen = {};
  var list = [];
  for (var i = 0; i < confIds.length; i++) {
    var c = __confById(confIds[i]);
    if (!c || !c.committees) continue;
    for (var j = 0; j < c.committees.length; j++) {
      var abbr = c.committees[j].abbr;
      if (abbr && !seen[abbr]) { seen[abbr] = true; list.push(abbr); }
    }
  }
  return list;
}

/* ── Wire profile button in header (called from index.html) ─────── */
window.authSubscribe(function (st) {
  var btn = document.getElementById('header-profile-btn');
  if (!btn) return;

  if (!st.user || st.status !== 'ready') {
    btn.textContent = 'Sign in';
    btn.onclick     = function () { window.openAuth('delegate'); };
    return;
  }

  var profile  = st.profile || {};
  var initials = profile.initials || __makeInitials(profile.display_name || '?');
  btn.textContent = initials;
  btn.onclick = function () {
    if (st.role === 'admin') {
      window.openAdmin();
    } else {
      window.openProfile();
    }
  };
});
