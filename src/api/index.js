import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const initData = window.Telegram?.WebApp?.initData || ''
  if (initData) config.headers['x-telegram-init-data'] = initData
  return config
})

export const authLogin       = () => api.post('/api/auth/login')
export const getUserStakes   = () => api.get('/api/staking/my')
export const createStake     = (data) => api.post('/api/staking/stake', data)
export const unstake         = (id) => api.post(`/api/staking/unstake/${id}`)
export const getTasks        = () => api.get('/api/tasks')
export const completeTask    = (id) => api.post(`/api/tasks/${id}/complete`)
export const getReferrals    = () => api.get('/api/referrals')
export const getTransactions = () => api.get('/api/wallet/transactions')

export default api

export const createTask    = (data) => api.post('/api/tasks/create', data)
export const getMyTasks    = () => api.get('/api/tasks/my')

export const getBonusStatus = () => api.get('/api/bonus/status')
export const claimBonus     = () => api.post('/api/bonus/claim')
