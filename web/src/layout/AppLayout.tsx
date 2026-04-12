import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="wiki-shell wiki-shell--page-only">
      <div className="wiki-shell-content wiki-shell-content--full">
        <Outlet />
      </div>
    </div>
  )
}
