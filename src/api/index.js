import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
})

// Attach Telegram initData to every request
api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData || ''
  if (initData) {
    config.headers['x-telegram-init-data'] = initData
  }
  return config
})

// Auth
export const authLogin = () => api.post('/api/auth/login')

// User
export const getUser = () => api.get('/api/user/me')

// Staking
export const getStakingInfo   = () => api.get("/api/staking/info")
export const getUserStakes   = () => api.get('/api/staking/my')
export const createStake     = (data) => api.post('/api/staking/stake', data)
export const unstake         = (stakeId) => api.post(`/api/staking/unstake/${stakeId}`)

// Tasks
export const getTasks       = () => api.get('/api/tasks')
export const completeTask   = (taskId) => api.post(`/api/tasks/${taskId}/complete`)

// Referrals
export const getReferrals   = () => api.get('/api/referrals')

// Wallet
export const getTransactions = () => api.get('/api/wallet/transactions')

export default api
