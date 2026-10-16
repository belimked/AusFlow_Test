const TOKEN = 'wasteid-token'
const USER = 'wasteid-user'

export const isSignedIn = () => !!sessionStorage.getItem(TOKEN)
export const currentUser = () => JSON.parse(sessionStorage.getItem(USER) || 'null')

export const ROLE_LABELS = { admin: 'Admin', ops: 'Operations', user: 'User' }
export const roleOf = () => { const r = currentUser()?.role; return r === 'authority' ? 'admin' : r || 'user' }
const PERMS = { write: ['admin', 'ops'], admin: ['admin'] }
export const can = (perm) => !!PERMS[perm]?.includes(roleOf())

export function logout() {
  sessionStorage.removeItem(TOKEN)
  sessionStorage.removeItem(USER)
}

export async function api(path, body, method) {
  const headers = { 'Content-Type': 'application/json' }
  const token = sessionStorage.getItem(TOKEN)
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api' + path, { method: method || (body ? 'POST' : 'GET'), headers, body: body && JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/login') {
    logout()
    location.hash = '#/login'
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export async function login(username, password) {
  const { token, user } = await api('/login', { username, password })
  sessionStorage.setItem(TOKEN, token)
  sessionStorage.setItem(USER, JSON.stringify(user))
  return user
}
