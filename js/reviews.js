/* MUN Central Asia — reviews.js */
/* ── REVIEWS ── */
var __reviewAuthHooked = false;

// Telegram auth removed (now using Supabase auth via auth.js)

function refreshReviewAuthUI(){
  var authEl = document.getElementById('auth-block');
  var userEl = document.getElementById('user-bar');
  var formEl = document.getElementById('review-form');
  if(!authEl || !userEl || !formEl) return;

  var st = window.__authState || {};
  var profile = st.profile || null;
  var isDelegate = st.role === 'delegate';

  if(isDelegate && profile){
    authEl.classList.add('hidden');
    userEl.classList.add('visible');
    formEl.classList.add('visible');

    var initials = profile.initials;
    if(!initials){
      var dn = profile.display_name || (st.user && st.user.email) || '';
      initials = dn.split(' ').filter(Boolean).map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
    }
    var displayName = profile.display_name || (st.user && st.user.email) || 'Delegate';

    var ua = document.getElementById('u-avatar');
    if(ua) ua.textContent = initials || '?';
    var un = document.getElementById('u-name');
    if(un) un.textContent = displayName;
  } else {
    authEl.classList.remove('hidden');
    userEl.classList.remove('visible');
    formEl.classList.remove('visible');
  }
}

function ensureReviewAuthSubscription(){
  if(__reviewAuthHooked) return;
  __reviewAuthHooked = true;
  if(typeof window.authSubscribe === 'function'){
    window.authSubscribe(function(){ refreshReviewAuthUI(); });
  }
}

var currentSort='newest';

function sortReviews(order,btn){
  currentSort=order;
  var btns=document.querySelectorAll('.sort-btn');
  for(var i=0;i<btns.length;i++) btns[i].classList.remove('active');
  if(btn) btn.classList.add('active');
  var c=null; for(var i=0;i<CONFS.length;i++){if(String(CONFS[i].id)===String(activeId)){c=CONFS[i];break;}}
  if(c) renderReviewList(c);
}

function buildSortedReviews(reviews){
  var sorted=reviews.slice();
  if(currentSort==='highest') sorted.sort(function(a,b){return (b.rating||b.stars||0)-(a.rating||a.stars||0);});
  else if(currentSort==='lowest') sorted.sort(function(a,b){return (a.rating||a.stars||0)-(b.rating||b.stars||0);});
  else sorted.sort(function(a,b){return new Date(b.created_at||b.date||0)-new Date(a.created_at||a.date||0);});
  return sorted;
}

function buildRatingBreakdown(reviews){
  var counts=[0,0,0,0,0];
  reviews.forEach(function(r){var s=(r.rating||r.stars||1)-1;if(s>=0&&s<=4)counts[s]++;});
  var total=reviews.length||1;
  var html='<div style="flex:2;">';
  for(var star=5;star>=1;star--){
    var pct=Math.round((counts[star-1]/total)*100);
    html+='<div class="rv-bar-row">'
      +'<div class="rv-bar-label">'+star+'</div>'
      +'<div class="rv-bar-track"><div class="rv-bar-fill" style="width:'+pct+'%"></div></div>'
      +'<div class="rv-bar-count">'+counts[star-1]+'</div>'
      +'</div>';
  }
  return html+'</div>';
}

