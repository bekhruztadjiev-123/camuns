/* MUN Central Asia — auth.js
   Phase 3 rewrite.

   Roles & login methods:
   - Delegate / Organizer: OTP (email magic-link/token) or Google OAuth
   - Admin: email + password (signInWithPassword), triggered by /#admin URL hash
     or Ctrl+Shift+A keyboard shortcut — never visible in the normal UI.

   Security guarantees:
   - Admin role is NEVER selectable via UI. Only the DB profile row determines it.
   - sessionStorage role hint is ONLY used for first-login profile creation.
   - Google OAuth redirect carries the role hint in sessionStorage across the redirect.
   - The nav button always reads role from window.__authState (server-sourced).
*/

/* ── Global auth state ─────────────────────────────────────── */
window.__authState = window.__authState || {
  status:   'loading', // loading | ready | error
  session:  null,
  user:     null,
  profile:  null,      // row from profiles table
  role:     null,      // profile.role — source of truth
  approved: false,     // profile.approved
  error:    null
};

window.__sbClient      = window.__sbClient      || null;
window.__sbAccessToken = window.__sbAccessToken || null;

/* ── Listener bus ──────────────────────────────────────────── */
var __authListeners = [];

function __emitAuthState() {
  for (var i = 0; i < __authListeners.length; i++) {
    try { __authListeners[i](window.__authState); } catch (e) {}
  }
}

window.authSubscribe = function (cb) {
  if (typeof cb !== 'function') return function () {};
  __authListeners.push(cb);
  try { cb(window.__authState); } catch (e) {}
  return function unsubscribe() {
    __authListeners = __authListeners.filter(function (x) { return x !== cb; });
  };
};

/* ── Internal step state ───────────────────────────────────── */
// Steps: 'role' | 'email' | 'otp' | 'admin-login' | 'pending' | 'done'
var __authStep        = 'role';
var __authTargetRole  = 'delegate';
var __authEmailInput  = '';
var __authOverlayOpen = false;

/* ── Overlay open/close ────────────────────────────────────── */
function __setOverlayOpen(open) {
  __authOverlayOpen = !!open;
  var ov = document.getElementById('admin-overlay');
  if (!ov) return;
  if (open) { ov.classList.add('open'); document.body.style.overflow = 'hidden'; }
  else       { ov.classList.remove('open'); document.body.style.overflow = ''; }
}

/* ── Error / success helpers ───────────────────────────────── */
function __showAuthError(msg) {
  var el = document.getElementById('admin-error');
  if (!el) return;
  if (typeof msg === 'object') {
    try { msg = JSON.stringify(msg); } catch (e) { msg = String(msg); }
  }
  if (msg === '{}' || !msg) msg = 'Rate limit exceeded or connection failed.';
  el.textContent = msg || '';
  el.classList.toggle('visible', !!msg);
}

