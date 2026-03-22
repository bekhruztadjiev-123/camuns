/* MUN Central Asia — admin.js */
/* ═══════════════════════════════════════════
   ADMIN PANEL
   ═══════════════════════════════════════════ */
var ADMIN_PW='camuns2026';
var adminLoggedIn=false;
var adminActiveTab='conferences';
var editingConfId=null;
var addStep=0;
var addData={};

function openAdmin(){
  document.getElementById('admin-overlay').classList.add('open');
  document.body.style.overflow='hidden';
  if(!adminLoggedIn){
    setTimeout(function(){var pw=document.getElementById('admin-pw');if(pw)pw.focus();},150);
  }
}
function closeAdmin(){
  document.getElementById('admin-overlay').classList.remove('open');
  document.body.style.overflow='';
}

function checkAdmin(){
  var pw=document.getElementById('admin-pw');
  if(!pw)return;
  if(pw.value===ADMIN_PW){
    adminLoggedIn=true;
    showAdminPanel();
  } else {
    document.getElementById('admin-error').classList.add('visible');
    pw.value=''; pw.focus();
  }
}

function showAdminPanel(){
  document.getElementById('admin-title').textContent='Admin Panel';
  var tabsBar=document.getElementById('admin-tabs-bar');
  tabsBar.style.display='flex';
  tabsBar.innerHTML=
    '<button class="admin-tab active" id="atab-conferences" onclick="switchAdminTab(\'conferences\')">Conferences</button>'
    +'<button class="admin-tab" id="atab-reviews" onclick="switchAdminTab(\'reviews\')">Reviews</button>'
    +'<button class="admin-tab" id="atab-add" onclick="switchAdminTab(\'add\')">+ Add Conference</button>';
  document.getElementById('admin-footer').innerHTML='<button class="btn-s" onclick="adminLogout()">Log Out</button>';
  switchAdminTab('conferences');
}

function adminLogout(){
  adminLoggedIn=false; adminActiveTab='conferences';
  document.getElementById('admin-tabs-bar').style.display='none';
  document.getElementById('admin-body').innerHTML=
    '<div class="field-group"><label class="field-label">Password</label>'
    +'<input class="field-input" type="password" id="admin-pw" placeholder="Enter admin password" onkeydown="if(event.key===\'Enter\')checkAdmin()"/></div>'
    +'<div class="admin-error" id="admin-error">Incorrect password.</div>';
  document.getElementById('admin-footer').innerHTML=
    '<button class="btn-s" onclick="closeAdmin()">Cancel</button>'
    +'<button class="btn-p" onclick="checkAdmin()">Login</button>';
}

function switchAdminTab(tab){
  adminActiveTab=tab;
  var tabs=['conferences','reviews','add'];
  for(var i=0;i<tabs.length;i++){
    var el=document.getElementById('atab-'+tabs[i]);
    if(el)el.classList.toggle('active',tabs[i]===tab);
  }
  if(tab==='conferences') renderAdminConferences();
  else if(tab==='reviews')renderAdminReviews();
  else if(tab==='add')    renderAddStep(0);
}

/* ── Admin: Conferences list ── */
function renderAdminConferences(){
  var html='';
  if(!SB_CONFIGURED){
    html='<div class="setup-banner"><strong>&#9888; Supabase not configured</strong>Connect your database to enable persistent storage. See the SQL setup guide below, then replace <code>YOUR_SUPABASE_URL</code> and <code>YOUR_SUPABASE_ANON_KEY</code> in the source file.<br><br><strong>SQL to create tables:</strong><br><code>create table conferences (id bigserial primary key, name text, edition text, country text, city text, dates text, status text default \'soon\', rating numeric, rating_count int default 0, delegates text, language text, website text, committees jsonb, chairs jsonb, fees jsonb, deadlines jsonb, secretariat jsonb);</code><br><br><code>create table reviews (id bigserial primary key, conference_id bigint references conferences(id), user_name text, initials text, color text, role text, rating int, comment text, archived boolean default false, tg_id bigint, created_at timestamptz default now());</code><br><br>Then enable Row Level Security and add a public select policy.</div>';
  }
  html+='<div class="admin-conf-list">';
  for(var i=0;i<CONFS.length;i++){
    var c=CONFS[i];
    html+='<div class="admin-conf-item">'
      +'<div><div class="acf-name">'+escHtml(c.name)+'</div><div class="acf-meta">'+escHtml(c.city)+' \u00B7 '+escHtml(c.dates||'')+' \u00B7 <span class="status-pill status-'+escHtml(c.status)+'">'+escHtml(c.status)+'</span></div></div>'
      +'<div class="acf-actions">'
      +'<button class="acf-btn" onclick="editConf('+c.id+')">Edit</button>'
      +'<button class="acf-btn danger" onclick="deleteConf('+c.id+')">Delete</button>'
      +'</div></div>';
  }
  html+='</div>';
  document.getElementById('admin-body').innerHTML=html;
}

