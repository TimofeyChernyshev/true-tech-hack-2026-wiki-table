import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from './AuthContext'
import './auth.css'

export function RegisterPage() {
  const { user, register, login } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) {
    return <Navigate to="/p/main" replace />
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = register(email, password, displayName)
    if (!r.ok) {
      setError(r.error)
      return
    }
    const signIn = login(email, password)
    if (!signIn.ok) {
      setError(signIn.error)
      return
    }
    navigate('/p/main', { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Регистрация</h1>

        <form className="auth-form" onSubmit={onSubmit}>
          {error ? (
            <div className="auth-error" role="alert">
              {error}
            </div>
          ) : null}
          <label className="auth-label">
            Имя
            <input
              className="auth-input"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <label className="auth-label">
            E-mail
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </label>
          <button type="submit" className="auth-submit">
            Создать аккаунт и войти
          </button>
        </form>
        <p className="auth-footer">
          Уже есть аккаунт?{' '}
          <Link className="auth-link" to="/login">
            Вход
          </Link>
        </p>
      </div>
    </div>
  )
}
