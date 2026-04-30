const LEVELS = [
  { name: 'Pothole Spotter', emoji: '🔍', min: 0,    max: 249,        colour: 'text-gray-500',   bg: 'bg-gray-100',   bar: 'bg-gray-400'   },
  { name: 'Road Scout',      emoji: '🛡️', min: 250,  max: 499,        colour: 'text-blue-600',   bg: 'bg-blue-50',    bar: 'bg-blue-500'   },
  { name: 'Road Ranger',     emoji: '⭐', min: 500,  max: 999,        colour: 'text-green-600',  bg: 'bg-green-50',   bar: 'bg-green-500'  },
  { name: 'Road Warrior',    emoji: '🏆', min: 1000, max: 2499,       colour: 'text-orange-600', bg: 'bg-orange-50',  bar: 'bg-orange-500' },
  { name: 'City Fixer',      emoji: '🦸', min: 2500, max: Infinity,   colour: 'text-red-600',    bg: 'bg-red-50',     bar: 'bg-red-500'    },
]

function getLevel(pts) {
  return LEVELS.find(l => pts >= l.min && pts <= l.max) ?? LEVELS[0]
}

function getNextLevel(pts) {
  return LEVELS.find(l => l.min > pts) ?? null
}

const USER = {
  totalPts: 485,
  weeklyPts: 85,
  weeklyReports: 5,
  weeklyFixed: 2,
  streak: 3,
}

const EARN_RATES = [
  { label: 'Submit a report',          pts:  5, icon: '📍' },
  { label: 'Minor pothole fixed',      pts: 10, icon: '🟢' },
  { label: 'Moderate pothole fixed',   pts: 25, icon: '🟡' },
  { label: 'Severe pothole fixed',     pts: 50, icon: '🔴' },
]

const FIXED_THIS_WEEK = [
  { id: 1, address: 'Yonge St & Dundas St W',  severity: 'Severe',   daysAgo: 2, mine: true,  pts: 50 },
  { id: 2, address: 'College St & Bathurst St', severity: 'Moderate', daysAgo: 3, mine: false, reporter: '@PotholeHero99' },
  { id: 3, address: 'King St E & Jarvis St',    severity: 'Moderate', daysAgo: 4, mine: true,  pts: 25 },
  { id: 4, address: 'Spadina Ave & Front St W', severity: 'Minor',    daysAgo: 5, mine: false, reporter: '@TorontoFixer' },
  { id: 5, address: 'Queen St W & Bathurst St', severity: 'Moderate', daysAgo: 5, mine: false, reporter: '@RoadWatcher22' },
  { id: 6, address: 'Bloor St E & Bay St',      severity: 'Minor',    daysAgo: 6, mine: false, reporter: '@CityEagle' },
]

const WEEKLY_LEADERS = [
  { handle: '@PotholeHero99', pts: 320, fixed: 8, isUser: false },
  { handle: '@TorontoFixer',  pts: 215, fixed: 5, isUser: false },
  { handle: '@CityEagle',     pts: 175, fixed: 4, isUser: false },
  { handle: 'You',            pts:  85, fixed: 2, isUser: true  },
  { handle: '@RoadWatcher22', pts:  72, fixed: 2, isUser: false },
]

const severityColour = {
  Severe:   'text-red-500',
  Moderate: 'text-amber-500',
  Minor:    'text-green-600',
}

const rankMedal = ['🥇', '🥈', '🥉']

export default function Rewards() {
  const level = getLevel(USER.totalPts)
  const nextLevel = getNextLevel(USER.totalPts)
  const progressPct = nextLevel
    ? Math.round(((USER.totalPts - level.min) / (nextLevel.min - level.min)) * 100)
    : 100
  const ptsToNext = nextLevel ? nextLevel.min - USER.totalPts : 0

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Your Rewards</h1>
        <p className="text-orange-100 text-sm mt-0.5">Earn points every time a pothole gets fixed</p>
      </header>

      {/* Profile card */}
      <div className="mx-3 mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${level.bg} ${level.colour}`}>
                {level.emoji} {level.name}
              </span>
              <div className="flex items-end gap-1.5 mt-2">
                <span className="text-4xl font-black text-gray-900">{USER.totalPts.toLocaleString()}</span>
                <span className="text-gray-400 font-medium mb-1">pts total</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">This week</p>
              <p className="text-2xl font-bold text-orange-500">+{USER.weeklyPts}</p>
              <p className="text-xs text-gray-400">{USER.weeklyFixed} potholes fixed</p>
            </div>
          </div>

          {nextLevel && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{level.emoji} {level.name}</span>
                <span>{nextLevel.emoji} {nextLevel.name}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${level.bar}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Only{' '}
                <span className="font-bold text-gray-800">{ptsToNext} pts</span>
                {' '}until you reach {nextLevel.emoji} <span className="font-semibold">{nextLevel.name}</span>
              </p>
            </div>
          )}

          <div className="flex gap-0 mt-3 pt-3 border-t border-gray-100 divide-x divide-gray-100">
            <div className="flex-1 text-center">
              <p className="text-xl font-bold text-gray-900">{USER.weeklyFixed}</p>
              <p className="text-xs text-gray-400">fixed<br />this week</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xl font-bold text-gray-900">{USER.weeklyReports}</p>
              <p className="text-xs text-gray-400">reports<br />filed</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xl font-bold text-orange-500">🔥 {USER.streak}</p>
              <p className="text-xs text-gray-400">week<br />streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to earn */}
      <div className="mx-3 mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">How to Earn Points</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
          {EARN_RATES.map(({ label, pts, icon }) => (
            <div key={label} className="px-3 py-3 flex items-center gap-2.5">
              <span className="text-xl shrink-0">{icon}</span>
              <div>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
                <p className="text-sm font-bold text-orange-500">+{pts} pts</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed this week */}
      <div className="mx-3 mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fixed This Week</span>
          <span className="text-xs text-gray-400">{FIXED_THIS_WEEK.length} potholes city-wide</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {FIXED_THIS_WEEK.map((fix) => (
            <li
              key={fix.id}
              className={`px-4 py-3 flex items-start gap-3 ${fix.mine ? 'bg-green-50' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className={`w-4 h-4 shrink-0 mt-0.5 ${fix.mine ? 'text-green-500' : 'text-gray-300'}`}>
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{fix.address}</p>
                <p className={`text-xs font-medium ${severityColour[fix.severity]}`}>{fix.severity}</p>
                {fix.mine
                  ? <p className="text-xs text-green-600 font-semibold mt-0.5">Your report · +{fix.pts} pts earned</p>
                  : <p className="text-xs text-gray-400 mt-0.5">Reported by {fix.reporter}</p>
                }
              </div>
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                {fix.daysAgo === 1 ? 'Yesterday' : `${fix.daysAgo}d ago`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Community leaderboard */}
      <div className="mx-3 mt-3 mb-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">This Week's Top Reporters</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {WEEKLY_LEADERS.map((leader, i) => (
            <li
              key={leader.handle}
              className={`flex items-center gap-3 px-4 py-3 ${leader.isUser ? 'bg-orange-50' : ''}`}
            >
              <span className="w-6 text-center text-sm shrink-0">
                {rankMedal[i] ?? <span className="text-xs font-bold text-gray-400">#{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${leader.isUser ? 'text-orange-600' : 'text-gray-800'}`}>
                  {leader.handle}
                </p>
                <p className="text-xs text-gray-400">{leader.fixed} pothole{leader.fixed !== 1 ? 's' : ''} fixed</p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${leader.isUser ? 'text-orange-500' : 'text-gray-600'}`}>
                +{leader.pts} pts
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