function deleteConf(id){
  if(!confirm('Delete this conference? This cannot be undone.'))return;
  CONFS=CONFS.filter(function(c){return c.id!==id;});
  if(SB_CONFIGURED){
    sbFetch('conferences?id=eq.'+id,{method:'DELETE'}).catch(function(){});
  }
  renderCards(CONFS);
  renderAdminConferences();
}

function editConf(id){
  editingConfId=id;
  var c=null;for(var i=0;i<CONFS.length;i++){if(CONFS[i].id===id){c=CONFS[i];break;}}
  if(!c)return;
  addData=JSON.parse(JSON.stringify(c));
  var tabsBar=document.getElementById('admin-tabs-bar');
  tabsBar.innerHTML=
    '<button class="admin-tab active" onclick="">Editing: '+escHtml(c.name)+'</button>'
    +'<button class="admin-tab" onclick="editingConfId=null;switchAdminTab(\'conferences\')">\u2190 Back</button>';
  renderAddStep(0,true);
}

/* ── Admin: Add/Edit steps ── */
var STEPS=['Basic Info','Committees','Chairs & Team','Fees & Deadlines','Review & Save'];

function renderAddStep(step, isEdit){
  addStep=step;
  if(typeof isEdit==='undefined')isEdit=(editingConfId!==null);

  // Step indicator
  var stepsHtml='<div class="step-indicator">';
  for(var i=0;i<STEPS.length;i++){
    if(i>0)stepsHtml+='<div class="step-line'+(i<=step?' done':'')+'"></div>';
    stepsHtml+='<div style="text-align:center">'
      +'<div class="step-dot'+(i<step?' done':i===step?' active':'')+'">'+( i<step?'&#10003;':(i+1) )+'</div>'
      +'</div>';
  }
  stepsHtml+='</div>';

  var panelHtml='';
  if(step===0) panelHtml=buildStep0();
  else if(step===1) panelHtml=buildStep1();
  else if(step===2) panelHtml=buildStep2();
  else if(step===3) panelHtml=buildStep3();
  else if(step===4) panelHtml=buildStep4();

  document.getElementById('admin-body').innerHTML=stepsHtml+panelHtml;
  attachDynHandlers();

  var footer='';
  if(step>0) footer+='<button class="btn-s" onclick="renderAddStep('+(step-1)+','+isEdit+')">Back</button>';
  if(step<4) footer+='<button class="btn-p" onclick="nextStep('+isEdit+')">Next</button>';
  else       footer+='<button class="btn-p" onclick="saveConference('+isEdit+')">'+( isEdit?'Save Changes':'Publish Conference')+'</button>';
  document.getElementById('admin-footer').innerHTML=footer;
}

