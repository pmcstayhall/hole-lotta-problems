export default function Report() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-orange-500 text-white px-4 py-5">
        <h1 className="text-xl font-bold">Report a Pothole</h1>
        <p className="text-orange-100 text-sm mt-0.5">Help keep Toronto's streets safe</p>
      </header>

      <div className="flex-1 p-4 space-y-4">
        <button className="w-full flex items-center justify-center gap-3 bg-orange-50 border-2 border-dashed border-orange-300 rounded-xl py-10 text-orange-500 active:bg-orange-100 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
            <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold text-base">Take a Photo</span>
        </button>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <button className="w-full flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3 text-gray-600 text-sm text-left active:bg-gray-200 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-orange-500 shrink-0">
                <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.083 3.896-5.302 3.896-9.327 0-5.385-4.365-9.75-9.75-9.75S2.25 4.615 2.25 9.75c0 4.025 1.952 7.244 3.896 9.327a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.144.742zM12 13.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
              </svg>
              Use my current location
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {['Minor', 'Moderate', 'Severe'].map((level) => (
                <button
                  key={level}
                  className="py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 active:bg-orange-50 active:border-orange-400 active:text-orange-600 transition-colors"
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              rows={3}
              placeholder="Describe the pothole — size, depth, hazard to cyclists..."
            />
          </div>
        </div>

        <button className="w-full bg-orange-500 text-white font-semibold rounded-xl py-4 text-base active:bg-orange-600 transition-colors shadow-md shadow-orange-200">
          Submit Report
        </button>

        <p className="text-xs text-center text-gray-400">
          Reports are forwarded to the City of Toronto's 311 service
        </p>
      </div>
    </div>
  )
}
