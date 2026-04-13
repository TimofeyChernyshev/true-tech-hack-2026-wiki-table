import { useAuth } from './AuthContext'
import './auth.css'

export function AuthBar() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="auth-bar">
      <div className="auth-bar-user">
        <span className="auth-bar-name">{user.displayName}</span>
        <span className="auth-bar-email" title={user.email}>
          {user.email}
        </span>
      </div>
      <button type="button" className="auth-bar-logout" onClick={logout}>
        Выйти
      </button>
    </div>
  )
}