function buildStep0(){
  var d=addData;
  return '<div class="field-row">'
    +'<div class="field-group"><label class="field-label">Conference Name *</label><input class="field-input" id="f-name" value="'+escHtml(d.name||'')+'" placeholder="e.g. TashMUN"/></div>'
    +'<div class="field-group"><label class="field-label">Edition</label><input class="field-input" id="f-edition" value="'+escHtml(d.edition||'')+'" placeholder="e.g. V Session"/></div>'
    +'</div>'
    +'<div class="field-row">'
    +'<div class="field-group"><label class="field-label">City *</label><input class="field-input" id="f-city" value="'+escHtml(d.city||'')+'" placeholder="Tashkent"/></div>'
    +'<div class="field-group"><label class="field-label">Country</label><input class="field-input" id="f-country" value="'+escHtml(d.country||'Uzbekistan')+'" placeholder="Uzbekistan"/></div>'
    +'</div>'
    +'<div class="field-row">'
    +'<div class="field-group"><label class="field-label">Dates *</label><input class="field-input" id="f-dates" value="'+escHtml(d.dates||'')+'" placeholder="April 4\u20136, 2026"/></div>'
    +'<div class="field-group"><label class="field-label">Status</label>'
    +'<select class="field-select" id="f-status">'
    +'<option value="soon"'+((!d.status||d.status==='soon')?' selected':'')+'">Coming Soon</option>'
    +'<option value="open"'+(d.status==='open'?' selected':'')+'>Registration Open</option>'
    +'<option value="closed"'+(d.status==='closed'?' selected':'')+'>Closed</option>'
    +'</select></div>'
    +'</div>'
    +'<div class="field-row">'
    +'<div class="field-group"><label class="field-label">Delegates (range)</label><input class="field-input" id="f-delegates" value="'+escHtml(d.delegates||'')+'" placeholder="150\u2013200"/></div>'
    +'<div class="field-group"><label class="field-label">Language</label><input class="field-input" id="f-language" value="'+escHtml(d.language||'English')+'" placeholder="English"/></div>'
    +'</div>'
    +'<div class="field-group"><label class="field-label">Website</label><input class="field-input" id="f-website" value="'+escHtml(d.website||'')+'" placeholder="tashmun.uz"/></div>';
}

function buildStep1(){
  var comms=addData.committees||[];
  var html='<div id="committees-list">';
  for(var i=0;i<comms.length;i++){
    html+=commRow(i,comms[i]);
  }
  html+='</div><button class="add-row-btn" onclick="addCommRow()">+ Add Committee</button>';
  return html;
}
function commRow(i,cm){
  cm=cm||{};
  return '<div class="dyn-row" style="grid-template-columns:90px 1fr 110px;" id="comm-row-'+i+'">'
    +'<input class="field-input comm-abbr" placeholder="UNSC" value="'+escHtml(cm.abbr||'')+'" />'
    +'<input class="field-input comm-topic" placeholder="Committee topic" value="'+escHtml(cm.topic||'')+'" />'
    +'<select class="field-select comm-level"><option value="beg"'+(cm.level==='beg'?' selected':'')+'>Beginner</option><option value="int"'+(cm.level==='int'?' selected':'')+'>Intermediate</option><option value="adv"'+(cm.level==='adv'?' selected':'')+'>Advanced</option></select>'
    +'<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    +'</div>';
}
function addCommRow(){
  var list=document.getElementById('committees-list');
  var idx=list.children.length;
  var div=document.createElement('div');div.innerHTML=commRow(idx,{});
  list.appendChild(div.firstChild);
}

function buildStep2(){
  var chairs=addData.chairs||[];
  var sec=addData.secretariat||[];
  var html='<div class="sec-title">Chairs</div><div id="chairs-list">';
  for(var i=0;i<chairs.length;i++) html+=chairRow(i,chairs[i]);
  html+='</div><button class="add-row-btn" onclick="addChairRow()">+ Add Chair</button>';
  html+='<div class="sec-title" style="margin-top:1.5rem;">Secretariat / Organizers</div><div id="sec-list">';
  for(var i=0;i<sec.length;i++) html+=secRow(i,sec[i]);
  html+='</div><button class="add-row-btn" onclick="addSecRow()">+ Add Organizer</button>';
  return html;
}
function chairRow(i,ch){
  ch=ch||{};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr 1fr;" id="chair-row-'+i+'">'
    +'<input class="field-input ch-name" placeholder="Full Name" value="'+escHtml(ch.name||'')+'"/>'
    +'<input class="field-input ch-role" placeholder="Role (e.g. Chair \u2014 UNSC)" value="'+escHtml(ch.role||'')+'"/>'
    +'<input class="field-input ch-uni"  placeholder="University" value="'+escHtml(ch.uni||ch.university||'')+'"/>'
    +'<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    +'</div>';
}
function addChairRow(){var l=document.getElementById('chairs-list');var d=document.createElement('div');d.innerHTML=chairRow(l.children.length,{});l.appendChild(d.firstChild);}
function secRow(i,o){
  o=o||{};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr 1fr;" id="sec-row-'+i+'">'
    +'<input class="field-input sec-role" placeholder="Role" value="'+escHtml(o.role||'')+'"/>'
    +'<input class="field-input sec-name" placeholder="Name" value="'+escHtml(o.name||'')+'"/>'
    +'<input class="field-input sec-contact" placeholder="Email / contact" value="'+escHtml(o.contact||o.email||'')+'"/>'
    +'<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    +'</div>';
}
function addSecRow(){var l=document.getElementById('sec-list');var d=document.createElement('div');d.innerHTML=secRow(l.children.length,{});l.appendChild(d.firstChild);}

