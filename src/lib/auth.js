import { supabase } from './supabase'

const STORAGE_KEY = 'loan_mlm_session'

export async function login(username, password) {
  const { data, error } = await supabase.rpc('login_app_user', {
    p_username: username,
    p_password: password,
  })
  if (error) throw error
  if (!data || data.length === 0) return null
  const session = data[0]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
}
