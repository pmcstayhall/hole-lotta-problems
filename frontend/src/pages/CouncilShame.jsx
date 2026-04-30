const SCORING        = { Severe: 10, Moderate:  5, Minor: 1 }
const REPAIR_SCORING = { Severe: 15, Moderate:  7, Minor: 2 }

const LEADERBOARD = [
  { ward: 13, name: 'Toronto Centre',           councillor: 'Chris Moise',      avgDays: 142,
    potholes:       { Severe: 18, Moderate: 24, Minor: 11 },
    fixedThisWeek:  { Severe:  2, Moderate:  4, Minor:  2 } },
  { ward: 10, name: 'Spadina–Fort York',         councillor: 'Ausma Malik',      avgDays: 127,
    potholes:       { Severe: 15, Moderate: 21, Minor:  9 },
    fixedThisWeek:  { Severe:  1, Moderate:  2, Minor:  1 } },
  { ward:  4, name: 'Parkdale–High Park',        councillor: 'Gord Perks',       avgDays: 118,
    potholes:       { Severe: 14, Moderate: 19, Minor: 13 },
    fixedThisWeek:  { Severe:  0, Moderate:  3, Minor:  2 } },
  { ward: 14, name: 'Toronto–Danforth',          councillor: 'Paula Fletcher',   avgDays: 131,
    potholes:       { Severe: 12, Moderate: 22, Minor:  8 },
    fixedThisWeek:  { Severe:  2, Moderate:  3, Minor:  1 } },
  { ward:  9, name: 'Davenport',                 councillor: 'Alejandra Bravo',  avgDays: 109,
    potholes:       { Severe: 11, Moderate: 18, Minor: 15 },
    fixedThisWeek:  { Severe:  1, Moderate:  2, Minor:  3 } },
  { ward:  5, name: 'York South–Weston',         councillor: 'Frances Nunziata', avgDays:  95,
    potholes:       { Severe: 10, Moderate: 17, Minor: 12 },
    fixedThisWeek:  { Severe:  0, Moderate:  1, Minor:  0 } },
  { ward: 20, name: 'Scarborough Southwest',     councillor: 'Gary Crawford',    avgDays:  88,
    potholes:       { Severe:  9, Moderate: 16, Minor: 14 },
    fixedThisWeek:  { Severe:  1, Moderate:  4, Minor:  2 } },
  { ward:  7, name: 'Humber River–Black Creek',  councillor: 'Anthony Perruzza', avgDays: 103,
    potholes:       { Severe:  8, Moderate: 15, Minor: 11 },
    fixedThisWeek:  { Severe:  0, Moderate:  1, Minor:  1 } },
  { ward:  8, name: 'Eglinton–Lawrence',         councillor: 'Mike Colle',       avgDays:  76,
    potholes:       { Severe:  7, Moderate: 14, Minor: 16 },
    fixedThisWeek:  { Severe:  1, Moderate:  2, Minor:  2 } },
  { ward: 19, name: 'Beaches–East York',         councillor: 'Brad Bradford',    avgDays:  84,
    potholes:       { Severe:  6, Moderate: 13, Minor: 18 },
    fixedThisWeek:  { Severe:  3, Moderate:  5, Minor:  4 } },
]

function calcScore(p) {
  return p.Severe * SCORING.Severe + p.Moderate * SCORING.Moderate + p.Minor * SCORING.Minor
}

function calcTotal(p) {
  return p.Severe + p.Moderate + p.Minor
}

function calcRepairPts(f) {
  return f.Severe * REPAIR_SCORING.Severe + f.Moderate * REPAIR_SCORING.Moderate + f.Minor * REPAIR_SCORING.Minor
}

function shameTag(rank, councillor, wardName, potholes) {
  const last = councillor.split(' ').pop()
  const n = calcTotal(potholes)
  if (rank === 1) return `Toronto's most neglected ward. ${n} potholes — and no end in sight.`
  if (rank === 2) return `Runner-up in road negligence. Congrats, Cllr. ${last}?`
  if (rank === 3) return `${wardName} takes the podium — for pothole inaction.`
  if (rank <= 6) return `${n} unfixed potholes on Cllr. ${last}'s watch. Residents are counting.`
  return `Still on the shame board. ${n} potholes counting the days, Cllr. ${last}.`
}

function redemptionTag(rank, councillor) {
  const last = councillor.split(' ').pop()
  if (rank === 1) return `Redemption arc in progress. Keep it up, Cllr. ${last}.`
  if (rank === 2) return `The repair crews are out — Toronto is taking notice, Cllr. ${last}.`
  return `Showing up for your ward this week, Cllr. ${last}. Toronto is watching.`
}

function tweetUrl(councillor, ward, wardName, sc) {
  const text = `Cllr. ${councillor} – Ward ${ward} (${wardName}) has a Shame Score of ${sc} 🕳️ Toronto's roads are crumbling. Do better. #HoleLottaProblems #Toronto @holelottaproblems`
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
}

