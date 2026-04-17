import { Outlet } from 'react-router-dom'

import { AuthBar } from '../auth/AuthBar'

export function AppLayout() {
  return (
    <div className="wiki-shell wiki-shell--page-only">
      <AuthBar />
      <div className="wiki-shell-content wiki-shell-content--full">
        <Outlet />
      </div>
    </div>
  )
}