function safeBgColorFromReview(r){
  var c = r && r.color ? String(r.color) : '';
  // Allow only basic hex colors to prevent CSS injection via `style="background:..."`
  if (/^#[0-9a-fA-F]{6}$/.test(c) || /^#[0-9a-fA-F]{3}$/.test(c)) return c;
  // Fallback: deterministic safe color generated from text
  return pal(r && (r.user_name||r.user||r.initials||'') ? (r.user_name||r.user||r.initials||'') : '');
}

function renderReviewList(c){
  var reviews=(c.reviews||[]).filter(function(r){return !r.archived;});
  var sorted=buildSortedReviews(reviews);
  var listEl=document.getElementById('review-list-'+c.id);
  if(!listEl) return;
  if(sorted.length===0){listEl.innerHTML='<div class="no-reviews">No reviews yet — be the first!</div>';return;}
  var html='<div class="review-list">';
  for(var i=0;i<sorted.length;i++){
    var r=sorted[i];
    var stars=r.rating||r.stars||0;
    var dateStr=r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'})
      : (r.date||'');
    html+='<div class="review-item">'
      +'<div class="review-header">'
      +'<div class="rv-avatar" style="background:'+escHtml(safeBgColorFromReview(r))+'">'+escHtml(r.initials||'?')+'</div>'
      +'<div><div class="rv-name">'+escHtml(r.user_name||r.user||'')+'</div><div class="rv-role">'+escHtml(r.role||'')+'</div></div>'
      +'<div class="rv-stars">'+starsStr(stars)+'</div>'
      +'</div>'
      +'<div class="rv-text">'+escHtml(r.comments||r.comment||r.text||'')+'</div>'
      +'<div class="rv-date">'+escHtml(dateStr)+'</div>'
      +'</div>';
  }
  html+='</div>';
  listEl.innerHTML=html;
}

function renderReviews(c){
  var reviews=(c.reviews||[]).filter(function(r){return !r.archived;});
  var rc=c.rating_count||c.ratingCount||reviews.length||0;
  var rv=c.rating;

  var starPickerHtml='';
  for(var i=1;i<=5;i++) starPickerHtml+='<span class="star-pick" onclick="pickStar('+i+')">★</span>';
  var roleHtml='';
  var roles=['Delegate','Chair','Observer','Guest'];
  for(var i=0;i<roles.length;i++) roleHtml+='<button class="role-opt" onclick="pickRole(this,&quot;'+roles[i]+'&quot;)">'+roles[i]+'</button>';
  var countLabel=reviews.length+' Review'+(reviews.length!==1?'s':'');

  var ratingBreakdown=reviews.length>0
    ? '<div class="rating-display" style="margin-bottom:1rem;gap:1.5rem;">'
      +'<div style="text-align:center;"><div class="big-rating">'+(rv||'—')+'</div>'
      +'<div class="big-stars">'+starsStr(Math.round(rv||0))+'</div>'
      +'<div class="rating-count">'+rc+' review'+(rc!==1?'s':'')+'</div></div>'
      +buildRatingBreakdown(reviews)
      +'</div>'
    : '';

  document.getElementById('modal-reviews').innerHTML=
    '<div class="sec-title">Delegate Reviews</div>'
    +ratingBreakdown
    +'<div class="auth-block" id="auth-block">'
    +'<div class="tg-icon">✈️</div>'
    +'<div class="tg-text"><strong>Leave a verified review</strong><span>Sign in to write a verified review</span></div>'
    +'<button class="btn-p" style="margin-left:auto;" type="button" onclick="openAuth(\'delegate\')">Sign in</button>'
    +'</div>'
    +'<div class="user-bar" id="user-bar">'
    +'<div class="u-avatar" id="u-avatar"></div>'
    +'<div class="u-name" id="u-name"></div>'
    +'<span class="u-badge">Verified account</span>'
    +'<button class="logout-btn" onclick="if(window.authSignOut)window.authSignOut()">Sign out</button>'
    +'</div>'
    +'<div class="review-form" id="review-form">'
    +'<div class="form-row"><label class="form-label">Your Rating</label><div class="star-picker" id="star-picker">'+starPickerHtml+'</div></div>'
    +'<div class="form-row"><label class="form-label">Your Role</label><div class="role-selector">'+roleHtml+'</div></div>'
    +'<div class="form-row"><label class="form-label">Your Review</label><textarea class="rtext" id="rtext" placeholder="Share your experience — committees, chairs, organisation, venue…" maxlength="500"></textarea></div>'
    +'<button class="submit-btn" onclick="submitReview('+c.id+')">Submit Review</button>'
    +'</div>'
    +'<div class="reviews-count-title">'+countLabel+'</div>'
    +(reviews.length>1
      ? '<div class="sort-bar">'
        +'<span class="sort-label">Sort:</span>'
        +'<button class="sort-btn'+(currentSort==='newest'?' active':'')+'" onclick="sortReviews(&quot;newest&quot;,this)">Newest</button>'
        +'<button class="sort-btn'+(currentSort==='highest'?' active':'')+'" onclick="sortReviews(&quot;highest&quot;,this)">Highest Rated</button>'
        +'<button class="sort-btn'+(currentSort==='lowest'?' active':'')+'" onclick="sortReviews(&quot;lowest&quot;,this)">Lowest Rated</button>'
        +'</div>'
      : '')
    +'<div id="review-list-'+c.id+'"></div>';

  renderReviewList(c);
  ensureReviewAuthSubscription();
  refreshReviewAuthUI();
}

function pickStar(v){selStar=v;var p=document.querySelectorAll('.star-pick');for(var i=0;i<p.length;i++)p[i].classList.toggle('on',i<v);}
function pickRole(btn,r){selRole=r;var o=document.querySelectorAll('.role-opt');for(var i=0;i<o.length;i++)o[i].classList.remove('on');btn.classList.add('on');}

function submitReview(cid){
  var st = window.__authState || {};
  if(!st.user || st.role !== 'delegate'){
    alert('Please sign in as a delegate first.');
    refreshReviewAuthUI();
    return;
  }
  if(!selStar)return alert('Please select a star rating.');
  if(!selRole)return alert('Please select your role.');
  var txt=document.getElementById('rtext').value.trim();
  if(!txt)return alert('Please write a short review.');
  var c=null; for(var i=0;i<CONFS.length;i++){if(String(CONFS[i].id)===String(cid)){c=CONFS[i];break;}}
  // initials + display info are derived from the logged-in Supabase profile
  var profile = st.profile || {};
  var userName = profile.display_name || (st.user && st.user.email) || 'Delegate';
  var ini = profile.initials;
  if(!ini){
    ini = userName.split(' ').filter(Boolean).map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
  }
  var color = profile.color || pal(userName);
  // userName is derived from the logged-in Supabase profile

  // Capture values FIRST before anything resets them
  var savedRole  = selRole;
  var savedStars = selStar;
  var savedUserId = st.user ? st.user.id : null;

  // Optimistic local update for instant feedback
  var localRev={
    id: Date.now(),
    conference_id: cid,
    user_id: savedUserId,
    user: userName, user_name: userName,
    initials: ini, color: color,
    role: savedRole, stars: savedStars, rating: savedStars,
    comments: txt,
    created_at: new Date().toISOString(),
    archived: false
  };
  if(!c.reviews) c.reviews=[];
  if(savedUserId){
    c.reviews = c.reviews.filter(function(r){ return String(r.user_id) !== String(savedUserId); });
  }
  c.reviews.unshift(localRev);
  recalcRating(c, false);

  // Reset form
  document.getElementById('rtext').value='';
  selStar=0; selRole=null;
  currentSort='newest';
  renderReviews(c);
  renderCards(CONFS);

  // Persist to Supabase using raw fetch for full control
  if(SB_CONFIGURED){
    // Strip non-BMP unicode chars (emoji, fancy letters) that break JSON
    function safStr(s, fallback) {
      if(!s || s === 'null' || s === 'undefined') return fallback || '';
      // Remove surrogate pairs / non-BMP characters
      return String(s).replace(/[\uD800-\uDFFF]/g, '').trim() || fallback || '';
    }
    var safeIni  = safStr(ini, '?').substring(0,2);
    var safeName = safStr(userName, 'Anonymous').substring(0,80);
    var safeRole = (savedRole && savedRole !== 'null') ? String(savedRole) : 'Delegate';
    var safeTxt  = safStr(txt, '').substring(0,500);
    var payload = {
      conference_id: Number(cid) || 0,
      user_id: savedUserId,
      user_name: safeName,
      initials: safeIni,
      color: String(color) || '#888',
      role: safeRole,
      rating: Number(savedStars) || 1,
      comments: safeTxt,
      archived: false
    };
    var payloadStr;
    try {
      payloadStr = JSON.stringify(payload);
      // Verify it round-trips cleanly
      JSON.parse(payloadStr);
    } catch(e) {
      console.warn('JSON build failed:', e, payload);
      return;
    }
    // Avoid logging user-generated content in production.
    var accessToken = (window.__sbAccessToken && window.__sbAccessToken.length) ? window.__sbAccessToken : SUPABASE_ANON;
    fetch(SUPABASE_URL + '/rest/v1/reviews?on_conflict=conference_id,user_id', {
      method:  'POST',
      headers: {
        'apikey':         SUPABASE_ANON,
        'Authorization':  'Bearer ' + accessToken,
        'Content-Type':   'application/json',
        'Prefer':         'resolution=merge-duplicates,return=representation'
      },
      body: payloadStr
    })
    .then(function(r){
      if(!r.ok){
        return r.text().then(function(t){
          throw new Error('HTTP '+r.status+': '+t);
        });
      }
      return r.json();
    })
    .then(function(){
      // Refresh from DB (RLS + uniqueness are enforced server-side)
      refreshReviews(cid, function(updated){
        if(updated && document.getElementById('modal-reviews')) renderReviews(updated);
      });
    })
    .catch(function(e){ /* keep error silent to avoid leaking request context */ });
  }
}

function closeModalBtn(){document.getElementById('overlay').classList.remove('open');document.body.style.overflow='';}
