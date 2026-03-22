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
    'Authorization': 'Bearer ' + SUPABASE_ANON,
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

/* ═══════════════════════════════════════════
   LOCAL FALLBACK DATA (shown when Supabase
   is not yet configured)
   ═══════════════════════════════════════════ */
var LOCAL_CONFS = [
  {
    id:1, name:"TashMUN", edition:"V Session", country:"Uzbekistan",
    city:"Tashkent", dates:"April 4\u20136, 2026", status:"open",
    rating:4.4, rating_count:51, delegates:"150\u2013200", language:"English",
    website:"tashmun.uz",
    committees:[
      {abbr:"GA1",    topic:"Cybersecurity norms and state-sponsored cyber warfare",           level:"int"},
      {abbr:"UNHRC",  topic:"Forced displacement and the rights of climate refugees",          level:"beg"},
      {abbr:"UNEP",   topic:"The Aral Sea Basin restoration and regional water governance",    level:"int"},
      {abbr:"SOCHUM", topic:"Child labour in global supply chains: accountability mechanisms",level:"beg"}
    ],
    chairs:[
      {name:"Nilufar Rashidova",role:"Secretary-General",uni:"Westminster International University",initials:"NR"},
      {name:"Bobur Toshmatov",  role:"Deputy SG",         uni:"TUIT",                               initials:"BT"},
      {name:"Kamola Yusupova",  role:"Chair \u2014 GA1",  uni:"WIUT",                               initials:"KY"},
      {name:"Alisher Mirzaev",  role:"Chair \u2014 UNEP", uni:"Turin University in Tashkent",       initials:"AM"}
    ],
    fees:[
      {amount:"$30", type:"Single Delegate",  note:"Standard rate"},
      {amount:"Free",type:"Press Delegate",   note:"Limited spots"},
      {amount:"$55", type:"Double Delegation",note:"Per pair"}
    ],
    deadlines:[
      {label:"Registration Opens",  date:"Jan 15, 2026",passed:true},
      {label:"Regular Registration",date:"Mar 20, 2026",passed:false},
      {label:"Position Papers",     date:"Mar 27, 2026",passed:false},
      {label:"Conference Opens",    date:"Apr 4, 2026", passed:false}
    ],
    secretariat:[
      {role:"Secretary-General", name:"Nilufar Rashidova",contact:"sg@tashmun.uz"},
      {role:"USG Communications",name:"Zulfiya Ergasheva",contact:"info@tashmun.uz"}
    ],
    reviews:[
      {id:101,user:"Amir T.",   initials:"AT",color:"#5c8fe0",role:"Delegate",stars:5,text:"Incredibly well-organised. The UNEP topic was especially relevant and the chairs ran a tight, fair debate.",date:"Oct 2025",archived:false},
      {id:102,user:"Saodat N.",initials:"SN",color:"#5cb88a",role:"Chair",   stars:4,text:"Great first-time chair experience. One star off for the cramped committee room.",                        date:"Oct 2025",archived:false}
    ]
  },
  {
    id:2, name:"SamarkandMUN", edition:"II Session", country:"Uzbekistan",
    city:"Samarkand", dates:"May 17\u201319, 2026", status:"soon",
    rating:4.1, rating_count:22, delegates:"80\u2013120", language:"English / Russian",
    website:"samarkandmun.uz",
    committees:[
      {abbr:"UNSC",  topic:"Multilateral peacekeeping reform and emerging conflict zones",       level:"adv"},
      {abbr:"UNESCO",topic:"Protecting World Heritage Sites in regions of armed conflict",       level:"int"},
      {abbr:"GA2",   topic:"Sustainable tourism and economic diversification in heritage cities",level:"beg"}
    ],
    chairs:[
      {name:"Jasur Qodirov",  role:"Secretary-General",uni:"Samarkand State University",initials:"JQ"},
      {name:"Dildora Holova", role:"Deputy SG",         uni:"SILK ROAD International",  initials:"DH"},
      {name:"Rustam Ergashev",role:"Chair \u2014 UNSC", uni:"SamSU",                    initials:"RE"}
    ],
    fees:[
      {amount:"$25",type:"Single Delegate",  note:"Early bird"},
      {amount:"$45",type:"Double Delegation",note:""},
      {amount:"$15",type:"Observer",         note:"No position paper"}
    ],
    deadlines:[
      {label:"Registration Opens",date:"Mar 15, 2026",passed:false},
      {label:"Deadline",          date:"May 5, 2026", passed:false},
      {label:"Position Papers",   date:"May 10, 2026",passed:false},
      {label:"Conference Opens",  date:"May 17, 2026",passed:false}
    ],
    secretariat:[
      {role:"Secretary-General",name:"Jasur Qodirov",  contact:"sg@samarkandmun.uz"},
      {role:"USG Admin",        name:"Malika Nazarova",contact:"admin@samarkandmun.uz"}
    ],
    reviews:[
      {id:201,user:"Timur B.",initials:"TB",color:"#c9a84c",role:"Observer",stars:4,text:"Young conference with a lot of potential. The Samarkand venue is stunning.",date:"May 2025",archived:false}
    ]
  }
];

var CONFS = [];
