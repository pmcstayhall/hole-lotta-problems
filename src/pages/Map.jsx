import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TORONTO_CENTER = [43.6532, -79.3832]
const DEFAULT_ZOOM = 14

const MOCK_REPORTS = [
  { id: 1, lat: 43.6534, lng: -79.3873, severity: 'Severe',   address: 'Yonge St & Dundas St W',          neighbourhood: 'Downtown Core' },
  { id: 2, lat: 43.6462, lng: -79.3789, severity: 'Moderate', address: 'King St E & Jarvis St',            neighbourhood: 'St. Lawrence' },
  { id: 3, lat: 43.6510, lng: -79.3900, severity: 'Severe',   address: 'Queen St W & University Ave',      neighbourhood: 'Financial District' },
  { id: 4, lat: 43.6555, lng: -79.3795, severity: 'Minor',    address: 'Bloor St E & Sherbourne St',       neighbourhood: 'Cabbagetown' },
  { id: 5, lat: 43.6489, lng: -79.3966, severity: 'Moderate', address: 'Spadina Ave & Front St W',         neighbourhood: 'Entertainment District' },
  { id: 6, lat: 43.6601, lng: -79.3955, severity: 'Severe',   address: 'College St & Bathurst St',         neighbourhood: 'Little Italy' },
  { id: 7, lat: 43.6473, lng: -79.4021, severity: 'Minor',    address: 'King St W & Strachan Ave',         neighbourhood: 'Liberty Village' },
]

const severityCircle = {
  Severe:   { color: '#ef4444', fillColor: '#ef4444' },
  Moderate: { color: '#f59e0b', fillColor: '#f59e0b' },
  Minor:    { color: '#22c55e', fillColor: '#22c55e' },
}

const severityDot = {
  Severe:   'bg-red-500',
  Moderate: 'bg-yellow-500',
  Minor:    'bg-green-500',
}

const userIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(59,130,246,0.35)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FlyToPosition({ position }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, DEFAULT_ZOOM, { duration: 1.4 })
  }, [position, map])
  return null
}

export default function Map() {
  const [userPosition, setUserPosition] = useState(null)
  const [locationStatus, setLocationStatus] = useState('locating')

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition([coords.latitude, coords.longitude])
        setLocationStatus('found')
      },
      () => {
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  const statusMessage = {
    locating:    'Locating you…',
    found:       'Showing your location',
    denied:      'Location access denied — showing Downtown Toronto',
    unavailable: 'GPS unavailable — showing Downtown Toronto',
  }[locationStatus]

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Pothole Map</h1>
        <p className="text-orange-100 text-sm mt-0.5">{MOCK_REPORTS.length} reports in your neighbourhood</p>
      </header>

      <div className="h-72 relative">
        <MapContainer
          center={TORONTO_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {MOCK_REPORTS.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={8}
              pathOptions={{
                ...severityCircle[r.severity],
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{r.address}</p>
                  <p className="text-gray-500">{r.neighbourhood}</p>
                  <p className="mt-1 font-medium" style={{ color: severityCircle[r.severity].color }}>
                    {r.severity}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {userPosition && (
            <>
              <Marker position={userPosition} icon={userIcon}>
                <Popup>You are here</Popup>
              </Marker>
              <FlyToPosition position={userPosition} />
            </>
          )}
        </MapContainer>

        <div className="absolute bottom-2 left-2 right-2 z-[1000] pointer-events-none">
          <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow text-xs text-gray-600">
            <span
              className={`w-2 h-2 rounded-full ${
                locationStatus === 'found' ? 'bg-blue-500' :
                locationStatus === 'locating' ? 'bg-yellow-400 animate-pulse' :
                'bg-gray-400'
              }`}
            />
            {statusMessage}
          </div>
        </div>
      </div>

      <div className="flex gap-4 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
        {Object.entries(severityCircle).map(([label, { fillColor }]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: fillColor }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-auto">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
          You
        </span>
      </div>

      <div className="bg-white flex-1">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Nearby Reports</span>
          <span className="text-xs text-gray-400">Sorted by distance</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {MOCK_REPORTS.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-3 h-3 rounded-full shrink-0 ${severityDot[r.severity]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.address}</p>
                <p className="text-xs text-gray-400">{r.neighbourhood} · {r.severity}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-300 shrink-0">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
              </svg>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