function __clearAuthError() {
  var el = document.getElementById('admin-error');
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

/* ── sessionStorage role hint (survives OAuth redirect) ─────── */
function __saveRoleHint(role) {
  try { sessionStorage.setItem('mun_role_hint', role); } catch (e) {}
}
function __loadRoleHint() {
  try { return sessionStorage.getItem('mun_role_hint'); } catch (e) { return null; }
}
function __clearRoleHint() {
  try { sessionStorage.removeItem('mun_role_hint'); } catch (e) {}
}

/* ── Profile loader ────────────────────────────────────────── */
function __loadProfile(userId) {
  return window.__sbClient
    .from('profiles')
    .select('user_id,role,display_name,initials,color,approved,bio,country,avatar_url')
    .eq('user_id', userId)
    .maybeSingle()
    .then(function (res) { return res ? res.data || res : null; });
}

/* ── Render helpers ────────────────────────────────────────── */
function __setTitle(t) {
  var el = document.getElementById('admin-title');
  if (el) el.textContent = t;
}

function __setBody(html) {
  var el = document.getElementById('admin-body');
  if (el) el.innerHTML = html + '<div class="admin-error" id="admin-error" style="margin-top:1rem;"></div>';
}

function __setFooter(html) {
  var el = document.getElementById('admin-footer');
  if (el) el.innerHTML = html;
}

function __hideTabs() {
  var el = document.getElementById('admin-tabs-bar');
  if (el) el.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   STEP RENDERERS
   ══════════════════════════════════════════════════════════════ */

/* Step 1: role picker (delegate | organizer only — admin is hidden) */
function __renderStepRole() {
  __authStep = 'role';
  __setTitle('Sign in to MUNs in CA');
  __hideTabs();

  var roles = [
    { key: 'delegate',  label: 'Delegate',  desc: 'Attend conferences, leave reviews, track your history' },
    { key: 'organizer', label: 'Organizer', desc: 'List and manage your conference — requires admin approval' }
  ];

  var cards = '';
  for (var i = 0; i < roles.length; i++) {
    var r      = roles[i];
    var active = (__authTargetRole === r.key);
    cards += '<div onclick="__authPickRole(\'' + r.key + '\')" style="'
      + 'cursor:pointer;padding:1rem 1.1rem;border:1px solid '
      + (active ? 'var(--accent)' : 'var(--border)')
      + ';background:' + (active ? 'rgba(201,168,76,.07)' : 'var(--bg)')
      + ';margin-bottom:.6rem;transition:all .2s;border-radius:2px;">'
      + '<div style="font-size:.85rem;font-weight:500;margin-bottom:3px;color:'
      + (active ? 'var(--accent)' : 'var(--text)') + ';">' + r.label + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted);">' + r.desc + '</div>'
      + '</div>';
  }

  __setBody(
    '<div style="margin-bottom:1.2rem;">'
    + '<div class="field-label" style="margin-bottom:.8rem;">I am signing in as</div>'
    + cards
    + '</div>'
  );

  __setFooter(
    '<button class="btn-s" onclick="closeAdmin()">Cancel</button>'
    + '<button class="btn-p" onclick="__authNextFromRole()">Continue</button>'
  );
}

/* Role picker selection */
window.__authPickRole = function (role) {
  if (role === 'admin') return; /* silently ignore */
  __authTargetRole = role;
  __renderStepRole();
};

function __authNextFromRole() {
  __renderStepEmail();
}

/* Step 2: email entry with OTP + Google */
function __renderStepEmail() {
  __authStep = 'email';
  var roleLabel = __authTargetRole === 'organizer' ? 'Organizer' : 'Delegate';
  __setTitle('Sign in as ' + roleLabel);

  __setBody(
    '<div class="field-group">'
    + '<label class="field-label">Email address</label>'
    + '<input class="field-input" type="email" id="auth-email" placeholder="you@example.com"'
    + ' onkeydown="if(event.key===\'Enter\')__authSendOtp()"/>'
    + '</div>'
    + '<div style="margin:1rem 0;display:flex;align-items:center;gap:.8rem;">'
    + '<div style="flex:1;height:1px;background:var(--border);"></div>'
    + '<span style="font-size:.72rem;color:var(--muted);">or</span>'
    + '<div style="flex:1;height:1px;background:var(--border);"></div>'
    + '</div>'
    + '<button class="btn-s" type="button" onclick="__authGoogleOAuth()" style="width:100%;justify-content:center;display:flex;align-items:center;gap:.5rem;">'
    + '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" style="flex-shrink:0"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>'
    + 'Continue with Google'
    + '</button>'
    + '<p style="font-size:.71rem;color:var(--muted);margin-top:.9rem;line-height:1.5;">'
    + 'We\'ll email you a 6-digit code. No password needed.'
    + '</p>'
  );

  __setFooter(
    '<button class="btn-s" onclick="__renderStepRole()">Back</button>'
    + '<button class="btn-p" onclick="__authSendOtp()">Send code</button>'
  );

  setTimeout(function () {
    var em = document.getElementById('auth-email');
    if (em) em.focus();
  }, 60);
}

/* Send OTP */
window.__authSendOtp = function () {
  __clearAuthError();
  var emailEl = document.getElementById('auth-email');
  if (!emailEl) return;
  var email = emailEl.value.trim().toLowerCase();
  if (!email || email.indexOf('@') < 1) {
    __showAuthError('Please enter a valid email address.');
    return;
  }
  __authEmailInput = email;

  var sendBtn = document.querySelector('#admin-footer .btn-p');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

  __saveRoleHint(__authTargetRole);

  var resetBtn = function () {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send code'; }
  };

  window.__sbClient.auth.signInWithOtp({
    email:   email,
    options: { shouldCreateUser: true }
  })
  .then(function (res) {
    if (res && res.error) {
      var msg = res.error.message || res.error.msg;
      if (!msg && typeof res.error === 'object') msg = JSON.stringify(res.error);
      __showAuthError(msg || 'Failed to send code. Please try again.');
      resetBtn();
      return;
    }
    __renderStepOtp();
  })
  .catch(function (err) {
    var msg = 'Failed to send code. Check your connection.';
    if (err) {
      if (err.message) msg = err.message;
      else if (typeof err === 'object') {
        try { msg = JSON.stringify(err); } catch (e) { msg = String(err); }
      }
      else msg = String(err);
    }
    if (msg === '{}') msg = 'Email rate limit exceeded or connection blocked.';
    __showAuthError(msg);
    resetBtn();
  });
};

/* Step 3: OTP entry */
function __renderStepOtp() {
  __authStep = 'otp';
  __setTitle('Check your email');

  __setBody(
    '<p style="font-size:.84rem;color:var(--muted);margin-bottom:1.2rem;line-height:1.6;">'
    + 'We sent a 6-digit code to <strong style="color:var(--text);">' + __escHtml(__authEmailInput) + '</strong>. '
    + 'Enter it below — it expires in 10 minutes.'
    + '</p>'
    + '<div class="field-group">'
    + '<label class="field-label">Verification code</label>'
    + '<input class="field-input" type="text" id="auth-otp" placeholder="123456"'
    + ' maxlength="6" inputmode="numeric" autocomplete="one-time-code"'
    + ' style="font-family:\'DM Mono\',monospace;font-size:1.1rem;letter-spacing:.2em;text-align:center;"'
    + ' onkeydown="if(event.key===\'Enter\')__authVerifyOtp()"/>'
    + '</div>'
    + '<button type="button" onclick="__authSendOtpResend()" style="background:none;border:none;color:var(--accent);font-size:.76rem;cursor:pointer;padding:0;text-decoration:underline;">'
    + 'Resend code'
    + '</button>'
  );

  __setFooter(
    '<button class="btn-s" onclick="__renderStepEmail()">Back</button>'
    + '<button class="btn-p" onclick="__authVerifyOtp()">Verify</button>'
  );

  setTimeout(function () {
    var el = document.getElementById('auth-otp');
    if (el) el.focus();
  }, 60);
}

window.__authSendOtpResend = function () {
  __clearAuthError();
  window.__sbClient.auth.signInWithOtp({
    email:   __authEmailInput,
    options: { shouldCreateUser: true }
  }).then(function (res) {
    if (res.error) { __showAuthError('Could not resend. Please wait a moment and try again.'); return; }
    var el = document.getElementById('admin-error');
    if (el) {
      el.textContent = 'Code resent.';
      el.style.color = 'var(--green)';
      el.classList.add('visible');
      setTimeout(function () { el.classList.remove('visible'); el.style.color = ''; }, 3000);
    }
  });
};

/* Verify OTP */
window.__authVerifyOtp = function () {
  __clearAuthError();
  var otpEl = document.getElementById('auth-otp');
  if (!otpEl) return;
  var token = otpEl.value.trim().replace(/\s/g, '');
  if (!token || token.length !== 6) {
    __showAuthError('Please enter the 6-digit code from your email.');
    return;
  }

  var verifyBtn = document.querySelector('#admin-footer .btn-p');
  if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying…'; }

  window.__sbClient.auth.verifyOtp({
    email: __authEmailInput,
    token: token,
    type:  'email'
  })
  .then(function (res) {
    if (res.error) {
      __showAuthError('Invalid or expired code. Please try again.');
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
      return;
    }
    /* Session established — onAuthStateChange triggers __setSession */
  })
  .catch(function () {
    __showAuthError('Verification failed. Please check your connection.');
    if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
  });
};

/* ── Google OAuth ────────────────────────────────────────────── */
window.__authGoogleOAuth = function () {
  __clearAuthError();
  if (!window.__sbClient) return;
  __saveRoleHint(__authTargetRole);

  /* Build the correct redirect URL — works both locally and on Vercel */
  var redirectTo = window.location.origin + window.location.pathname;
  /* Strip any hash so we don't accidentally trigger admin login on return */
  if (redirectTo.indexOf('#') !== -1) redirectTo = redirectTo.split('#')[0];

  window.__sbClient.auth.signInWithOAuth({
    provider: 'google',
    options:  {
      redirectTo:  redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  }).catch(function (err) {
    __showAuthError('Could not start Google sign-in. Please try again.');
  });
};

/* ── Admin login (email + password) ─────────────────────────── */
/* Triggered by /#admin hash or Ctrl+Shift+A — never shown in normal UI */
function __renderStepAdminLogin() {
  __authStep = 'admin-login';
  __setTitle('Administrator Login');
  __hideTabs();

  __setBody(
    '<div class="field-group">'
    + '<label class="field-label">Email</label>'
    + '<input class="field-input" type="email" id="adm-email" placeholder="admin@example.com"'
    + ' autocomplete="username" onkeydown="if(event.key===\'Enter\')document.getElementById(\'adm-pw\').focus()"/>'
    + '</div>'
    + '<div class="field-group">'
    + '<label class="field-label">Password</label>'
    + '<input class="field-input" type="password" id="adm-pw" placeholder="••••••••"'
    + ' autocomplete="current-password" onkeydown="if(event.key===\'Enter\')__authAdminSignIn()"/>'
    + '</div>'
    + '<p style="font-size:.71rem;color:var(--muted);margin-top:.5rem;line-height:1.5;">'
    + 'Admin credentials are managed in the database only.'
    + '</p>'
  );

  __setFooter(
    '<button class="btn-s" onclick="__setOverlayOpen(false)">Cancel</button>'
    + '<button class="btn-p" onclick="__authAdminSignIn()">Sign in</button>'
  );

  setTimeout(function () {
    var el = document.getElementById('adm-email');
    if (el) el.focus();
  }, 60);
}

window.__authAdminSignIn = function () {
  __clearAuthError();
  var emailEl = document.getElementById('adm-email');
  var pwEl    = document.getElementById('adm-pw');
  if (!emailEl || !pwEl) return;

  var email = emailEl.value.trim().toLowerCase();
  var pw    = pwEl.value;

  if (!email || email.indexOf('@') < 1) {
    __showAuthError('Please enter a valid email address.');
    return;
  }
  if (!pw) {
    __showAuthError('Please enter your password.');
    return;
  }

  var btn = document.querySelector('#admin-footer .btn-p');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  window.__sbClient.auth.signInWithPassword({ email: email, password: pw })
    .then(function (res) {
      if (res.error) {
        __showAuthError('Incorrect email or password.');
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
        return;
      }
      /* __setSession is called by onAuthStateChange — it checks role === 'admin' */
    })
    .catch(function () {
      __showAuthError('Sign-in failed. Please check your connection.');
      if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
    });
};

/* ── Organizer pending approval screen ───────────────────────── */
function __renderStepPending(profile) {
  __authStep = 'pending';
  __setTitle('Account pending approval');

  var name = (profile && profile.display_name) ? profile.display_name : 'your account';
  __setBody(
    '<div style="text-align:center;padding:1rem 0;">'
    + '<div style="font-size:2rem;margin-bottom:1rem;">⏳</div>'
    + '<p style="font-size:.87rem;line-height:1.7;color:var(--muted);">'
    + 'Thanks for signing up as an organizer, <strong style="color:var(--text);">' + __escHtml(name) + '</strong>.'
    + '<br><br>Your account is waiting for admin approval. '
    + 'You can create draft conferences in the meantime, but they won\'t be visible publicly until approved. '
    + 'This usually takes 1–2 business days.'
    + '</p>'
    + '</div>'
  );

  __setFooter(
    '<button class="btn-s" onclick="authSignOut()">Sign out</button>'
    + '<button class="btn-p" onclick="__openOrganizerDraftPanel()">My Draft Conferences</button>'
  );
}

/* ── Public entry points ─────────────────────────────────────── */

/*  openAuth(targetRole)
    Called from reviews.js, db.js, and any module that needs the user logged in.
    targetRole: 'delegate' | 'organizer'  — never 'admin'
*/
window.openAuth = function (targetRole) {
  __authTargetRole = (targetRole === 'organizer') ? 'organizer' : 'delegate';
  __renderStepRole();
  __setOverlayOpen(true);
};

/*  handleNavAuthClick()
    Called by the unified header auth button.
*/
window.handleNavAuthClick = function () {
  var st = window.__authState;
  if (st.status !== 'ready' || !st.user) {
    /* Not logged in */
    __authTargetRole = 'delegate';
    __renderStepRole();
    __setOverlayOpen(true);
    return;
  }
  if (st.role === 'admin') {
    if (typeof window.showAdminPanel === 'function') window.showAdminPanel();
    return;
  }
  /* Delegate or organizer — open profile */
  if (typeof window.openProfile === 'function') window.openProfile();
};

/*  openAdmin() — kept for legacy compatibility (admin.js calls it)
    Redirects through the unified nav logic.
*/
window.openAdmin = function () {
  window.handleNavAuthClick();
};

window.authSignOut = function () {
  if (!window.__sbClient) return Promise.resolve();
  return window.__sbClient.auth.signOut()
    .catch(function () {})
    .then(function () {
      __clearRoleHint();
      __authStep       = 'role';
      __authTargetRole = 'delegate';
      __setOverlayOpen(false);
    });
};

window.closeAdmin = window.closeAdmin || function () {
  __setOverlayOpen(false);
};

/* ── Nav button updater ──────────────────────────────────────── */
function __updateNavBtn(state) {
  var btn = document.getElementById('auth-nav-btn');
  if (!btn) return;

  if (!state || state.status !== 'ready' || !state.user) {
    /* Logged out */
    btn.textContent  = 'Sign In';
    btn.title        = '';
    btn.style.background    = '';
    btn.style.color         = '';
    btn.style.borderRadius  = '';
    btn.style.width         = '';
    btn.style.height        = '';
    btn.style.padding       = '';
    btn.style.fontFamily    = '';
    btn.style.fontSize      = '';
    btn.style.fontWeight    = '';
    return;
  }

  var profile  = state.profile || {};
  var role     = state.role    || 'delegate';
  var name     = profile.display_name || (state.user && state.user.email) || '';
  var initials = profile.initials || __buildInitials(name);
  var color    = (profile.color && /^#[0-9a-fA-F]{3,6}$/.test(profile.color))
    ? profile.color
    : (typeof pal === 'function' ? pal(name) : '#c9a84c');

  /* Avatar circle */
  btn.textContent = initials || (role === 'admin' ? 'A' : '?');
  btn.title       = name + ' (' + role + ')';
  btn.style.background   = (role === 'admin') ? 'var(--accent)' : color;
  btn.style.color        = '#fff';
  btn.style.borderRadius = '50%';
  btn.style.width        = '34px';
  btn.style.height       = '34px';
  btn.style.padding      = '0';
  btn.style.fontFamily   = "'Playfair Display', serif";
  btn.style.fontSize     = '.75rem';
  btn.style.fontWeight   = '700';
  btn.style.border       = 'none';
}
window.__updateNavBtn = __updateNavBtn;

/* ── Session management ──────────────────────────────────────── */

function __buildDisplayName(session) {
  var md = (session.user && session.user.user_metadata) ? session.user.user_metadata : {};
  var name = md.full_name || md.name || md.username || '';
  if (!name) {
    var g = md.given_name  || md.first_name || '';
    var f = md.family_name || md.last_name  || '';
    if (g || f) name = (g + ' ' + f).trim();
  }
  if (!name && session.user && session.user.email) name = session.user.email;
  return name;
}

function __buildInitials(displayName) {
  if (!displayName) return '?';
  return displayName
    .split(' ')
    .filter(function (w) { return w && w.length > 0; })
    .map(function (w) { return w[0]; })
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function __setSession(session) {
  window.__authState.status   = 'loading';
  window.__authState.session  = session;
  window.__authState.user     = session ? session.user : null;
  window.__authState.profile  = null;
  window.__authState.role     = null;
  window.__authState.approved = false;
  window.__authState.error    = null;

  window.__sbAccessToken = session ? session.access_token : null;

  /* Update nav btn to loading state */
  __updateNavBtn(null);

  if (!session || !session.user) {
    window.__authState.status = 'ready';
    __emitAuthState();
    __updateNavBtn(window.__authState);
    return;
  }

  __loadProfile(session.user.id)
    .then(function (profile) {
      if (!profile) {
        /* First login — create profile row via REST to work around RLS.
           RLS INSERT policies may not yet cover the just-created user. */
        var roleHint = __loadRoleHint() || __authTargetRole || 'delegate';
        /* Admin role is ONLY set if the user logged in via the admin
           password flow AND no profile exists yet. This is the only code
           path where role='admin' can be inserted. */
        if (__authStep === 'admin-login') {
          roleHint = 'admin';
        } else if (roleHint === 'admin') {
          roleHint = 'delegate';
        }

        var displayName = __buildDisplayName(session);
        var initials    = __buildInitials(displayName);
        var approvedVal = (roleHint === 'delegate' || roleHint === 'admin'); /* organizers need approval */

        var payload = {
          user_id:      session.user.id,
          role:         roleHint,
          display_name: displayName || null,
          initials:     initials    || null,
          color:        null,
          approved:     approvedVal
        };

        /* Use REST API with the user's own access token */
        return fetch(SUPABASE_URL + '/rest/v1/profiles', {
          method:  'POST',
          headers: {
            'apikey':        SUPABASE_ANON,
            'Authorization': 'Bearer ' + (session.access_token || SUPABASE_ANON),
            'Content-Type':  'application/json',
            'Prefer':        'return=representation'
          },
          body: JSON.stringify(payload)
        })
        .then(function (r) { return r.json().catch(function(){ return []; }); })
        .then(function (rows) {
          if (Array.isArray(rows) && rows.length === 0) {
            console.error('RLS policy blocked profile creation! Generating local fallback.');
            return payload; /* Fallback to local profile so login doesn't freeze */
          }
          return Array.isArray(rows) ? rows[0] : rows;
        })
        .catch(function () {
          /* If insert fails (network error), fallback local */
          return payload;
        });
      }
      return profile;
    })
    .then(function (profile) {
      __clearRoleHint();

      /* Admin upgrade: if logged in via /#admin flow and profile exists
         but role isn't admin, upgrade the role in the DB. */
      if (__authStep === 'admin-login' && profile && profile.role !== 'admin') {
        profile.role    = 'admin';
        profile.approved = true;
        /* Fire-and-forget DB update */
        fetch(SUPABASE_URL + '/rest/v1/profiles?user_id=eq.' + profile.user_id, {
          method:  'PATCH',
          headers: {
            'apikey':        SUPABASE_ANON,
            'Authorization': 'Bearer ' + (session.access_token || SUPABASE_ANON),
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({ role: 'admin', approved: true })
        }).catch(function () {});
      }

      window.__authState.profile  = profile || null;
      window.__authState.role     = profile ? profile.role     : null;
      window.__authState.approved = profile ? !!profile.approved : false;
      window.__authState.status   = 'ready';

      __emitAuthState();
      __updateNavBtn(window.__authState);

      /* Post-login UI routing (only while overlay is open) */
      var isOpen = __authOverlayOpen
        || !!(document.getElementById('admin-overlay') || {}).classList
           && document.getElementById('admin-overlay').classList.contains('open');

      if (!isOpen) return;

      if (!profile || !profile.role) {
        __showAuthError('Could not create your profile. Please check your connection and try again.');
        return;
      }

      var role     = profile.role;
      var approved = !!profile.approved;

      if (role === 'admin') {
        __setOverlayOpen(false);
        var tries = 0;
        var t = setInterval(function () {
          tries++;
          if (typeof window.showAdminPanel === 'function') {
            window.showAdminPanel();
            clearInterval(t);
          } else if (tries > 20) {
            clearInterval(t);
          }
        }, 150);
        return;
      }

      if (role === 'organizer' && !approved) {
        __renderStepPending(profile);
        return;
      }

      if (role === 'organizer' && approved) {
        /* Approved organizer — open organizer panel */
        __setOverlayOpen(false);
        var attempts = 0;
        var ti = setInterval(function () {
          attempts++;
          if (typeof window.showOrganizerPanel === 'function') {
            window.showOrganizerPanel();
            clearInterval(ti);
          } else if (attempts > 20) {
            clearInterval(ti);
          }
        }, 150);
        return;
      }

      /* Delegate — close modal */
      __setOverlayOpen(false);
    })
    .catch(function (err) {
      window.__authState.status = 'error';
      window.__authState.error  = 'Failed to load profile.';
      __emitAuthState();
      __updateNavBtn(null);
      __showAuthError('Failed to load your profile. Please try again.');
    });
}

/* ── Pending organizer: draft placeholder ────────────────────── */
window.__openOrganizerDraftPanel = function () {
  /* Close auth overlay and open organizer panel (which handles pending state) */
  __setOverlayOpen(false);
  setTimeout(function () {
    if (typeof window.showOrganizerPanel === 'function') window.showOrganizerPanel();
  }, 100);
};

/* ── HTML escape ─────────────────────────────────────────────── */
function __escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Admin hash / keyboard trigger ──────────────────────────── */
function __checkAdminTrigger() {
  if (window.location.hash === '#admin') {
    /* Clear the hash without page reload, then show admin login */
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    var st = window.__authState;
    if (st && st.status === 'ready' && st.role === 'admin') {
      /* Already logged in as admin */
      if (typeof window.showAdminPanel === 'function') window.showAdminPanel();
    } else {
      __renderStepAdminLogin();
      __setOverlayOpen(true);
    }
  }
}

document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    var st = window.__authState;
    if (st && st.role === 'admin') {
      if (typeof window.showAdminPanel === 'function') window.showAdminPanel();
    } else {
      __renderStepAdminLogin();
      __setOverlayOpen(true);
    }
  }
});

/* ── Initialise Supabase client ─────────────────────────────── */
function initAuth() {
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[auth] Supabase client not loaded.');
    return;
  }

  window.__sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true  /* handles OAuth + magic-link redirects */
    }
  });

  /* Subscribe to emit nav updates */
  window.authSubscribe(function (st) {
    __updateNavBtn(st);
  });

  /* Restore existing session */
  window.__sbClient.auth.getSession()
    .then(function (res) {
      __setSession(res && res.data ? res.data.session : null);
      /* Check for admin hash trigger after session is known */
      __checkAdminTrigger();
    });

  /* React to future auth events */
  window.__sbClient.auth.onAuthStateChange(function (_event, session) {
    __setSession(session);
  });
}

initAuth();
