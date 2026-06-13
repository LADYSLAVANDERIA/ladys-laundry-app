import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  nombre: string
  apellido?: string
  email: string
  perfil: string
  local_id: number
}

interface AuthStore {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      isAdmin: () => get().user?.perfil === 'ADMINISTRADOR',
    }),
    { name: 'ladys-auth' }
  )
)
