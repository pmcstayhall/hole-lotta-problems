const SHAME_LIST = [
  {
    id: 1,
    rank: 1,
    name: 'The Gardiner Graveyard',
    address: 'Lake Shore Blvd W & Spadina Ave',
    neighbourhood: 'Fort York',
    reports: 52,
    severity: 'Severe',
    daysOpen: 341,
  },
  {
    id: 2,
    rank: 2,
    name: 'The Dufferin Ditch',
    address: 'Dufferin St & Bloor St W',
    neighbourhood: 'Dovercourt',
    reports: 38,
    severity: 'Severe',
    daysOpen: 214,
  },
  {
    id: 3,
    rank: 3,
    name: 'The Jarvis Jaws',
    address: 'Jarvis St & Carlton St',
    neighbourhood: 'Cabbagetown',
    reports: 27,
    severity: 'Moderate',
    daysOpen: 178,
  },
  {
    id: 4,
    rank: 4,
    name: 'Kingston Krater',
    address: 'Kingston Rd & Victoria Park Ave',
    neighbourhood: 'Upper Beaches',
    reports: 21,
    severity: 'Severe',
    daysOpen: 96,
  },
  {
    id: 5,
    rank: 5,
    name: 'The Eglinton Enigma',
    address: 'Eglinton Ave W & Allen Rd',
    neighbourhood: 'Fairbank',
    reports: 17,
    severity: 'Moderate',
    daysOpen: 73,
  },
]

const rankEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' }

const severityBadge = {
  Severe: 'bg-red-100 text-red-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  Minor: 'bg-green-100 text-green-700',
}

export default function HallOfShame() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Hall of Shame</h1>
        <p className="text-orange-100 text-sm mt-0.5">Toronto's worst offenders</p>
      </header>

      <ul className="flex-1 divide-y divide-gray-100 bg-white">
        {SHAME_LIST.map((hole) => (
          <li key={hole.id} className="px-4 py-4 flex items-start gap-3">
            <div className="text-2xl w-8 text-center shrink-0 mt-0.5">
              {rankEmoji[hole.rank] ?? (
                <span className="text-base font-bold text-gray-400">#{hole.rank}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 text-sm">{hole.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[hole.severity]}`}>
                  {hole.severity}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{hole.address}</p>
              <p className="text-xs text-gray-400 truncate">{hole.neighbourhood}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                <span>{hole.reports} reports</span>
                <span>·</span>
                <span>Open {hole.daysOpen} days</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-center text-gray-400">Updated daily · Data sourced from City of Toronto 311</p>
      </div>
    </div>
  )
}
