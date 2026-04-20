/* MUN Central Asia — config.js */
/* ═══════════════════════════════════════════
   SUPABASE CONFIG
   Replace these two values with your own from
   supabase.com → Project Settings → API
   ═══════════════════════════════════════════ */
var SUPABASE_URL  = 'https://sjbwvsqlsjdqpawwrsse.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYnd2c3Fsc2pkcXBhd3dyc3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTEyOTYsImV4cCI6MjA4OTc2NzI5Nn0.bB_zmpDi3khBiTHPMAjO4N4_OAUH_i9AjreqCeZwOFQ';
var SB_CONFIGURED = (SUPABASE_URL !== 'YOUR_SUPABASE_URL');

/* Supabase REST helper */
function sbFetch(path, opts) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var method = (opts && opts.method) ? opts.method : 'GET';
  var body   = (opts && opts.body)   ? opts.body   : undefined;
  var headers = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + ((window.__sbAccessToken && window.__sbAccessToken.length) ? window.__sbAccessToken : SUPABASE_ANON),
    'Content-Type':  'application/json',
    'Prefer':        'return=representation'
  };
  if (opts && opts.headers) {
    for (var k in opts.headers) headers[k] = opts.headers[k];
  }
  var fetchOpts = { method: method, headers: headers };
  if (body !== undefined) fetchOpts.body = body;
  return fetch(url, fetchOpts);
}

/* LOCAL_CONFS is defined in data/fallback.js */
/* CONFS is defined in js/db.js */
