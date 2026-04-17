const SESSION_KEY = 'wiki-stub-session'
const ACCOUNTS_KEY = 'wiki-stub-accounts'

export type StubSessionUser = {
  email: string
  displayName: string
}

type StubAccount = {
  email: string
  password: string
  displayName: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readAccounts(): StubAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is StubAccount =>
        typeof x === 'object' &&
        x !== null &&
        typeof (x as StubAccount).email === 'string' &&
        typeof (x as StubAccount).password === 'string' &&
        typeof (x as StubAccount).displayName === 'string',
    )
  } catch {
    return []
  }
}

function saveAccounts(accounts: StubAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function readSession(): StubSessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StubSessionUser).email !== 'string' ||
      typeof (parsed as StubSessionUser).displayName !== 'string'
    ) {
      return null
    }
    return {
      email: (parsed as StubSessionUser).email,
      displayName: (parsed as StubSessionUser).displayName,
    }
  } catch {
    return null
  }
}

export function writeSession(user: StubSessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function tryRegister(
  emailRaw: string,
  password: string,
  displayNameRaw: string,
): { ok: true } | { ok: false; error: string } {
  const email = normalizeEmail(emailRaw)
  const displayName = displayNameRaw.trim()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Укажите корректный e-mail.' }
  }
  if (password.length < 4) {
    return { ok: false, error: 'Пароль не короче 4 символов (заглушка).' }
  }
  if (!displayName) {
    return { ok: false, error: 'Укажите имя.' }
  }
  const accounts = readAccounts()
  if (accounts.some((a) => a.email === email)) {
    return { ok: false, error: 'Пользователь с таким e-mail уже «зарегистрирован» локально.' }
  }
  accounts.push({ email, password, displayName })
  saveAccounts(accounts)
  return { ok: true }
}

export function tryLogin(
  emailRaw: string,
  password: string,
): { ok: true; user: StubSessionUser } | { ok: false; error: string } {
  const email = normalizeEmail(emailRaw)
  if (!email) {
    return { ok: false, error: 'Введите e-mail.' }
  }
  const accounts = readAccounts()
  const hit = accounts.find((a) => a.email === email && a.password === password)
  if (!hit) {
    return {
      ok: false,
      error: 'Неверный e-mail или пароль (или сначала зарегистрируйтесь — данные только в браузере).',
    }
  }
  return { ok: true, user: { email: hit.email, displayName: hit.displayName } }
}
