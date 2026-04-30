import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  listHazards,
  createHazard,
  nominatimSearch,
  fetchOSRMRoute,
  fetchHazardsAlongRoute,
  getCurrentPosition,
} from '../lib/api'
import { TYPES, TYPE_EMOJI, TYPE_LABEL, severityColor } from '../lib/hazardStyles'

const TORONTO_CENTER = [43.6532, -79.3832]
const DEFAULT_ZOOM = 14

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
  const [reportOpen, setReportOpen] = useState(false)
  const [reporting, setReporting] = useState(false)

  const mapRef = useRef(null)
  const viewboxRef = useRef(null)

  // Initial: fetch hazards + try silent geolocation.
  useEffect(() => {
    listHazards().then(setHazards).catch((e) => {
      console.error('hazards fetch failed', e)
      setStatusMsg('Backend unreachable')
    })

    getCurrentPosition({ timeoutMs: 8000 }).then((p) => {
      if (p.source === 'geo') setUserPos([p.lat, p.lng])
    })
  }, [])

  // Close the quick-report modal on Escape.
  useEffect(() => {
    if (!reportOpen) return
    function onKey(e) { if (e.key === 'Escape') setReportOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [reportOpen])

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
    setReportOpen(false)
    setReporting(true)
    setStatusMsg('Reporting…')
    try {
      const p = await getCurrentPosition({ timeoutMs: 5000 })
      let lat, lng, fellBack = false
      if (p.source === 'geo') {
        lat = p.lat; lng = p.lng
      } else {
        const c = mapRef.current?.getCenter() ?? { lat: TORONTO_CENTER[0], lng: TORONTO_CENTER[1] }
        lat = c.lat; lng = c.lng; fellBack = true
      }
      const hz = await createHazard({ lat, lng, type, severity: 'Moderate', description: '' })
      setHazards((prev) => [...prev, hz])
      if (navigator.vibrate) navigator.vibrate(150)
      setStatusMsg(fellBack ? `Reported ${type} at map centre` : `Reported ${type}`)
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
      <div className="h-72 relative">
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
                <div className="text-sm">
                  <p className="font-semibold capitalize">{hz.type}</p>
                  <p className="text-xs" style={{ color: severityColor(hz.severity).hex }}>
                    {hz.severity ?? 'Moderate'}
                  </p>
                  {hz.description && <p className="text-gray-600 text-xs mt-1">{hz.description}</p>}
                </div>
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
                <div className="text-sm">
                  <p className="font-semibold capitalize">{h.hazard.type}</p>
                  <p className="text-xs text-gray-500">
                    {Math.round(h.distanceAlongRouteM)} m along · {Math.round(h.perpendicularDistanceM)} m off
                  </p>
                </div>
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

      {/* Nearby hazards list (full hazard set, untouched even when routing) */}
      <div className="bg-white flex-1">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">All Reports</span>
          <span className="text-xs text-gray-400">{hazards.length} total</span>
        </div>
        {hazards.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400 italic">No hazards reported yet — tap Report to add one.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {hazards.map((hz) => (
              <li key={hz.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl shrink-0">{TYPE_EMOJI[hz.type] ?? TYPE_EMOJI.other}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium capitalize">{hz.type}</p>
                  <p className="text-xs" style={{ color: severityColor(hz.severity).hex }}>
                    {hz.severity ?? 'Moderate'} · {hz.lat.toFixed(4)}, {hz.lng.toFixed(4)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick-report FAB — drops a hazard at current location with default severity.
          The /report tab still offers the full form (description, severity choice). */}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        disabled={reporting}
        aria-label="Quick report a hazard at my location"
        className="fixed z-[1100] right-4 bottom-20 sm:right-[calc(50%-13rem)] w-14 h-14 rounded-full bg-orange-500 text-white text-3xl font-bold shadow-lg shadow-orange-300/60 active:scale-95 transition-transform disabled:opacity-60"
      >
        +
      </button>

      {reportOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setReportOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-3">Report a hazard</h2>
            <p className="text-xs text-gray-500 mb-4">
              Submits at your current location with severity <span className="font-semibold">Moderate</span>. Use the Report tab for a detailed form.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => quickReport(t)}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-transparent border-t-4 bg-gray-50 active:bg-gray-100 transition-colors"
                  style={{ borderTopColor: severityColor('Moderate').hex }}
                >
                  <span className="text-3xl leading-none">{TYPE_EMOJI[t]}</span>
                  <span className="text-sm font-semibold text-gray-700">{TYPE_LABEL[t]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="w-full mt-4 py-2.5 rounded-lg bg-gray-100 font-semibold text-sm text-gray-600 active:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