const rankBadgeStyle = {
  1: 'bg-red-600 text-white',
  2: 'bg-orange-500 text-white',
  3: 'bg-amber-500 text-white',
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

export default function CouncilShame() {
  const top = LEADERBOARD[0]
  const topScore = calcScore(top.potholes)
  const topRepair = calcRepairPts(top.fixedThisWeek)

  const mostImproved = [...LEADERBOARD]
    .sort((a, b) => calcRepairPts(b.fixedThisWeek) - calcRepairPts(a.fixedThisWeek))
    .slice(0, 3)

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Council Report Card</h1>
        <p className="text-orange-100 text-sm mt-0.5">Holding Toronto's councillors to account</p>
      </header>

      {/* Twitter CTA */}
      <a
        href="https://x.com/holelottaproblems"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-gray-950 px-4 py-3 active:opacity-80 transition-opacity"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white shrink-0" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight">
            @holelottaproblems is posting daily shame at{' '}
            <span className="text-red-400">Cllr. {top.councillor}</span>
          </p>
          <p className="text-gray-400 text-xs">Follow for today's shame report →</p>
        </div>
      </a>

      {/* #1 Most Wanted */}
      <div className="mx-3 mt-3 rounded-2xl border-2 border-red-300 bg-red-50 overflow-hidden">
        <div className="bg-red-600 px-4 py-1.5 flex items-center justify-between">
          <span className="text-white text-xs font-bold tracking-widest uppercase">🚨 #1 Most Wanted</span>
          <span className="text-red-200 text-xs">Ward {top.ward}</span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">{top.name}</p>
          <p className="text-gray-900 text-lg font-bold leading-tight">Cllr. {top.councillor}</p>

          <div className="flex items-end justify-between mt-2">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-red-600">{topScore}</span>
              <span className="text-red-400 text-sm font-semibold mb-1">shame pts</span>
            </div>
            {topRepair > 0 && (
              <span className="text-xs font-semibold text-green-600 bg-green-100 rounded-full px-2.5 py-1">
                ↑ +{topRepair} repair pts this week
              </span>
            )}
          </div>

          <div className="flex gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1 font-medium text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{top.potholes.Severe} severe
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{top.potholes.Moderate} moderate
            </span>
            <span className="flex items-center gap-1 font-medium text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{top.potholes.Minor} minor
            </span>
          </div>

          <p className="text-red-700 text-xs mt-2.5 italic">
            "{shameTag(1, top.councillor, top.name, top.potholes)}"
          </p>

          <a
            href={tweetUrl(top.councillor, top.ward, top.name, topScore)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-950 text-white text-xs font-semibold rounded-lg py-2 active:opacity-80 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post shame at Cllr. {top.councillor.split(' ').pop()}
          </a>
        </div>
      </div>

      {/* #2–10 leaderboard */}
      <div className="mx-3 mt-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Leaderboard — Top 10</span>
          <span className="text-xs text-gray-400">Shame pts = 🔴×10 + 🟡×5 + 🟢×1</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {LEADERBOARD.slice(1).map((entry, i) => {
            const rank = i + 2
            const sc = calcScore(entry.potholes)
            const rp = calcRepairPts(entry.fixedThisWeek)
            const totalFixed = calcTotal(entry.fixedThisWeek)
            return (
              <li key={entry.ward} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${
                      rankBadgeStyle[rank] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 leading-tight">Ward {entry.ward} — {entry.name}</p>
                        <p className="text-sm font-semibold text-gray-900">Cllr. {entry.councillor}</p>
                      </div>
                      <span className="shrink-0 text-lg font-black text-gray-700">{sc}</span>
                    </div>
                    <div className="flex gap-2.5 mt-1 text-xs text-gray-400">
                      <span className="text-red-500 font-medium">{entry.potholes.Severe}×🔴</span>
                      <span className="text-amber-500 font-medium">{entry.potholes.Moderate}×🟡</span>
                      <span className="text-green-600 font-medium">{entry.potholes.Minor}×🟢</span>
                      <span className="ml-auto">avg {entry.avgDays}d open</span>
                    </div>
                    {rp > 0 && (
                      <p className="text-xs text-green-600 font-medium mt-1">
                        🛠 {totalFixed} fixed this week · +{rp} repair pts
                      </p>
                    )}
                    <p className="text-xs text-gray-400 italic mt-1 leading-tight">
                      {shameTag(rank, entry.councillor, entry.name, entry.potholes)}
                    </p>
                    <a
                      href={tweetUrl(entry.councillor, entry.ward, entry.name, sc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1 active:bg-gray-100 transition-colors"
                    >
                      <XIcon /> Post shame
                    </a>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Most Improved This Week */}
      <div className="mx-3 mt-3 mb-3 rounded-2xl border border-green-200 bg-green-50 overflow-hidden">
        <div className="bg-green-600 px-4 py-1.5">
          <span className="text-white text-xs font-bold tracking-widest uppercase">🛠 Most Improved This Week</span>
        </div>
        <div className="px-4 py-2.5 border-b border-green-100">
          <p className="text-xs text-green-700">Repair pts: Severe fix ×15 · Moderate fix ×7 · Minor fix ×2</p>
        </div>
        <ul className="divide-y divide-green-100">
          {mostImproved.map((entry, i) => {
            const rp = calcRepairPts(entry.fixedThisWeek)
            const totalFixed = calcTotal(entry.fixedThisWeek)
            return (
              <li key={entry.ward} className="px-4 py-3 flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-600 leading-tight">Ward {entry.ward} — {entry.name}</p>
                  <p className="text-sm font-semibold text-gray-900">Cllr. {entry.councillor}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg font-black text-green-600">+{rp}</span>
                    <span className="text-xs text-green-600 font-medium">repair pts · {totalFixed} fixed</span>
                  </div>
                  <p className="text-xs text-green-700 italic mt-1 leading-tight">
                    "{redemptionTag(i + 1, entry.councillor)}"
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 mb-1">
        <p className="text-xs text-center text-gray-400">
          Shame Score: Severe (10) · Moderate (5) · Minor (1 pt)
        </p>
        <p className="text-xs text-center text-gray-400 mt-0.5">
          Data is illustrative. Ward boundaries per City of Toronto.
        </p>
      </div>
    </div>
  )
}