function buildStep3(){
  var fees=addData.fees||[];
  var dls=addData.deadlines||[];
  var html='<div class="sec-title">Registration Fees</div><div id="fees-list">';
  for(var i=0;i<fees.length;i++) html+=feeRow(i,fees[i]);
  html+='</div><button class="add-row-btn" onclick="addFeeRow()">+ Add Fee Tier</button>';
  html+='<div class="sec-title" style="margin-top:1.5rem;">Important Deadlines</div><div id="dl-list">';
  for(var i=0;i<dls.length;i++) html+=dlRow(i,dls[i]);
  html+='</div><button class="add-row-btn" onclick="addDlRow()">+ Add Deadline</button>';
  return html;
}
function feeRow(i,f){
  f=f||{};
  return '<div class="dyn-row" style="grid-template-columns:90px 1fr 1fr;" id="fee-row-'+i+'">'
    +'<input class="field-input fee-amount" placeholder="$30" value="'+escHtml(f.amount||'')+'"/>'
    +'<input class="field-input fee-type"   placeholder="Single Delegate" value="'+escHtml(f.type||'')+'"/>'
    +'<input class="field-input fee-note"   placeholder="Note (optional)" value="'+escHtml(f.note||'')+'"/>'
    +'<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    +'</div>';
}
function addFeeRow(){var l=document.getElementById('fees-list');var d=document.createElement('div');d.innerHTML=feeRow(l.children.length,{});l.appendChild(d.firstChild);}
function dlRow(i,d){
  d=d||{};
  return '<div class="dyn-row" style="grid-template-columns:1fr 1fr auto;" id="dl-row-'+i+'">'
    +'<input class="field-input dl-label" placeholder="e.g. Position Papers" value="'+escHtml(d.label||'')+'"/>'
    +'<input class="field-input dl-date"  placeholder="Mar 27, 2026" value="'+escHtml(d.date||'')+'"/>'
    +'<label style="display:flex;align-items:center;gap:5px;font-size:.75rem;color:var(--muted);"><input type="checkbox" class="dl-passed" '+(d.passed?'checked':'')+'/> Passed</label>'
    +'<button class="remove-row" onclick="this.parentNode.remove()">\u2715</button>'
    +'</div>';
}
function addDlRow(){var l=document.getElementById('dl-list');var d=document.createElement('div');d.innerHTML=dlRow(l.children.length,{});l.appendChild(d.firstChild);}

function buildStep4(){
  var d=addData;
  return '<div style="font-size:.85rem;line-height:1.9;color:var(--muted);">'
    +'<div style="margin-bottom:1.2rem;"><span style="color:var(--text);font-weight:500;">'+(d.name||'(unnamed)')+'</span> &mdash; '+escHtml(d.edition||'')+' &mdash; '+escHtml(d.city||'')+', '+escHtml(d.country||'')+'</div>'
    +'<div><strong style="color:var(--text);">Dates:</strong> '+escHtml(d.dates||'\u2014')+'</div>'
    +'<div><strong style="color:var(--text);">Status:</strong> '+escHtml(d.status||'\u2014')+'</div>'
    +'<div><strong style="color:var(--text);">Delegates:</strong> '+escHtml(d.delegates||'\u2014')+'</div>'
    +'<div><strong style="color:var(--text);">Language:</strong> '+escHtml(d.language||'\u2014')+'</div>'
    +'<div><strong style="color:var(--text);">Website:</strong> '+escHtml(d.website||'\u2014')+'</div>'
    +'<div><strong style="color:var(--text);">Committees:</strong> '+(d.committees||[]).length+'</div>'
    +'<div><strong style="color:var(--text);">Chairs:</strong> '+(d.chairs||[]).length+'</div>'
    +'<div><strong style="color:var(--text);">Fee tiers:</strong> '+(d.fees||[]).length+'</div>'
    +'<div><strong style="color:var(--text);">Deadlines:</strong> '+(d.deadlines||[]).length+'</div>'
    +'</div>';
}

