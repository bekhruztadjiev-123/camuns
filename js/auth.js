/* MUN Central Asia — auth.js
   Phase 2 rewrite.

   What changed from the previous version:
   - Admin removed from role picker entirely (cannot be self-selected)
   - OTP two-step flow: email → 6-digit code screen
   - Google OAuth still available for delegates/organizers
   - Organizer "pending approval" gate: after login, if role=organizer
     and approved=false, a pending state is shown instead of granting access
   - Profile select now fetches approved column
   - Role is NEVER trusted from client — always read from the profiles row
   - sessionStorage role hint only used for profile creation on first login,
     never for granting access
   - Admin panel opened only if profile.role === 'admin' (set in DB, not UI)
*/

/* ── Global auth state ─────────────────────────────────────── */
window.__authState = window.__authState || {
  status:  'loading', // loading | ready | error
  session: null,
  user:    null,
  profile: null,      // row from profiles table
  role:    null,      // profile.role — source of truth
  approved: false,    // profile.approved
  error:   null
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

/* ── Internal state ────────────────────────────────────────── */
// Auth flow step: 'role' | 'email' | 'otp' | 'pending' | 'done'
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
  else      { ov.classList.remove('open'); document.body.style.overflow = ''; }
}

/* ── Error / success helpers ───────────────────────────────── */
function __showAuthError(msg) {
  var el = document.getElementById('admin-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.add('visible');
}

function __clearAuthError() {
  var el = document.getElementById('admin-error');
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

/* ── sessionStorage: only used to survive OAuth page redirect ─ */
/* Role hint is only for first-login profile creation, not for access control */
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

/* ── Step renderers ────────────────────────────────────────── */

/* Step 1: role picker (delegate | organizer only — no admin) */
function __renderStepRole() {
  __authStep = 'role';
  __setTitle('Sign in to MUNs in CA');
  __hideTabs();

  var roles = [
    { key: 'delegate',  label: 'Delegate',  desc: 'Attend conferences, leave reviews, track your history' },
    { key: 'organizer', label: 'Organizer', desc: 'List and manage your conference' }
  ];

  var cards = '';
  for (var i = 0; i < roles.length; i++) {
    var r = roles[i];
    var active = __authTargetRole === r.key;
    cards += '<div onclick="__authPickRole(\'' + r.key + '\')" style="'
      + 'cursor:pointer;padding:1rem 1.1rem;border:1px solid '
      + (active ? 'var(--accent)' : 'var(--border)')
      + ';background:' + (active ? 'rgba(201,168,76,.07)' : 'var(--bg)')
      + ';margin-bottom:.6rem;transition:all .2s;">'
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
  /* Silently ignore any attempt to select admin via UI */
  if (role === 'admin') return;
  __authTargetRole = role;
  __renderStepRole();
};

function __authNextFromRole() {
  __renderStepEmail();
}

/* Step 2: email entry */
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

  window.__sbClient.auth.signInWithOtp({
    email: email,
    options: { shouldCreateUser: true }
  })
  .then(function (res) {
    if (res.error) {
      __showAuthError(res.error.message || 'Failed to send code. Please try again.');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send code'; }
      return;
    }
    __renderStepOtp();
  })
  .catch(function () {
    __showAuthError('Failed to send code. Please check your connection.');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send code'; }
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
    email: __authEmailInput,
    options: { shouldCreateUser: true }
  }).then(function (res) {
    if (res.error) { __showAuthError('Could not resend. Please wait a moment and try again.'); return; }
    __showAuthError('');
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
    type: 'email'
  })
  .then(function (res) {
    if (res.error) {
      __showAuthError('Invalid or expired code. Please try again.');
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
      return;
    }
    /* Session established — onAuthStateChange will call __setSession */
  })
  .catch(function () {
    __showAuthError('Verification failed. Please check your connection.');
    if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
  });
};

/* Google OAuth — still available for delegates/organizers */
window.__authGoogleOAuth = function () {
  __clearAuthError();
  if (!window.__sbClient) return;
  __saveRoleHint(__authTargetRole);
  window.__sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  }).catch(function () {
    __showAuthError('Could not start Google sign-in. Please try again.');
  });
};

/* Step 4: organizer pending approval */
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
    + 'You\'ll be able to manage conferences once approved. '
    + 'This usually takes 1–2 business days.'
    + '</p>'
    + '</div>'
  );

  __setFooter(
    '<button class="btn-s" onclick="authSignOut()">Sign out</button>'
    + '<button class="btn-p" onclick="closeAdmin()">Close</button>'
  );
}

/* ── Public entry points ────────────────────────────────────── */

