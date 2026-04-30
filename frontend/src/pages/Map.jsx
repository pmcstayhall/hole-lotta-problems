import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  listHazards,
  createHazard,
  voteHazard,
  haversineM,
  nominatimSearch,
  fetchOSRMRoute,
  fetchHazardsAlongRoute,
  getCurrentPosition,
} from '../lib/api'
import { TYPES, TYPE_EMOJI, TYPE_LABEL, severityColor } from '../lib/hazardStyles'
import { markOwnReport, loadFreshOwnReports } from '../lib/ownReports'

const TORONTO_CENTER = [43.6532, -79.3832]
const DEFAULT_ZOOM = 14
const PROXIMITY_THRESHOLD_M = 80   // ask "still there?" within this radius
const VOTED_KEY = 'hlp:votedHazards'
const POLL_INTERVAL_MS = 5000      // refetch hazards from backend at this cadence

function loadVotedIds() {
  try {
    const raw = localStorage.getItem(VOTED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function persistVotedIds(set) {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...set])) } catch {}
}

// --- Marker icons ---
function hazardIcon(hz) {
  const c = severityColor(hz.severity).hex
  return L.divIcon({
    className: '',
    html: `<div class="hazard-emoji" style="color:${c}">${TYPE_EMOJI[hz.type] ?? TYPE_EMOJI.other}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function pulseIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="pulse-icon" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

const userIcon = L.divIcon({
  className: '',
  html: '<div class="user-location-icon"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// --- Imperative map controller (panning/fitting on demand) ---
function MapController({ command }) {
  const map = useMap()
  useEffect(() => {
    if (!command) return
    if (command.type === 'flyTo') {
      map.flyTo(command.center, command.zoom ?? Math.max(map.getZoom(), 16), { duration: 1.2 })
    } else if (command.type === 'fitBounds') {
      map.fitBounds(command.bounds, { padding: [40, 40] })
    }
  }, [command, map])
  return null
}

// --- Locate-me FAB rendered inside the map container ---
function LocateControl({ onLocate }) {
  return (
    <button
      type="button"
      onClick={onLocate}
      aria-label="Show my location"
      className="absolute right-3 bottom-3 z-[1000] w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-blue-600 active:scale-95 transition-transform"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <circle cx="12" cy="12" r="9"></circle>
        <line x1="12" y1="1" x2="12" y2="4"></line>
        <line x1="12" y1="20" x2="12" y2="23"></line>
        <line x1="1" y1="12" x2="4" y2="12"></line>
        <line x1="20" y1="12" x2="23" y2="12"></line>
      </svg>
    </button>
  )
}

// --- Autocomplete input with viewport-biased Nominatim suggestions ---
function AutocompleteInput({
  value, onValueChange, onPick, placeholder, label, viewboxRef, suggestionsAbove = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const seqRef = useRef(0)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(e) {
    const q = e.target.value
    onValueChange(q)
    clearTimeout(debounceRef.current)
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return }
    const seq = ++seqRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await nominatimSearch(q, { viewbox: viewboxRef.current, limit: 5 })
        if (seq !== seqRef.current) return
        setSuggestions(results)
        setActive(-1)
        setOpen(true)
      } catch (err) {
        console.warn('suggestion fetch failed', err)
      }
    }, 350)
  }

  function pick(idx) {
    const hit = suggestions[idx]
    if (!hit) return
    onValueChange(hit.display_name)
    onPick(hit)
    setOpen(false)
    setSuggestions([])
  }

  function handleKey(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 w-4">{label}</span>
        <input
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className={`absolute left-0 right-0 z-[1100] bg-white rounded-lg shadow-xl border border-gray-100 max-h-64 overflow-y-auto ${suggestionsAbove ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {suggestions.map((r, i) => {
            const parts = (r.display_name ?? '').split(', ')
            return (
              <li
                key={`${r.place_id}-${i}`}
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(i) }}
                className={`px-3 py-2 cursor-pointer border-b border-gray-50 last:border-0 ${i === active ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
              >
                <p className="text-sm font-semibold text-gray-800 truncate">{parts[0]}</p>
                {parts.length > 1 && (
                  <p className="text-xs text-gray-500 truncate">{parts.slice(1).join(', ')}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// --- Popup contents shown when a hazard marker is opened ---
function HazardPopupContent({ hazard, hasVoted, onVote, routeMeta }) {
  return (
    <div className="text-sm min-w-[180px]">
      <p className="font-semibold capitalize">{hazard.type}</p>
      <p className="text-xs" style={{ color: severityColor(hazard.severity).hex }}>
        {hazard.severity ?? 'Moderate'}
      </p>
      {routeMeta && <p className="text-xs text-gray-500 mt-1">{routeMeta}</p>}
      {hazard.description && (
        <p className="text-gray-600 text-xs mt-1">{hazard.description}</p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        <span className="text-green-600 font-semibold">{hazard.confirms ?? 0}</span> confirmed ·{' '}
        <span className="text-red-600 font-semibold">{hazard.dismisses ?? 0}</span> dismissed
      </p>
      {hasVoted ? (
        <p className="text-xs text-gray-400 italic mt-2">You voted ✓</p>
      ) : (
        <div className="flex gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => onVote('confirm')}
            className="flex-1 px-2 py-1.5 rounded-md bg-green-50 text-green-700 text-xs font-semibold border border-green-200 active:bg-green-100"
          >
            Still there
          </button>
          <button
            type="button"
            onClick={() => onVote('dismiss')}
            className="flex-1 px-2 py-1.5 rounded-md bg-red-50 text-red-700 text-xs font-semibold border border-red-200 active:bg-red-100"
          >
            Not there
          </button>
        </div>
      )}
    </div>
  )
}

// --- Page ---
export default function Map() {
  const [hazards, setHazards] = useState([])
  const [originText, setOriginText] = useState('')
  const [destText, setDestText] = useState('')
  const [originHit, setOriginHit] = useState(null) // explicit pick; null = use current location
  const [routeCoords, setRouteCoords] = useState(null) // [[lat, lng], ...]
  const [routeHazards, setRouteHazards] = useState([])
  const [userPos, setUserPos] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [mapCmd, setMapCmd] = useState(null)
  const [reporting, setReporting] = useState(false)
  const [confirmedType, setConfirmedType] = useState(null)
  const [confirmedKey, setConfirmedKey] = useState(0)

  // Crowd-validation state
  const [votedIds, setVotedIds] = useState(() => loadVotedIds())
  const [askedIds, setAskedIds] = useState(() => new Set())  // session-only "skipped" set
  const [proximityPrompt, setProximityPrompt] = useState(null) // { hazard, distanceM } | null

  const mapRef = useRef(null)
  const viewboxRef = useRef(null)
  const routeCoordsRef = useRef(null)
  useEffect(() => { routeCoordsRef.current = routeCoords }, [routeCoords])

  // Initial hazard fetch.
  useEffect(() => {
    listHazards().then(setHazards).catch((e) => {
      console.error('hazards fetch failed', e)
      setStatusMsg('Backend unreachable')
    })
  }, [])

  // Background polling so other users' reports and dismissals appear without a
  // page reload. Skips the network call when the tab is hidden, and forces an
  // immediate refresh when it regains focus.
  useEffect(() => {
    let cancelled = false

    async function refresh() {
      if (document.hidden) return
      try {
        const list = await listHazards()
        if (cancelled) return
        setHazards(list)
        if (routeCoordsRef.current) {
          const hits = await fetchHazardsAlongRoute(routeCoordsRef.current)
          if (!cancelled) setRouteHazards(hits)
        }
      } catch (err) {
        // Quiet: don't toast on each transient failure.
        console.warn('poll refresh failed', err.message)
      }
    }

    const intervalId = setInterval(refresh, POLL_INTERVAL_MS)
    function onVisibility() { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Geolocation: one fast low-accuracy fix on mount + a continuous watch.
  // The one-shot fix matters because watchPosition with high accuracy can
  // take many seconds to push its first reading — until then, userPos stays
  // null and the proximity effect can't run.
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('initial geolocation failed', err.message),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8000 },
    )
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('watchPosition error', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Proximity detection — show the "still there?" prompt for the nearest
  // unanswered hazard, *unless* this device authored the hazard within the
  // last 24h (read from localStorage on each tick so cross-route reports
  // from /report take effect immediately on return).
  useEffect(() => {
    if (!userPos || proximityPrompt) return
    const ownIds = loadFreshOwnReports()
    let nearest = null
    let nearestSkipReason = null
    let nearestSkipDistance = Infinity
    for (const hz of hazards) {
      const d = haversineM(userPos[0], userPos[1], hz.lat, hz.lng)
      const inRange = d <= PROXIMITY_THRESHOLD_M
      let reason = null
      if (votedIds.has(hz.id)) reason = 'voted'
      else if (askedIds.has(hz.id)) reason = 'skipped'
      else if (ownIds.has(hz.id)) reason = 'own report (24h)'
      if (reason) {
        if (inRange && d < nearestSkipDistance) {
          nearestSkipReason = `${reason} for ${hz.type} ${Math.round(d)}m away`
          nearestSkipDistance = d
        }
        continue
      }
      if (inRange && (!nearest || d < nearest.distanceM)) {
        nearest = { hazard: hz, distanceM: d }
      }
    }
    if (nearest) {
      setProximityPrompt(nearest)
    } else if (nearestSkipReason) {
      // Helpful when a developer is wondering why no prompt is showing.
      console.debug('[proximity] in-range hazard suppressed:', nearestSkipReason)
    }
  }, [userPos, hazards, votedIds, askedIds, proximityPrompt])

  // Close the quick-report modal on Escape.
  useEffect(() => {
    if (!confirmedType) return
    const t = setTimeout(() => setConfirmedType(null), 2500)
    return () => clearTimeout(t)
  }, [confirmedType])

  function markVoted(id) {
    setVotedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      persistVotedIds(next)
      return next
    })
  }

  async function castVote(id, vote) {
    try {
      const updated = await voteHazard(id, vote)
      markVoted(id)
      setHazards((prev) => {
        if (updated.visible === false) return prev.filter((h) => h.id !== id)
        return prev.map((h) =>
          h.id === id ? { ...h, confirms: updated.confirms, dismisses: updated.dismisses } : h,
        )
      })
      setRouteHazards((prev) => {
        if (updated.visible === false) return prev.filter((h) => h.hazard.id !== id)
        return prev.map((h) =>
          h.hazard.id === id
            ? { ...h, hazard: { ...h.hazard, confirms: updated.confirms, dismisses: updated.dismisses } }
            : h,
        )
      })
    } catch (err) {
      setStatusMsg(err.message ?? 'Vote failed')
    }
  }

  function skipPrompt() {
    if (!proximityPrompt) return
    setAskedIds((prev) => {
      const next = new Set(prev)
      next.add(proximityPrompt.hazard.id)
      return next
    })
    setProximityPrompt(null)
  }

  async function votePrompt(vote) {
    if (!proximityPrompt) return
    const id = proximityPrompt.hazard.id
    // Pre-mark synchronously so the proximity effect doesn't re-pop the prompt
    // for this same hazard while the vote POST is in flight.
    markVoted(id)
    setProximityPrompt(null)
    await castVote(id, vote)
  }

  function onMapReady(map) {
    mapRef.current = map
    refreshViewbox()
    map.on('moveend', refreshViewbox)
  }

  function refreshViewbox() {
    if (!mapRef.current) return
    const b = mapRef.current.getBounds()
    viewboxRef.current = `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`
  }

  async function resolveOrigin() {
    if (originHit) {
      return { lat: parseFloat(originHit.lat), lng: parseFloat(originHit.lon), source: 'explicit' }
    }
    const text = originText.trim()
    if (text) {
      try {
        const arr = await nominatimSearch(text, { viewbox: viewboxRef.current, limit: 1 })
        if (arr[0]) {
          setOriginHit(arr[0])
          return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon), source: 'explicit' }
        }
      } catch { /* fall through */ }
    }
    const p = await getCurrentPosition({ timeoutMs: 5000 })
    if (p.source !== 'geo') {
      setStatusMsg('Using map centre as origin')
      const c = mapRef.current?.getCenter() ?? { lat: TORONTO_CENTER[0], lng: TORONTO_CENTER[1] }
      return { lat: c.lat, lng: c.lng, source: 'map' }
    }
    return p
  }

  async function runRoute(destHit) {
    setStatusMsg('Routing…')
    const origin = await resolveOrigin()
    const destLat = parseFloat(destHit.lat), destLng = parseFloat(destHit.lon)
    let route
    try {
      route = await fetchOSRMRoute(origin.lat, origin.lng, destLat, destLng)
    } catch (err) {
      setStatusMsg('Routing unavailable')
      return
    }
    const latlng = route.coords.map(([lng, lat]) => [lat, lng])
    setRouteCoords(latlng)
    setStatusMsg(route.source === 'canned' ? 'Showing cached route' : '')
    setMapCmd({ type: 'fitBounds', bounds: L.latLngBounds(latlng), key: Date.now() })
    try {
      const hits = await fetchHazardsAlongRoute(latlng)
      setRouteHazards(hits)
    } catch (err) {
      console.error('route hazards failed', err)
      setRouteHazards([])
    }
  }

  function clearRoute() {
    setRouteCoords(null)
    setRouteHazards([])
    setStatusMsg('')
    setDestText('')
  }

  async function quickReport(type) {
    if (reporting) return
    setReporting(true)
    setStatusMsg('Reporting…')
    try {
      const p = await getCurrentPosition({ timeoutMs: 3000 })
      let lat, lng
      if (p.source === 'geo') {
        lat = p.lat; lng = p.lng
      } else {
        const c = mapRef.current?.getCenter() ?? { lat: TORONTO_CENTER[0], lng: TORONTO_CENTER[1] }
        lat = c.lat; lng = c.lng
      }
      const hz = await createHazard({ lat, lng, type, severity: 'Moderate', description: '' })
      markOwnReport(hz.id)  // suppresses self-prompts for 24h
      setHazards((prev) => [...prev, hz])
      // Show the success modal *after* the POST succeeds: avoids flashing if
      // geolocation is slow, and stays correct on errors.
      setConfirmedKey((k) => k + 1)  // force re-mount so the SVG animation replays
      setConfirmedType(type)
      setStatusMsg('')
      if (navigator.vibrate) navigator.vibrate(150)
    } catch (err) {
      setStatusMsg(err.message ?? 'Report failed')
    } finally {
      setReporting(false)
    }
  }

  async function locateMe() {
    setStatusMsg('Locating…')
    const p = await getCurrentPosition({ timeoutMs: 8000 })
    if (p.source !== 'geo') {
      setStatusMsg('Location unavailable')
      return
    }
    setUserPos([p.lat, p.lng])
    setMapCmd({ type: 'flyTo', center: [p.lat, p.lng], zoom: 16, key: Date.now() })
    setStatusMsg('Showing your location')
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Pothole Map</h1>
        <p className="text-orange-100 text-sm mt-0.5">
          {hazards.length} report{hazards.length === 1 ? '' : 's'} in your neighbourhood
        </p>
      </header>

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 bg-white border-b border-gray-100 space-y-2">
        <AutocompleteInput
          label="A"
          value={originText}
          onValueChange={(v) => { setOriginText(v); setOriginHit(null) }}
          onPick={(hit) => setOriginHit(hit)}
          placeholder="From: current location"
          viewboxRef={viewboxRef}
        />
        <AutocompleteInput
          label="B"
          value={destText}
          onValueChange={setDestText}
          onPick={(hit) => runRoute(hit)}
          placeholder="To: search a destination…"
          viewboxRef={viewboxRef}
        />
        {(routeCoords || statusMsg) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">{statusMsg || `Route active`}</span>
            {routeCoords && (
              <button
                type="button"
                onClick={clearRoute}
                className="text-orange-600 font-semibold active:opacity-70"
              >
                Clear route
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-96 relative">
        <MapContainer
          center={TORONTO_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          whenReady={(e) => onMapReady(e.target)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />

          {hazards.map((hz) => (
            <Marker key={hz.id} position={[hz.lat, hz.lng]} icon={hazardIcon(hz)}>
              <Popup>
                <HazardPopupContent
                  hazard={hz}
                  hasVoted={votedIds.has(hz.id)}
                  onVote={(v) => castVote(hz.id, v)}
                />
              </Popup>
            </Marker>
          ))}

          {routeCoords && (
            <Polyline positions={routeCoords} pathOptions={{ color: '#f97316', weight: 5, opacity: 0.8 }} />
          )}

          {routeHazards.map((h) => (
            <Marker
              key={`rh-${h.hazard.id}`}
              position={[h.hazard.lat, h.hazard.lng]}
              icon={pulseIcon(severityColor(h.hazard.severity).hex)}
            >
              <Popup>
                <HazardPopupContent
                  hazard={h.hazard}
                  hasVoted={votedIds.has(h.hazard.id)}
                  onVote={(v) => castVote(h.hazard.id, v)}
                  routeMeta={`${Math.round(h.distanceAlongRouteM)} m along · ${Math.round(h.perpendicularDistanceM)} m off`}
                />
              </Popup>
            </Marker>
          ))}

          {userPos && <Marker position={userPos} icon={userIcon} interactive={false} />}

          <MapController command={mapCmd} />
        </MapContainer>

        <LocateControl onLocate={locateMe} />
      </div>

      {/* Severity legend */}
      <div className="flex gap-4 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
        {['Severe', 'Moderate', 'Minor'].map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: severityColor(s).hex }} />
            {s}
          </span>
        ))}
        {userPos && (
          <span className="flex items-center gap-1 ml-auto">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
            You
          </span>
        )}
      </div>

      {/* Route hazards list (only when a route is active) */}
      {routeCoords && (
        <div className="bg-white border-b border-gray-100">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              On Your Route
            </span>
            <span className="text-xs text-gray-400">
              {routeHazards.length} hazard{routeHazards.length === 1 ? '' : 's'} within 50 m
            </span>
          </div>
          {routeHazards.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400 italic">Clear road ahead.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {routeHazards.map((h) => (
                <li key={h.hazard.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xl shrink-0">{TYPE_EMOJI[h.hazard.type] ?? TYPE_EMOJI.other}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{h.hazard.type}</p>
                    <p className="text-xs" style={{ color: severityColor(h.hazard.severity).hex }}>
                      {h.hazard.severity ?? 'Moderate'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{Math.round(h.distanceAlongRouteM)} m</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Quick-report panel */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <p className="text-base font-bold text-gray-800 mb-2">Report a hazard</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => quickReport(t)}
              disabled={reporting}
              className="flex flex-col items-center gap-0.5 py-2 rounded-lg border-t-2 bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60"
              style={{ borderTopColor: severityColor('Moderate').hex }}
            >
              <span className="text-xl leading-none">{TYPE_EMOJI[t]}</span>
              <span className="text-xs font-medium text-gray-700">{TYPE_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {confirmedType && (
        <div key={confirmedKey} className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmedType(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-4 w-full max-w-xs">
            <div className="check-circle-anim">
              <svg width="88" height="88" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="25" fill="#dcfce7" stroke="#22c55e" strokeWidth="1.5" />
                <path
                  className="check-path-anim"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 27 L22 35 L38 17"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-800 text-center capitalize">
              {confirmedType} successfully reported!
            </p>
          </div>
        </div>
      )}

      {/* Waze-style proximity prompt: pops when you drive within ~80m of an unanswered hazard. */}
      {proximityPrompt && (
        <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={skipPrompt} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div
              className="px-4 py-3 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-between"
              style={{ background: severityColor(proximityPrompt.hazard.severity).hex }}
            >
              <span>You're nearby — is it still there?</span>
              <button
                type="button"
                aria-label="Skip"
                onClick={skipPrompt}
                className="text-white/80 active:text-white text-base leading-none"
              >×</button>
            </div>
            <div className="px-4 py-4 flex items-start gap-3">
              <span className="text-3xl shrink-0 leading-none">{TYPE_EMOJI[proximityPrompt.hazard.type] ?? TYPE_EMOJI.other}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold capitalize text-gray-900">{proximityPrompt.hazard.type}</p>
                <p
                  className="text-xs font-medium"
                  style={{ color: severityColor(proximityPrompt.hazard.severity).hex }}
                >
                  {proximityPrompt.hazard.severity ?? 'Moderate'} · {Math.round(proximityPrompt.distanceM)} m away
                </p>
                {proximityPrompt.hazard.description && (
                  <p className="text-xs text-gray-600 mt-1">{proximityPrompt.hazard.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {proximityPrompt.hazard.confirms ?? 0} confirmed · {proximityPrompt.hazard.dismisses ?? 0} dismissed
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-100">
              <button
                type="button"
                onClick={() => votePrompt('dismiss')}
                className="bg-white py-3 text-sm font-semibold text-red-600 active:bg-red-50"
              >
                Nope, gone
              </button>
              <button
                type="button"
                onClick={() => votePrompt('confirm')}
                className="bg-white py-3 text-sm font-semibold text-green-600 active:bg-green-50"
              >
                Yes, still there
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
