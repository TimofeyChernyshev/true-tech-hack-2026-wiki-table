import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { DocumentPage } from './pages/DocumentPage'
import { LinkGraphPage } from './pages/LinkGraphPage'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/p/main" replace />} />
        <Route path="/p/:pageKey" element={<DocumentPage />} />
        <Route path="/graph" element={<LinkGraphPage />} />
        <Route path="*" element={<Navigate to="/p/main" replace />} />
      </Route>
    </Routes>
  )
}
