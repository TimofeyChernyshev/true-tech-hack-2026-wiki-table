import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { RegisterPage } from './auth/RegisterPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { DocumentPage } from './pages/DocumentPage'
import { LinkGraphPage } from './pages/LinkGraphPage'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/p/main" replace />} />
          <Route path="/p/:pageKey" element={<DocumentPage />} />
          <Route path="/graph" element={<LinkGraphPage />} />
          <Route path="*" element={<Navigate to="/p/main" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
