/* MUN Central Asia — auth.js
   Shared Supabase authentication + role selection (organizer/delegate/admin).
   This replaces Telegram auth in the reviews flow.
*/

/* Global auth state (read by other modules) */
window.__authState = window.__authState || {
  status: 'loading', // loading|ready|error
  session: null,
  user: null,
  profile: null, // from `profiles` table
  role: null,    // convenience: profile.role
  error: null
};

window.__sbClient = window.__sbClient || null;
window.__sbAccessToken = window.__sbAccessToken || null;

var __authListeners = [];
function __emitAuthState() {
  for (var i = 0; i < __authListeners.length; i++) {
    try { __authListeners[i](window.__authState); } catch (e) {}
  }
}

/* Called once from other modules to refresh their UI on auth changes. */
window.authSubscribe = function (cb) {
  if (typeof cb !== 'function') return function () {};
  __authListeners.push(cb);
  // Immediate call so UI can sync.
  try { cb(window.__authState); } catch (e) {}
  return function unsubscribe() {
    __authListeners = __authListeners.filter(function (x) { return x !== cb; });
  };
};

var __authOverlayOpen = false;
var __authTargetRole = null;
var __authPostLoginContext = null; // persisted across redirects (e.g. admin panel)
var __authGoogleOnly = false;

function __setOverlayOpen(open) {
  __authOverlayOpen = !!open;
  var ov = document.getElementById('admin-overlay');
  if (!ov) return;
  if (open) ov.classList.add('open');
  else ov.classList.remove('open');
  if (open) document.body.style.overflow = 'hidden';
  else document.body.style.overflow = '';
}

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

function __getTargetRoleFromSession() {
  try { return sessionStorage.getItem('mun_auth_target_role'); } catch (e) { return null; }
}

function __getPostLoginContextFromSession() {
  try { return sessionStorage.getItem('mun_auth_post_login_context'); } catch (e) { return null; }
}

function __clearPostLoginContext() {
  try {
    sessionStorage.removeItem('mun_auth_target_role');
    sessionStorage.removeItem('mun_auth_post_login_context');
  } catch (e) {}
}

function __clearTargetRoleFromSession() {
  try { sessionStorage.removeItem('mun_auth_target_role'); } catch (e) {}
}

function __saveTargetRoleToSession(role, postLoginContext) {
  try {
    sessionStorage.setItem('mun_auth_target_role', role);
    if (postLoginContext) sessionStorage.setItem('mun_auth_post_login_context', postLoginContext);
  } catch (e) {}
}

/* `profiles` table expected:
   - user_id (uuid, FK to auth.users.id)
   - role (organizer|delegate|admin)
   - display_name, initials, color (optional)
*/
function __loadProfile(userId) {
  return window.__sbClient
    .from('profiles')
    .select('user_id,role,display_name,initials,color')
    .eq('user_id', userId)
    .maybeSingle()
    .then(function (data) { return data; });
}

function __renderRolePicker(activeRole) {
  var roles = [
    { key: 'organizer', label: 'Organizer' },
    { key: 'delegate', label: 'Delegate' },
    { key: 'admin', label: 'Admin' }
  ];

  var body = '';
  body += '<div style="margin-bottom:1.2rem;">'
    + '<div style="font-family:\'DM Mono\',monospace;font-size:.63rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem;">Login type</div>'
    + '<div style="display:flex;gap:.6rem;flex-wrap:wrap;">';

  for (var i = 0; i < roles.length; i++) {
    var r = roles[i];
    body += '<button type="button" class="btn-s" style="padding:9px 16px;'
      + (activeRole === r.key ? 'border-color:var(--accent);color:var(--accent);background:rgba(201,168,76,.08);' : '')
      + '" onclick="setAuthTargetRole(\'' + r.key + '\')">' + r.label + '</button>';
  }

  body += '</div></div>';
  return body;
}

/* Exposed so role buttons inside generated HTML can call it */
window.setAuthTargetRole = function (role) {
  __authTargetRole = role;
  __authPostLoginContext = __getPostLoginContextFromSession();
  // Keep the backend role creation/validation aligned with what user selected in UI.
  // Without this, sessionStorage may still contain an old target role.
  __saveTargetRoleToSession(__authTargetRole, __authPostLoginContext);
  __renderAuthForm();
};

