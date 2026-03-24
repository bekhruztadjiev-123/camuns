/* MUN Central Asia — db.js */
var CONFS = [];

/* ═══════════════════════════════════════════
   LOAD CONFERENCES
   ═══════════════════════════════════════════ */
function loadConferences() {
  var st = window.__authState || {};
  var authed = st.user;
  if (!authed) {
    if (st.status === 'loading') {
      var gLoad = document.getElementById('conf-grid');
      if (gLoad) {
        gLoad.innerHTML = '<div style="padding:2rem 1.2rem;color:var(--muted);font-size:.85rem;"><span class="spinner"></span> Checking session...</div>';
      }
      return;
    }
    CONFS = [];
    // Hide filters for logged-out users
    var fw = document.getElementById('filter-wrap');
    if (fw) fw.style.display = 'none';

    // Update counters
    try { updateStats(); } catch (e) {}

    // Show empty directory + sign-in CTA
    var g = document.getElementById('conf-grid');
    if (g) {
      g.innerHTML =
        '<div class="no-results" style="grid-column:1/-1;padding:2rem 1.2rem;">'
        + '<span style="display:block;color:var(--muted);font-size:.9rem;margin-bottom:1rem;">'
        + 'Sign in to view the conference directory.'
        + '</span>'
        + '<button onclick="window.openAuth('delegate')" style="font-family:\'DM Mono\',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;background:var(--accent);color:var(--bg);border:none;padding:10px 22px;cursor:pointer;">'
        + 'Sign in'
        + '</button>'
        + '</div>';
    }
    return;
  }

  if (!SB_CONFIGURED) {
    CONFS = JSON.parse(JSON.stringify(LOCAL_CONFS));
    showFilterBar();
    updateStats();
    return;
  }

  // Hard 6-second timeout — always fall back to local data if Supabase hangs
  var settled = false;
  var timeout = setTimeout(function() {
    if (!settled) {
      settled = true;
      console.warn('Supabase timeout — using local data');
      CONFS = JSON.parse(JSON.stringify(LOCAL_CONFS));
      showFilterBar();
      updateStats();
      // Show a subtle notice that we're in offline mode
      var g = document.getElementById('conf-grid');
      if (g) {
        var notice = document.createElement('div');
        notice.style.cssText = "grid-column:1/-1;padding:.8rem 1.2rem;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);font-size:.75rem;color:var(--muted);font-family:'DM Mono',monospace;letter-spacing:.05em;";
        notice.innerHTML = 'OFFLINE MODE &mdash; Showing local data. <button onclick="loadConferences()" style="background:transparent;border:none;color:var(--accent);cursor:pointer;text-decoration:underline;">Retry connection</button>';
        g.appendChild(notice);
      }
    }
  }, 6000);

  function done(useLocal) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (useLocal) CONFS = JSON.parse(JSON.stringify(LOCAL_CONFS));
    showFilterBar();
    updateStats();
  }

  sbFetch('conferences?select=*&country=eq.Uzbekistan&order=dates.asc')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return done(true);
      }
      CONFS = rows;
      function parseJsonbField(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') { try { return JSON.parse(v); } catch(e) { return []; } }
        return [];
      }
      CONFS.forEach(function(c) {
        c.committees  = parseJsonbField(c.committees);
        c.chairs      = parseJsonbField(c.chairs);
        c.fees        = parseJsonbField(c.fees);
        c.deadlines   = parseJsonbField(c.deadlines);
        c.secretariat = parseJsonbField(c.secretariat);
        c.reviews     = [];
      });
      // Fetch all reviews in parallel with conferences
      return sbFetch('reviews?select=*&order=created_at.desc')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(allRevs) {
          if (Array.isArray(allRevs)) {
            CONFS.forEach(function(c) {
              c.reviews = allRevs.filter(function(r) {
                return String(r.conference_id) === String(c.id);
              });
              recalcRating(c);
            });
          }
          done(false);
        })
        .catch(function() { done(false); }); // reviews failed but confs ok
    })
    .catch(function(err) {
      console.warn('Supabase error:', err);
      done(true);
    });
}

// Reload directory automatically after login/logout
try {
  if (typeof window.authSubscribe === 'function') {
    window.authSubscribe(function (st) {
      // Avoid running before DOM is ready
      try { loadConferences(); } catch (e) {}
    });
  }
} catch (e) {}

/* Fetch fresh reviews for one conference from Supabase and update local cache */
function refreshReviews(confId, callback) {
  if (!SB_CONFIGURED) { if(callback) callback(); return; }
  sbFetch('reviews?conference_id=eq.'+confId+'&select=*&order=created_at.desc')
    .then(function(r){return r.json();})
    .then(function(rows){
      var c=null; for(var i=0;i<CONFS.length;i++){if(String(CONFS[i].id)===String(confId)){c=CONFS[i];break;}}
      if(c && Array.isArray(rows)){
        c.reviews = rows;
        recalcRating(c);
        renderCards(CONFS);
      }
      if(callback) callback(c);
    })
    .catch(function(){ if(callback) callback(); });
}

function updateStats() {
  document.getElementById('stat-total').textContent = CONFS.length;
  var total = 0;
  CONFS.forEach(function(c){
    var parts = c.delegates ? c.delegates.toString().split(/[\u2013\-]/g) : [];
    var n = parts.length>0 ? parseInt(parts[parts.length-1]) : 0;
    total += isNaN(n)?0:n;
  });
  document.getElementById('stat-delegates').textContent = total>0 ? total+'+' : '\u2014';
}

/* recalcRating — defined here so db.js, reviews.js and admin.js can all use it */
function recalcRating(c, pushToDB){
  var active=(c.reviews||[]).filter(function(r){return !r.archived;});
  if(active.length===0){c.rating=null;c.rating_count=0;c.ratingCount=0;}
  else {
    var total=0; active.forEach(function(r){total+=r.stars||r.rating||0;});
    c.rating=Math.round((total/active.length)*10)/10;
    c.rating_count=active.length; c.ratingCount=active.length;
  }
  if(pushToDB && SB_CONFIGURED){
    fetch(SUPABASE_URL+'/rest/v1/conferences?id=eq.'+Number(c.id),{
      method:'PATCH',
      headers:{
        'apikey':SUPABASE_ANON,
        'Authorization':'Bearer '+((window.__sbAccessToken && window.__sbAccessToken.length) ? window.__sbAccessToken : SUPABASE_ANON),
        'Content-Type':'application/json',
        'Prefer':'return=representation'
      },
      body:JSON.stringify({
        rating: c.rating,
        rating_count: c.rating_count||0
      })
    }).catch(function(){});
  }
}
