/* MUN Central Asia — helpers.js */
/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function starsStr(n) {
  var s=''; for(var i=0;i<5;i++) s += i<n?'\u2605':'\u2606'; return s;
}
function levelCls(l){return l==='adv'?'level-adv':l==='int'?'level-int':'level-beg';}
function levelLbl(l){return l==='adv'?'Advanced':l==='int'?'Intermediate':'Beginner';}
function pal(s){var c=['#5c8fe0','#5cb88a','#c9a84c','#e05c5c','#9b5ce0','#5cd4e0'];var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%c.length;return c[h];}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function overlayClick(e,id,fn){if(e.target===document.getElementById(id))window[fn]();}