function collectCurrentStep(){
  if(addStep===0){
    addData.name    =document.getElementById('f-name').value.trim();
    addData.edition =document.getElementById('f-edition').value.trim();
    addData.city    =document.getElementById('f-city').value.trim();
    addData.country =document.getElementById('f-country').value.trim();
    addData.dates   =document.getElementById('f-dates').value.trim();
    addData.status  =document.getElementById('f-status').value;
    addData.delegates=document.getElementById('f-delegates').value.trim();
    addData.language=document.getElementById('f-language').value.trim();
    addData.website =document.getElementById('f-website').value.trim();
    if(!addData.name||!addData.city||!addData.dates){alert('Name, City and Dates are required.');return false;}
  }
  if(addStep===1){
    var comms=[];
    var rows=document.querySelectorAll('#committees-list .dyn-row');
    for(var i=0;i<rows.length;i++){
      var abbr=rows[i].querySelector('.comm-abbr').value.trim();
      var topic=rows[i].querySelector('.comm-topic').value.trim();
      var level=rows[i].querySelector('.comm-level').value;
      if(abbr&&topic) comms.push({abbr:abbr,topic:topic,level:level});
    }
    addData.committees=comms;
  }
  if(addStep===2){
    var chairs=[];
    var rows=document.querySelectorAll('#chairs-list .dyn-row');
    for(var i=0;i<rows.length;i++){
      var name=rows[i].querySelector('.ch-name').value.trim();
      var role=rows[i].querySelector('.ch-role').value.trim();
      var uni =rows[i].querySelector('.ch-uni').value.trim();
      if(name) chairs.push({name:name,role:role,uni:uni,initials:name.split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase()});
    }
    addData.chairs=chairs;
    var sec=[];
    var srows=document.querySelectorAll('#sec-list .dyn-row');
    for(var i=0;i<srows.length;i++){
      var role=srows[i].querySelector('.sec-role').value.trim();
      var name=srows[i].querySelector('.sec-name').value.trim();
      var contact=srows[i].querySelector('.sec-contact').value.trim();
      if(name) sec.push({role:role,name:name,contact:contact});
    }
    addData.secretariat=sec;
  }
  if(addStep===3){
    var fees=[];
    var rows=document.querySelectorAll('#fees-list .dyn-row');
    for(var i=0;i<rows.length;i++){
      var amount=rows[i].querySelector('.fee-amount').value.trim();
      var type  =rows[i].querySelector('.fee-type').value.trim();
      var note  =rows[i].querySelector('.fee-note').value.trim();
      if(amount&&type) fees.push({amount:amount,type:type,note:note});
    }
    addData.fees=fees;
    var dls=[];
    var drows=document.querySelectorAll('#dl-list .dyn-row');
    for(var i=0;i<drows.length;i++){
      var label =drows[i].querySelector('.dl-label').value.trim();
      var date  =drows[i].querySelector('.dl-date').value.trim();
      var passed=drows[i].querySelector('.dl-passed').checked;
      if(label&&date) dls.push({label:label,date:date,passed:passed});
    }
    addData.deadlines=dls;
  }
  return true;
}

function nextStep(isEdit){
  if(!collectCurrentStep())return;
  renderAddStep(addStep+1,isEdit);
}

