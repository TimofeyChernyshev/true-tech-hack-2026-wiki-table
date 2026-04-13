type Props = {
  open: boolean
  onClose: () => void
}

const ROWS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+S', action: 'Сохранить сейчас (localStorage и Yjs; синхрон с сервером — WebSocket)' },
  { keys: 'Ctrl+Shift+/', action: 'Эта справка (знак «?»)' },
  { keys: 'Ctrl+B', action: 'Жирный' },
  { keys: 'Ctrl+I', action: 'Курсив' },
  { keys: 'Ctrl+U', action: 'Подчёркнутый' },
  { keys: 'Ctrl+Z', action: 'Отменить' },
  { keys: 'Ctrl+Y или Ctrl+Shift+Z', action: 'Повторить' },
  { keys: 'Ctrl+L', action: 'Выравнивание влево' },
  { keys: 'Ctrl+E', action: 'По центру' },
  { keys: 'Ctrl+R', action: 'Вправо (в редакторе не обновляет страницу)' },
  { keys: 'Ctrl+J', action: 'По ширине' },
  { keys: 'Ctrl+Shift+R', action: 'Обновить страницу (как в браузере)' },
]

export const WIKI_OPEN_HOTKEY_HELP = 'wiki-open-hotkey-help'

export function WikiHotkeysModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="wiki-modal-root wiki-hotkeys-modal-root" role="dialog" aria-modal aria-labelledby="wiki-hotkeys-title">
      <button type="button" className="wiki-modal-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="wiki-modal-card wiki-modal-card--wide">
        <h2 id="wiki-hotkeys-title" className="wiki-modal-title">
          Горячие клавиши редактора
        </h2>
        <p className="wiki-modal-hint">На macOS вместо Ctrl обычно удерживайте ⌘ (Command).</p>
        <table className="wiki-hotkeys-table">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.keys}>
                <td className="wiki-hotkeys-kbd">{row.keys}</td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="wiki-modal-actions wiki-modal-actions--single">
          <button type="button" className="wiki-modal-file-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