/*  openAuth(targetRole)
    Called from reviews.js, db.js, and any other module that needs the user logged in.
    targetRole: 'delegate' | 'organizer'  — never 'admin'
*/
window.openAuth = function (targetRole) {
  /* Silently clamp to valid client roles */
  __authTargetRole = (targetRole === 'organizer') ? 'organizer' : 'delegate';
  __renderStepRole();
  __setOverlayOpen(true);
};

/*  openAdmin()
    Called from the Admin button in the header.
    If the user is already logged in as admin, show the admin panel immediately.
    If not, show the normal login flow — after login __setSession checks role.
*/
window.openAdmin = function () {
  var st = window.__authState;
  if (st.status === 'ready' && st.role === 'admin') {
    /* Already authenticated as admin — show panel */
    if (typeof window.showAdminPanel === 'function') {
      window.showAdminPanel();
    }
    return;
  }
  /* Not logged in or not admin — show normal login */
  __authTargetRole = 'delegate'; /* default; admin role is determined by DB */
  __renderStepRole();
  __setOverlayOpen(true);
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

/* closeAdmin is called by the X button — defined in admin.js but we keep a safe fallback */
window.closeAdmin = window.closeAdmin || function () {
  __setOverlayOpen(false);
};

/* ── Session management ─────────────────────────────────────── */

function __buildDisplayName(session) {
  var md = (session.user && session.user.user_metadata) ? session.user.user_metadata : {};
  var name = md.full_name || md.name || md.username || '';
  if (!name) {
    var g = md.given_name || md.first_name || '';
    var f = md.family_name || md.last_name || '';
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

  if (!session || !session.user) {
    window.__authState.status = 'ready';
    __emitAuthState();
    return;
  }

  __loadProfile(session.user.id)
    .then(function (profile) {
      /* First login — no profile row yet → create one */
      if (!profile) {
        var roleHint = __loadRoleHint() || __authTargetRole || 'delegate';

        /* Security: never allow 'admin' as a role hint from client */
        if (roleHint === 'admin') roleHint = 'delegate';

        var displayName = __buildDisplayName(session);
        var initials    = __buildInitials(displayName);

        /* approved defaults to FALSE for organizers, TRUE for delegates (see migration) */
        var approvedVal = (roleHint === 'delegate');

        return window.__sbClient
          .from('profiles')
          .insert({
            user_id:      session.user.id,
            role:         roleHint,
            display_name: displayName || null,
            initials:     initials || null,
            color:        null,
            approved:     approvedVal
          })
          .select('user_id,role,display_name,initials,color,approved,bio,country,avatar_url')
          .maybeSingle()
          .then(function (res) { return res ? res.data || res : null; });
      }
      return profile;
    })
    .then(function (profile) {
      __clearRoleHint();

      window.__authState.profile  = profile || null;
      window.__authState.role     = profile ? profile.role     : null;
      window.__authState.approved = profile ? !!profile.approved : false;
      window.__authState.status   = 'ready';

      __emitAuthState();

      /* Post-login UI routing */
      var isOpen = __authOverlayOpen
        || (document.getElementById('admin-overlay') || {}).classList
           && document.getElementById('admin-overlay').classList.contains('open');

      if (!isOpen) return;

      if (!profile || !profile.role) {
        __showAuthError('Could not load your profile. Please sign out and try again.');
        return;
      }

      var role     = profile.role;
      var approved = !!profile.approved;

      if (role === 'admin') {
        /* Authenticated as admin — hand off to admin panel */
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
        /* Organizer awaiting approval */
        __renderStepPending(profile);
        return;
      }

      /* Delegate or approved organizer — close modal */
      __setOverlayOpen(false);
    })
    .catch(function (err) {
      window.__authState.status = 'error';
      window.__authState.error  = 'Failed to load profile.';
      __emitAuthState();
      __showAuthError('Failed to load your profile. Please try again.');
    });
}

/* ── Tiny HTML escape used inside rendered strings ─────────── */
function __escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Initialise Supabase client ─────────────────────────────── */
function initAuth() {
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[auth] Supabase client not loaded.');
    return;
  }

  window.__sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true   /* handles OAuth + magic-link redirects */
    }
  });

  /* Restore existing session (page load / refresh) */
  window.__sbClient.auth.getSession()
    .then(function (res) {
      __setSession(res && res.data ? res.data.session : null);
    });

  /* React to future auth events (OTP verify, OAuth callback, sign-out) */
  window.__sbClient.auth.onAuthStateChange(function (_event, session) {
    __setSession(session);
  });
}

initAuth();
