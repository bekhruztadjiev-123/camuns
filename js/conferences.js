/* MUN Central Asia — conferences.js */

/* ── FILTER STATE ── */
var filterDate   = 'all';
var filterRating = 0;
var filterSort   = 'date';
var filterSearch = '';

function setDateFilter(val, btn) {
  filterDate = val;
  var btns = btn.parentNode.querySelectorAll('.filter-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
  applyFilters();
}
function setRatingFilter(val, btn) {
  filterRating = val;
  var btns = btn.parentNode.querySelectorAll('.filter-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
  applyFilters();
}
function setSortFilter(val, btn) {
  filterSort = val;
  var btns = btn.parentNode.querySelectorAll('.filter-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
  applyFilters();
}
function clearSearch() {
  var inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  filterSearch = '';
  var clr = document.getElementById('search-clear');
  if (clr) clr.classList.remove('visible');
  applyFilters();
}
function resetFilters() {
  filterDate = 'all'; filterRating = 0; filterSort = 'date'; filterSearch = '';
  var inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  var clr = document.getElementById('search-clear');
  if (clr) clr.classList.remove('visible');
  var groups = document.querySelectorAll('.filter-group');
  for (var i = 0; i < groups.length; i++) {
    var btns = groups[i].querySelectorAll('.filter-btn');
    for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('active', j === 0);
  }
  applyFilters();
}

function applyFilters() {
  var inp = document.getElementById('search-input');
  if (inp) {
    filterSearch = inp.value.trim().toLowerCase();
    var clr = document.getElementById('search-clear');
    if (clr) clr.classList.toggle('visible', filterSearch.length > 0);
  }
  var list = CONFS.slice();
  if (filterDate !== 'all') list = list.filter(function(c){ return c.status === filterDate; });
  if (filterRating > 0)     list = list.filter(function(c){ return c.rating && c.rating >= filterRating; });
  if (filterSearch) {
    list = list.filter(function(c) {
      var hay = [c.name||'', c.city||'', c.edition||'', c.country||'', c.language||''].join(' ').toLowerCase();
      var comms = c.committees || [];
      for (var i = 0; i < comms.length; i++) {
        hay += ' ' + (comms[i].topic||'').toLowerCase() + ' ' + (comms[i].abbr||'').toLowerCase();
      }
      return hay.indexOf(filterSearch) !== -1;
    });
  }
  if (filterSort === 'rating') list.sort(function(a,b){ return (b.rating||0)-(a.rating||0); });
  else if (filterSort === 'name') list.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  var res = document.getElementById('filter-results');
  if (res) {
    res.textContent = list.length === CONFS.length
      ? CONFS.length + ' conference' + (CONFS.length !== 1 ? 's' : '')
      : list.length + ' of ' + CONFS.length + ' conference' + (CONFS.length !== 1 ? 's' : '');
  }
  renderCards(list);
}

function showFilterBar() {
  var fw = document.getElementById('filter-wrap');
  if (fw) { fw.style.display = 'flex'; fw.style.animation = 'fadeIn .3s ease'; }
  applyFilters();
}

/* ── RENDER CARDS ── */
function renderCards(list) {
  var g = document.getElementById('conf-grid');
  g.style.display = 'grid';
  document.getElementById('cs-panel').classList.remove('visible');
  if (!list || list.length === 0) {
    var isFiltered = filterSearch || filterDate !== 'all' || filterRating > 0;
    g.innerHTML = isFiltered
      ? '<div class="no-results"><span>No conferences found</span>Try adjusting your filters. <button onclick="resetFilters()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 14px;cursor:pointer;margin-left:.5rem;font-size:.8rem;">Clear filters</button></div>'
      : '<div class="no-results"><span>No conferences yet</span><button onclick="loadConferences()" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:5px 14px;cursor:pointer;font-size:.8rem;">Retry</button></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var rc = c.rating_count || c.ratingCount || 0;
    var rv = c.rating;
    var ratingHtml = rv
      ? '<span class="stars-sm">' + starsStr(Math.round(rv)) + '</span> <strong>' + rv + '</strong> <span style="color:var(--muted);font-size:.68rem;">(' + rc + ')</span>'
      : '<span style="color:var(--muted);font-size:.72rem;">No ratings yet</span>';
    var sl = c.status === 'open' ? 'Reg. Open' : c.status === 'soon' ? 'Coming Soon' : 'Closed';
    var delay = (i * 0.07).toFixed(2);
    var comms = c.committees || [];
    html += '<div class="conf-card card-anim" style="animation-delay:' + delay + 's" onclick="openModal(' + c.id + ')">'
      + '<div class="card-country">&#127482;&#127487; ' + escHtml(c.country) + ' \u00B7 ' + escHtml(c.city) + '</div>'
      + '<div class="conf-name">' + escHtml(c.name) + '</div>'
      + '<div class="conf-edition">' + escHtml(c.edition || '') + '</div>'
      + '<div class="card-meta">'
      + '<div><div class="meta-val">' + escHtml(c.dates || '') + '</div><div class="meta-key">Dates</div></div>'
      + '<div><div class="meta-val">' + escHtml(c.delegates || '') + '</div><div class="meta-key">Delegates</div></div>'
      + (comms.length ? '<div><div class="meta-val">' + comms.length + '</div><div class="meta-key">Committees</div></div>' : '')
      + '</div>'
      + '<div class="card-footer">'
      + '<div class="rating-badge">' + ratingHtml + '</div>'
      + '<span class="status-pill status-' + escHtml(c.status) + '">' + sl + '</span>'
      + '</div></div>';
  }
  g.innerHTML = html;
}

function switchCountry(code, btn) {
  if (btn.classList.contains('coming')) return;
  var tabs = document.querySelectorAll('.country-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  btn.classList.add('active');
  if (code === 'uz') { showFilterBar(); return; }
  var fw = document.getElementById('filter-wrap');
  if (fw) fw.style.display = 'none';
  document.getElementById('conf-grid').style.display = 'none';
  var p = document.getElementById('cs-panel'); p.classList.add('visible');
  var m = {kz:['\uD83C\uDDF0\uD83C\uDDFF','Kazakhstan'],kg:['\uD83C\uDDF0\uD83C\uDDEC','Kyrgyzstan'],tj:['\uD83C\uDDF9\uD83C\uDDEF','Tajikistan'],tm:['\uD83C\uDDF9\uD83C\uDDF2','Turkmenistan']};
  document.getElementById('cs-flag').textContent  = m[code][0];
  document.getElementById('cs-title').textContent = m[code][1] + ' \u2014 Coming Soon';
}

/* ═══════════════════════════════════════════
   CONFERENCE MODAL
   ═══════════════════════════════════════════ */
var activeId = null, selStar = 0, selRole = null;

function openModal(id) {
  activeId = id; selStar = 0; selRole = null;
  var c = null;
  for (var i = 0; i < CONFS.length; i++) { if (String(CONFS[i].id) === String(id)) { c = CONFS[i]; break; } }
  if (!c) return;

  var sl = c.status === 'open' ? 'Registration Open' : c.status === 'soon' ? 'Coming Soon' : 'Closed';
  var rc = c.rating_count || c.ratingCount || 0;
  var rv = c.rating;
  var ratingBlock = rv
    ? '<div class="rating-display"><div class="big-rating">' + rv + '</div><div><div class="big-stars">' + starsStr(Math.round(rv)) + '</div><div class="rating-count">Based on ' + rc + ' delegate reviews</div></div></div>'
    : '<div style="padding:1rem 1.3rem;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:.82rem;">No ratings yet.</div>';

  var commHtml = '', comms = c.committees || [];
  for (var i = 0; i < comms.length; i++) {
    var cm = comms[i];
    commHtml += '<div class="committee-row"><div class="comm-abbr">' + escHtml(cm.abbr) + '</div><div class="comm-topic">' + escHtml(cm.topic) + '</div><span class="comm-level ' + levelCls(cm.level) + '">' + levelLbl(cm.level) + '</span></div>';
  }
  var chairHtml = '', chairs = c.chairs || [];
  for (var i = 0; i < chairs.length; i++) {
    var ch = chairs[i];
    var ini = ch.initials || (ch.name ? ch.name.substring(0,2).toUpperCase() : '??');
    chairHtml += '<div class="chair-card"><div class="chair-avatar">' + escHtml(ini) + '</div><div><div class="chair-name">' + escHtml(ch.name||'') + '</div><div class="chair-role">' + escHtml(ch.role||'') + '</div><div class="chair-uni">' + escHtml(ch.uni||ch.university||'') + '</div></div></div>';
  }
  var feeHtml = '', fees = c.fees || [];
  for (var i = 0; i < fees.length; i++) {
    var f = fees[i];
    feeHtml += '<div class="fee-item"><div class="fee-amount">' + escHtml(f.amount) + '</div><div class="fee-type">' + escHtml(f.type) + '</div>' + (f.note ? '<div class="fee-note">' + escHtml(f.note) + '</div>' : '') + '</div>';
  }
  var dlHtml = '', dls = c.deadlines || [];
  for (var i = 0; i < dls.length; i++) {
    var d = dls[i];
    dlHtml += '<div class="deadline-row"><span class="dl-label">' + escHtml(d.label) + '</span><span class="dl-date ' + (d.passed ? 'dl-passed' : 'dl-upcoming') + '">' + escHtml(d.date) + '</span></div>';
  }
  var orgHtml = '', secc = c.secretariat || [];
  for (var i = 0; i < secc.length; i++) {
    var o = secc[i];
    orgHtml += '<div class="org-role-block"><div class="org-role-title">' + escHtml(o.role) + '</div><div class="org-name">' + escHtml(o.name) + '</div><div class="org-contact">' + escHtml(o.contact||o.email||'') + '</div></div>';
  }

  document.getElementById('modal-main').innerHTML =
    '<div class="modal-hero">'
    + '<div class="modal-country">&#127482;&#127487; ' + escHtml(c.country) + ' \u00B7 ' + escHtml(c.city) + '</div>'
    + '<div class="modal-title">' + escHtml(c.name) + '</div>'
    + '<div class="modal-subtitle">' + escHtml(c.edition||'') + ' \u00B7 ' + escHtml(c.dates||'') + '</div>'
    + '<div class="modal-tags">'
    + '<span class="tag tag-hl">' + escHtml(c.language||'English') + '</span>'
    + (c.delegates ? '<span class="tag">' + escHtml(c.delegates) + ' delegates</span>' : '')
    + '<span class="tag">' + comms.length + ' committees</span>'
    + (c.website ? '<span class="tag">' + escHtml(c.website) + '</span>' : '')
    + '<span class="status-pill status-' + escHtml(c.status) + '">' + sl + '</span>'
    + '</div></div>'
    + '<div class="modal-body">'
    + '<div class="modal-section"><div class="sec-title">Conference Details</div><div class="info-grid">'
    + '<div><div class="info-val">' + escHtml(c.city) + ', ' + escHtml(c.country) + '</div><div class="info-key">Location</div></div>'
    + '<div><div class="info-val">' + escHtml(c.dates||'') + '</div><div class="info-key">Dates</div></div>'
    + '<div><div class="info-val">' + escHtml(c.language||'English') + '</div><div class="info-key">Language</div></div>'
    + '<div><div class="info-val">' + escHtml(c.delegates||'\u2014') + '</div><div class="info-key">Delegates</div></div>'
    + '<div><div class="info-val">' + comms.length + '</div><div class="info-key">Committees</div></div>'
    + '<div><div class="info-val">' + (c.website ? escHtml(c.website) : '\u2014') + '</div><div class="info-key">Website</div></div>'
    + '</div></div>'
    + '<div class="modal-section"><div class="sec-title">Overall Rating</div>' + ratingBlock + '</div>'
    + (commHtml  ? '<div class="modal-section"><div class="sec-title">Committees &amp; Topics</div><div class="committee-list">'  + commHtml  + '</div></div>' : '')
    + (chairHtml ? '<div class="modal-section"><div class="sec-title">Chairs &amp; Secretariat</div><div class="chairs-grid">' + chairHtml + '</div></div>' : '')
    + (feeHtml   ? '<div class="modal-section"><div class="sec-title">Registration Fees</div><div class="fees-grid">'           + feeHtml   + '</div></div>' : '')
    + (dlHtml    ? '<div class="modal-section"><div class="sec-title">Important Deadlines</div><div class="deadline-list">'    + dlHtml    + '</div></div>' : '')
    + (orgHtml   ? '<div class="modal-section"><div class="sec-title">Organizing Team</div><div class="org-section">'          + orgHtml   + '</div></div>' : '')
    + '</div>';

  renderReviews(c);
  refreshReviews(c.id, function(updated) {
    if (updated && document.getElementById('modal-reviews')) renderReviews(updated);
  });
  document.getElementById('reg-btn').onclick = function() {
    if (c.website) {
      var url = c.website.match(/^https?:\/\//) ? c.website : 'https://' + c.website;
      window.open(url, '_blank');
    }
  };
  document.getElementById('share-btn').onclick = function() {
    var url = window.location.origin + window.location.pathname + '?conf=' + c.id;
    if (navigator.share) { navigator.share({ title: c.name, text: c.name + ' \u2014 ' + c.dates, url: url }); }
    else { navigator.clipboard.writeText(url).then(function() { alert('Link copied!'); }); }
  };
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModalBtn() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}