function saveConference(isEdit){
  if(!collectCurrentStep())return;
  if(isEdit&&editingConfId!==null){
    for(var i=0;i<CONFS.length;i++){
      if(CONFS[i].id===editingConfId){
        CONFS[i]=Object.assign(CONFS[i],addData);break;
      }
    }
    if(SB_CONFIGURED){
      sbFetch('conferences?id=eq.'+editingConfId,{method:'PATCH',body:JSON.stringify({
        name:addData.name,edition:addData.edition,city:addData.city,country:addData.country,
        dates:addData.dates,status:addData.status,delegates:addData.delegates,
        language:addData.language,website:addData.website,
        committees:addData.committees,chairs:addData.chairs,
        fees:addData.fees,deadlines:addData.deadlines,secretariat:addData.secretariat
      })}).catch(function(){});
    }
    editingConfId=null; addData={};
    renderCards(CONFS);
    var tabsBar=document.getElementById('admin-tabs-bar');
    tabsBar.innerHTML=
      '<button class="admin-tab active" id="atab-conferences" onclick="switchAdminTab(\'conferences\')">Conferences</button>'
      +'<button class="admin-tab" id="atab-reviews" onclick="switchAdminTab(\'reviews\')">Reviews</button>'
      +'<button class="admin-tab" id="atab-add" onclick="switchAdminTab(\'add\')">+ Add Conference</button>';
    switchAdminTab('conferences');
    alert('Conference updated!');
  } else {
    addData.id=Date.now();
    addData.rating=null; addData.rating_count=0; addData.reviews=[];
    CONFS.push(addData);
    if(SB_CONFIGURED){
      sbFetch('conferences',{method:'POST',body:JSON.stringify({
        name:addData.name,edition:addData.edition,city:addData.city,country:addData.country,
        dates:addData.dates,status:addData.status,delegates:addData.delegates,
        language:addData.language,website:addData.website,
        committees:addData.committees,chairs:addData.chairs,
        fees:addData.fees,deadlines:addData.deadlines,secretariat:addData.secretariat,
        rating_count:0
      })}).catch(function(){});
    }
    addData={};
    renderCards(CONFS);
    updateStats();
    switchAdminTab('conferences');
    alert('Conference published!');
  }
}

function attachDynHandlers(){}

/* ── Admin: Reviews ── */
function renderAdminReviews(){
  var html='';
  for(var i=0;i<CONFS.length;i++){
    var c=CONFS[i];
    var revs=c.reviews||[];
    if(revs.length===0) continue;
    html+='<div class="sec-title">'+escHtml(c.name)+'</div>';
    for(var j=0;j<revs.length;j++){
      var r=revs[j];
      var stars=r.stars||r.rating||0;
      html+='<div class="admin-rv-item'+(r.archived?' archived':'')+'">'
        +'<div class="rv-avatar" style="background:'+escHtml(r.color||'#888')+'">'+escHtml(r.initials||'?')+'</div>'
        +'<div class="arv-info">'
        +'<div class="arv-head">'+escHtml(r.user||r.user_name||'')+' <span style="color:var(--muted);font-weight:300;">'+escHtml(r.role||'')+' &mdash; '+starsStr(stars)+'</span></div>'
        +'<div class="arv-sub">'+escHtml(r.date||r.created_at||'')+'</div>'
        +'<div class="arv-text">'+escHtml(r.text||r.comment||'')+'</div>'
        +'</div>'
        +'<div style="display:flex;flex-direction:column;gap:.4rem;">'
        +(r.archived
          ?'<button class="acf-btn" onclick="unarchiveReview('+c.id+','+r.id+')">Restore</button>'
          :'<button class="acf-btn danger" onclick="archiveReview('+c.id+','+r.id+')">Archive</button>'
        )
        +'</div>'
        +'</div>';
    }
  }
  if(!html) html='<div style="color:var(--muted);font-size:.85rem;padding:1rem;">No reviews yet.</div>';
  document.getElementById('admin-body').innerHTML=html;
}

function archiveReview(confId,revId){
  var c=null; for(var i=0;i<CONFS.length;i++){if(CONFS[i].id===confId){c=CONFS[i];break;}}
  if(!c)return;
  for(var i=0;i<c.reviews.length;i++){if(c.reviews[i].id===revId){c.reviews[i].archived=true;break;}}
  if(SB_CONFIGURED) sbFetch('reviews?id=eq.'+revId,{method:'PATCH',body:JSON.stringify({archived:true})}).catch(function(){});
  recalcRating(c, true); renderCards(CONFS); renderAdminReviews();
}
function unarchiveReview(confId,revId){
  var c=null; for(var i=0;i<CONFS.length;i++){if(CONFS[i].id===confId){c=CONFS[i];break;}}
  if(!c)return;
  for(var i=0;i<c.reviews.length;i++){if(c.reviews[i].id===revId){c.reviews[i].archived=false;break;}}
  if(SB_CONFIGURED) sbFetch('reviews?id=eq.'+revId,{method:'PATCH',body:JSON.stringify({archived:false})}).catch(function(){});
  recalcRating(c, true); renderCards(CONFS); renderAdminReviews();
}
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
        'Authorization':'Bearer '+SUPABASE_ANON,
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

/* ── Global keyboard ── */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeModalBtn();closeAdmin();}
});

/* ── Init ── */
loadConferences();

/* ── Init ── */
loadConferences();

