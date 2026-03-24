/* MUN Central Asia — Local fallback data (shown when Supabase is offline) */
var LOCAL_CONFS = [
  {
    id: 1, name: "TashMUN", edition: "VI Session", country: "Uzbekistan",
    city: "Tashkent", dates: "March 5–7, 2026", status: "soon",
    rating: 4.6, rating_count: 85, delegates: "200–250", language: "English",
    website: "tashmun.uz",
    committees: [
      { abbr: "GA1", topic: "Cybersecurity norms and state-sponsored cyber warfare", level: "int" },
      { abbr: "UNEP", topic: "The Aral Sea Basin restoration and regional water governance", level: "int" },
      { abbr: "SOCHUM", topic: "Child labour in global supply chains: accountability mechanisms", level: "beg" }
    ],
    chairs: [
      { name: "Nilufar Rashidova", role: "Secretary-General", uni: "Westminster International University", initials: "NR" },
      { name: "Bobur Toshmatov", role: "Deputy SG", uni: "TUIT", initials: "BT" },
      { name: "Kamola Yusupova", role: "Chair — GA1", uni: "WIUT", initials: "KY" }
    ],
    fees: [
      { amount: "$30", type: "Single Delegate", note: "Standard rate" },
      { amount: "$55", type: "Double Delegation", note: "Per pair" }
    ],
    deadlines: [
      { label: "Registration Opens", date: "Jan 10, 2026", passed: true },
      { label: "Regular Registration", date: "Feb 15, 2026", passed: false },
      { label: "Conference Opens", date: "Mar 5, 2026", passed: false }
    ],
    secretariat: [
      { role: "Secretary-General", name: "Nilufar Rashidova", contact: "sg@tashmun.uz" }
    ],
    reviews: [
      { id: 101, user: "Amir T.", initials: "AT", color: "#6b5ce0", role: "Delegate", stars: 4, text: "Very engaging debates, but the closing ceremony ran a bit too long.", date: "Mar 2025", archived: false }
    ]
  },
  {
    id: 2, name: "Silk Road MUN", edition: "II Session", country: "Uzbekistan",
    city: "Samarkand", dates: "May 15–17, 2026", status: "soon",
    rating: 4.2, rating_count: 34, delegates: "100–120", language: "English / Russian",
    website: "silkroadmun.uz",
    committees: [
      { abbr: "UNESCO", topic: "Protecting World Heritage Sites in regions of armed conflict", level: "int" },
      { abbr: "GA2", topic: "Sustainable tourism and economic diversification in heritage cities", level: "beg" }
    ],
    chairs: [
      { name: "Jasur Qodirov", role: "Secretary-General", uni: "Samarkand State University", initials: "JQ" }
    ],
    fees: [
      { amount: "$25", type: "Single Delegate", note: "Includes cultural tour" },
      { amount: "$15", type: "Observer", note: "Access to sessions" }
    ],
    deadlines: [
      { label: "Registration Opens", date: "Feb 1, 2026", passed: true },
      { label: "Registration Closes", date: "May 1, 2026", passed: false }
    ],
    secretariat: [
      { role: "Secretary-General", name: "Jasur Qodirov", contact: "sg@silkroadmun.uz" }
    ],
    reviews: [
      { id: 201, user: "Timur B.", initials: "TB", color: "#c9a84c", role: "Observer", stars: 5, text: "Beautiful venue and great focus on regional history. Highly recommend the UNESCO committee.", date: "May 2025", archived: false }
    ]
  },
  {
    id: 3, name: "Bukhara Model UN", edition: "I Session", country: "Uzbekistan",
    city: "Bukhara", dates: "September 10–12, 2026", status: "open",
    rating: 0, rating_count: 0, delegates: "80–100", language: "English",
    website: "bukharamun.uz",
    committees: [
      { abbr: "UNWTO", topic: "Promoting sustainable tourism in historic trade routes", level: "beg" },
      { abbr: "UNSC", topic: "Addressing non-state actors in modern asymmetrical warfare", level: "adv" }
    ],
    chairs: [
      { name: "Malika Asatova", role: "Secretary-General", uni: "Bukhara State University", initials: "MA" },
      { name: "Farrukh Rakhimov", role: "Chair — UNSC", uni: "BSU", initials: "FR" }
    ],
    fees: [
      { amount: "$20", type: "Single Delegate", note: "Early Bird" },
      { amount: "$35", type: "Single Delegate", note: "Late Registration" }
    ],
    deadlines: [
      { label: "Early Registration", date: "July 1, 2026", passed: false },
      { label: "Late Registration", date: "Aug 15, 2026", passed: false }
    ],
    secretariat: [
      { role: "Secretary-General", name: "Malika Asatova", contact: "info@bukharamun.uz" }
    ],
    reviews: []
  },
  {
    id: 4, name: "Fergana Valley MUN", edition: "III Session", country: "Uzbekistan",
    city: "Fergana", dates: "October 2–4, 2026", status: "open",
    rating: 4.8, rating_count: 56, delegates: "150–200", language: "English / Uzbek",
    website: "fvmun.uz",
    committees: [
      { abbr: "ECOSOC", topic: "Agricultural innovation and food security in landlocked regions", level: "int" },
      { abbr: "WHO", topic: "Preventative healthcare access in border communities", level: "beg" }
    ],
    chairs: [
      { name: "Sardor Yusupov", role: "Secretary-General", uni: "Fergana State University", initials: "SY" },
      { name: "Alina Khasanova", role: "Chair — WHO", uni: "Fergana Med", initials: "AK" }
    ],
    fees: [
      { amount: "150,000 UZS", type: "Local Delegate", note: "Citizens of Uzbekistan" },
      { amount: "$30", type: "Int. Delegate", note: "International rate" }
    ],
    deadlines: [
      { label: "Registration Opens", date: "Jul 15, 2026", passed: false },
      { label: "Position Papers Due", date: "Sep 20, 2026", passed: false }
    ],
    secretariat: [
      { role: "Secretary-General", name: "Sardor Yusupov", contact: "sg@fvmun.uz" },
      { role: "USG Delegates", name: "Dilnoza Vokhidova", contact: "delegates@fvmun.uz" }
    ],
    reviews: [
      { id: 401, user: "Elena P.", initials: "EP", color: "#e05c5c", role: "Delegate", stars: 5, text: "The agricultural topics in ECOSOC were handled with amazing depth. Great experience.", date: "Oct 2025", archived: false }
    ]
  },
  {
    id: 5, name: "WIUT Int. MUN", edition: "IX Session", country: "Uzbekistan",
    city: "Tashkent", dates: "November 14–16, 2026", status: "open",
    rating: 4.9, rating_count: 142, delegates: "350–400", language: "English",
    website: "wimun.uz",
    committees: [
      { abbr: "Crisis", topic: "The 1973 Oil Crisis: OAPEC and the Global Economy", level: "adv" },
      { abbr: "UNHRC", topic: "Rights of migrant workers in infrastructure mega-projects", level: "int" },
      { abbr: "Historical GA", topic: "The Partition of India (1947)", level: "adv" }
    ],
    chairs: [
      { name: "Javokhir Abdullaev", role: "Secretary-General", uni: "WIUT", initials: "JA" },
      { name: "Sevara Kadirova", role: "Crisis Director", uni: "WIUT", initials: "SK" }
    ],
    fees: [
      { amount: "$45", type: "Delegate", note: "Includes all socials" },
      { amount: "$80", type: "Double Delegation", note: "Per pair" }
    ],
    deadlines: [
      { label: "Delegate Applications Open", date: "Sep 1, 2026", passed: false },
      { label: "Final Deadline", date: "Nov 1, 2026", passed: false }
    ],
    secretariat: [
      { role: "Secretary-General", name: "Javokhir Abdullaev", contact: "sg@wimun.uz" }
    ],
    reviews: [
      { id: 501, user: "Rustam K.", initials: "RK", color: "#5ca7e0", role: "Chair", stars: 5, text: "WIMUN remains the gold standard for debate quality in the country.", date: "Nov 2025", archived: false }
    ]
  }
];
