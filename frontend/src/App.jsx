import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Report from './pages/Report'
import Map from './pages/Map'
import HallOfShame from './pages/HallOfShame'
import CouncilShame from './pages/CouncilShame'
import Rewards from './pages/Rewards'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full max-w-md mx-auto bg-white shadow-lg">
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/report" element={<Report />} />
            <Route path="/map" element={<Map />} />
            <Route path="/hall-of-shame" element={<HallOfShame />} />
            <Route path="/council" element={<CouncilShame />} />
            <Route path="/rewards" element={<Rewards />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
