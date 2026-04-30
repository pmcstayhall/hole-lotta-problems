import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createHazard, getCurrentPosition } from '../lib/api'
import { TYPES, SEVERITIES, TYPE_EMOJI, TYPE_LABEL } from '../lib/hazardStyles'
import { markOwnReport } from '../lib/ownReports'

export default function Report() {
  const navigate = useNavigate()

  const [type, setType] = useState('pothole')
  const [severity, setSeverity] = useState('Moderate')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState(null) // { lat, lng } or null
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function fetchLocation() {
    setLocating(true)
    setError(null)
    const p = await getCurrentPosition({ timeoutMs: 8000 })
    setLocating(false)
    if (p.source === 'geo') {
      setPosition({ lat: p.lat, lng: p.lng })
    } else {
      setError('Could not get your location — please enable location access')
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!position) {
      setError('Tap "Use my current location" first')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const hz = await createHazard({
        lat: position.lat,
        lng: position.lng,
        type,
        severity,
        description,
      })
      markOwnReport(hz.id)  // suppresses self-prompts for 24h
      setSuccess(true)
      if (navigator.vibrate) navigator.vibrate(150)
      setTimeout(() => navigate('/map'), 900)
    } catch (err) {
      setError(err.message ?? 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Report a Pothole</h1>
        <p className="text-orange-100 text-sm mt-0.5">Help keep Toronto's streets safe</p>
      </header>

      <form onSubmit={submit} className="flex-1 p-4 space-y-4">
        {/* Photo placeholder — hackathon-stage stub, kept from laura */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 bg-orange-50 border-2 border-dashed border-orange-300 rounded-xl py-8 text-orange-500 active:bg-orange-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
            <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold text-sm">Take a Photo (coming soon)</span>
        </button>

        {/* Hazard type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hazard type</label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-colors ${
                  type === t
                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-600 active:bg-gray-50'
                }`}
              >
                <span className="text-xl leading-none">{TYPE_EMOJI[t]}</span>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <button
            type="button"
            onClick={fetchLocation}
            disabled={locating}
            className="w-full flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3 text-sm text-left active:bg-gray-200 transition-colors disabled:opacity-60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-orange-500 shrink-0">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.896-5.302 3.896-9.327 0-5.385-4.365-9.75-9.75-9.75S2.25 4.615 2.25 9.75c0 4.025 1.952 7.244 3.896 9.327a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
            </svg>
            {locating
              ? <span className="text-gray-500">Locating…</span>
              : position
                ? <span className="text-gray-700 font-medium">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</span>
                : <span className="text-gray-600">Use my current location</span>}
          </button>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  severity === s
                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-600 active:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the hazard — size, depth, threat to cyclists…"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Reported! Heading to the map…
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || success}
          className="w-full bg-orange-500 text-white font-semibold rounded-xl py-4 text-base active:bg-orange-600 transition-colors shadow-md shadow-orange-200 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>

        <p className="text-xs text-center text-gray-400">
          Reports are forwarded to the City of Toronto's 311 service
        </p>
      </form>
    </div>
  )
}
