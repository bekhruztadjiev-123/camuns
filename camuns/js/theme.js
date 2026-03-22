/* MUN Central Asia — theme.js */
/* ═══════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════ */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('btn-dark').classList.toggle('active', t==='dark');
  document.getElementById('btn-light').classList.toggle('active',t==='light');
  localStorage.setItem('mun-theme', t);
}
setTheme(localStorage.getItem('mun-theme') || 'dark');