function __renderAuthForm() {
  var role = __authTargetRole || __getTargetRoleFromSession() || 'delegate';
  var title = 'Log in as: ' + role[0].toUpperCase() + role.slice(1);
  var googleOnly = !!__authGoogleOnly;

  document.getElementById('admin-title').textContent = title;
  document.getElementById('admin-tabs-bar').style.display = 'none';

  var bodyHtml = '';
  bodyHtml += __renderRolePicker(role);

  if (!googleOnly) {
    bodyHtml += '<div class="field-group">'
      + '<label class="field-label">Email</label>'
      + '<input class="field-input" type="email" id="auth-email" placeholder="you@example.com"/>'
      + '</div>'
      + '<div class="field-group">'
      + '<label class="field-label">Password</label>'
      + '<input class="field-input" type="password" id="auth-pw" placeholder="Your Supabase password" onkeydown="if(event.key===&quot;Enter&quot;)authSignInPassword()"/>'
      + '</div>'
      + '<div class="field-group" style="margin-top:.9rem;">'
      + '<div style="display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;">'
      + '<button class="btn-p" type="button" onclick="authSignInPassword()">Sign in</button>'
      + '<button class="btn-s" type="button" onclick="authSignInGoogle()">Continue with Google</button>'
      + '</div>'
      + '</div>';
  } else {
    // Admin-mode: hide email/password inputs, only allow OAuth provider.
    bodyHtml += '<div class="field-group" style="margin-top:.9rem;">'
      + '<div style="display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;">'
      + '<button class="btn-s" type="button" onclick="authSignInGoogle()">Continue with Google</button>'
      + '</div>'
      + '</div>';
  }

  document.getElementById('admin-body').innerHTML = bodyHtml + '<div class="admin-error" id="admin-error" style="margin-top:1rem;"></div>';
  document.getElementById('admin-footer').innerHTML =
    '<button class="btn-s" onclick="closeAdmin()">Cancel</button>';

  __clearAuthError();
  var em = document.getElementById('auth-email');
  if (em) setTimeout(function () { em.focus(); }, 50);
}

/* OAuth callback relies on Supabase-js `detectSessionInUrl`. */
window.authSignInGoogle = function () {
  __clearAuthError();
  if (!window.__sbClient) return;
  var role = __authTargetRole || __getTargetRoleFromSession() || 'delegate';
  __saveTargetRoleToSession(role, __authPostLoginContext || null);

  try {
    window.__sbClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Use the deployed domain for redirect.
        redirectTo: window.location.origin
      }
    });
  } catch (e) {
    __showAuthError('OAuth failed to start. Please try again.');
  }
};

window.authSignInPassword = function () {
  __clearAuthError();
  var emailEl = document.getElementById('auth-email');
  var pwEl = document.getElementById('auth-pw');
  if (!emailEl || !pwEl) return;

  var email = emailEl.value.trim();
  var pw = pwEl.value;
  if (!email || !pw) { __showAuthError('Please enter your email and password.'); return; }

  var btns = document.querySelectorAll('#admin-footer .btn-p,#admin-footer .btn-s');
  for (var i = 0; i < btns.length; i++) { /* noop */ }

  if (!window.__sbClient) return;

  var role = __authTargetRole || __getTargetRoleFromSession() || 'delegate';
  __saveTargetRoleToSession(role, __authPostLoginContext || null);

  window.__sbClient.auth.signInWithPassword({ email: email, password: pw })
    .catch(function () { __showAuthError('Login failed. Please check your credentials.'); });
};

window.authSignOut = function () {
  if (!window.__sbClient) return Promise.resolve();
  return window.__sbClient.auth.signOut()
    .catch(function () {})
    .then(function () { __clearPostLoginContext(); __setOverlayOpen(false); });
};

/* This is the shared entrypoint for organizer/delegate/admin login. */
window.openAuth = function (targetRole, opts) {
  __authTargetRole = targetRole || 'delegate';
  __authPostLoginContext = (opts && opts.postLoginContext) ? opts.postLoginContext : null;
  __authGoogleOnly = !!(opts && opts.googleOnly);
  __saveTargetRoleToSession(__authTargetRole, __authPostLoginContext);

  __renderAuthForm();
  __setOverlayOpen(true);
};

function __applyValidatedRoleOrError() {
  // If user has no profile row, we cannot assign a role safely.
  if (!window.__authState.user) return false;
  if (!window.__authState.profile || !window.__authState.role) {
    __showAuthError('Profile not found. Ask an organizer/admin to create your `profiles` row.');
    return false;
  }

  var desiredRole = __getTargetRoleFromSession();
  if (desiredRole && window.__authState.role !== desiredRole) {
    __showAuthError('This account is registered as "' + window.__authState.role + '".');
    return false;
  }

  return true;
}

