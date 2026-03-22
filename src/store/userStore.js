import { create } from 'zustand'

export const useUserStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  updateBalance: (balance) =>
    set((s) => ({ user: { ...s.user, balance_ton: balance } })),
}))
