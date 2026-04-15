import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from './AuthContext'
import './auth.css'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/p/main'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to={from} replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = login(email, password)
    if (!r.ok) {
      setError(r.error)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>

        <form className="auth-form" onSubmit={onSubmit}>
          {error ? (
            <div className="auth-error" role="alert">
              {error}
            </div>
          ) : null}
          <label className="auth-label">
            E-mail
            <input
              className="auth-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="auth-label">
            Пароль
            <input
              className="auth-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="auth-submit">
            Войти
          </button>
        </form>
        <p className="auth-footer">
          Нет аккаунта?{' '}
          <Link className="auth-link" to="/register">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  )
}