/* After a successful auth + role validation, optionally run a post-login action.
   This is mostly needed for admin-panel via OAuth redirects.
*/
function __runPostLoginActionIfNeeded() {
  var postCtx = __getPostLoginContextFromSession();
  if (!postCtx) return;
  var role = __authState.role || __authState.profile && __authState.profile.role;

  if (!postCtx) return;
  __clearPostLoginContext();

  if (postCtx === 'admin-panel' && window.__authState.role === 'admin') {
    __setOverlayOpen(true);
    // Admin panel function is defined in admin.js; it may not be loaded yet.
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
  }
}

function __setSession(session) {
  window.__authState.status = 'loading';
  window.__authState.session = session;
  window.__authState.user = session ? session.user : null;
  window.__authState.profile = null;
  window.__authState.role = null;
  window.__authState.error = null;

  window.__sbAccessToken = session ? session.access_token : null;

  if (!session || !session.user) {
    window.__authState.status = 'ready';
    __emitAuthState();
    return;
  }

  // Load profile to get role and cabinet/display fields.
  __loadProfile(session.user.id)
    .then(function (profile) {
      // If `profiles` row doesn't exist yet, create it based on the selected login type.
      // This is what enables "self-select organizer/admin at first login".
      var needsCreate = (!profile || !profile.role);
      var desiredRoleForCreate = __getTargetRoleFromSession() || __authTargetRole || 'delegate';

      if (needsCreate && desiredRoleForCreate && window.__sbClient) {
        var md = (session.user && session.user.user_metadata) ? session.user.user_metadata : {};
        var displayName = md.full_name || md.name || md.username || '';

        var given = md.given_name || md.first_name || '';
        var family = md.family_name || md.last_name || '';
        if (!displayName && (given || family)) displayName = (given + ' ' + family).trim();

        if (!displayName && session.user && session.user.email) {
          displayName = session.user.email;
        }

        var initials = '';
        if (displayName) {
          initials = displayName
            .split(' ')
            .filter(function (w) { return w && w.length > 0; })
            .map(function (w) { return w[0]; })
            .join('')
            .substring(0, 2)
            .toUpperCase();
        }

        return window.__sbClient
          .from('profiles')
          .insert({
            user_id: session.user.id,
            role: desiredRoleForCreate,
            display_name: displayName || null,
            initials: initials || null,
            color: null
          })
          .select('user_id,role,display_name,initials,color')
          .maybeSingle();
      }

      return profile;
    })
    .then(function (profile) {
      window.__authState.profile = profile || null;
      window.__authState.role = profile && profile.role ? profile.role : null;
      window.__authState.status = 'ready';
      __emitAuthState();

      var desiredRole = __getTargetRoleFromSession();
      var postCtx = __getPostLoginContextFromSession();
      var isOverlayOpen = __authOverlayOpen || (document.getElementById('admin-overlay') && document.getElementById('admin-overlay').classList.contains('open'));

      // Enforce desired role match whenever a login role was requested.
      if (desiredRole) {
        __clearAuthError();
        if (!__applyValidatedRoleOrError()) {
          // Sign out so token isn't kept under wrong role.
          window.authSignOut().then(function () {
            __clearPostLoginContext();
            __emitAuthState();
          });
          return;
        }
        // Role validated; clear requested login role.
        // Keep post-login context for redirects (e.g. admin-panel).
        __clearTargetRoleFromSession();
      }

      __runPostLoginActionIfNeeded();

      // If this login modal was used for delegates/organizers, close it after validation.
      if (isOverlayOpen && desiredRole && desiredRole !== 'admin' && !postCtx) {
        __setOverlayOpen(false);
      }
    })
    .catch(function () {
      window.__authState.status = 'error';
      window.__authState.error = 'Failed to load your profile.';
      __emitAuthState();
      __showAuthError('Failed to load profile. Please try again.');
    });
}

function initAuth() {
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('Supabase client not loaded. Include @supabase/supabase-js script.');
    return;
  }
  window.__sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Restore session from storage/url.
  window.__sbClient.auth.getSession()
    .then(function (res) {
      __setSession(res && res.data ? res.data.session : null);
    });

  // Subscribe to future auth changes.
  window.__sbClient.auth.onAuthStateChange(function (_event, session) {
    __setSession(session);
  });
}

// Start immediately (after scripts load).
initAuth();

