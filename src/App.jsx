import { useState, useEffect } from 'react'
import { useUserStore } from './store/userStore'
import { authLogin } from './api/index'
import api from './api/index'
import Home from './pages/Home/Home'
import Staking from './pages/Staking/Staking'
import Tasks from './pages/Tasks/Tasks'
import Referrals from './pages/Referrals/Referrals'
import Wallet from './pages/Wallet/Wallet'
import Admin from './pages/Admin/Admin'
import Customer from './pages/Customer/Customer'
import './App.css'

const ADMIN_ID = 5651190404

const TABS = [
  { id: 'home',      label: 'ГЛАВНАЯ',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id: 'staking',   label: 'СТЕЙК',     icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id: 'tasks',     label: 'ЗАДАНИЯ',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: 'customer',  label: 'ЗАКАЗАТЬ',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  { id: 'referrals', label: 'РЕФЕРАЛЫ',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M14.5 20c0-2.485 1.567-4.5 3.5-4.5s3.5 2.015 3.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id: 'wallet',    label: 'КОШЕЛЁК',   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 13a1 1 0 100 2 1 1 0 000-2z" fill="currentColor"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/></svg> },
  { id: 'admin',     label: 'АДМИН',     icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const { user, setUser } = useUserStore()

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) { tg.ready(); tg.expand() }
    authLogin().then(r => {
      setUser(r.data.user)
    }).catch(() => setUser({ balance_ton: 0, username: 'Пользователь' }))
  }, [])

  const isAdmin = Number(user?.telegram_id) === ADMIN_ID
  const visibleTabs = TABS.filter(t => t.id !== 'admin' || isAdmin)
  const balance = parseFloat(user?.balance_ton ?? 0)

  return (
    <div className="app">
      <div className="app-header">
        <div className="logo-row">
          <div className="logo-circle">
            <svg viewBox="0 0 32 32" fill="none" width="26" height="26">
              <path d="M9 7h14v3H18v3h-4v-3H9V7z" fill="url(#g1)"/>
              <path d="M16 13l-5 8h4l-2 6 9-10h-5l3-4H16z" fill="url(#g2)"/>
              <defs>
                <linearGradient id="g1" x1="9" y1="7" x2="23" y2="10" gradientUnits="userSpaceOnUse"><stop stopColor="#90d4ff"/><stop offset="1" stopColor="#00d4ff"/></linearGradient>
                <linearGradient id="g2" x1="11" y1="13" x2="21" y2="27" gradientUnits="userSpaceOnUse"><stop stopColor="#b0e0ff"/><stop offset="1" stopColor="#60b8ff"/></linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-name">TonEra</span>
        </div>
        <div className="balance-pill">
          <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
            <path d="M28 0C12.536 0 0 12.536 0 28s12.536 28 28 28 28-12.536 28-28S43.464 0 28 0z" fill="#0098EA"/>
            <path d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.26 36.28l-2.86-5.16-6.56-11.3c-.37-.63.07-1.42.8-1.42h8.62v17.88zm12.9-16.48-6.56 11.32-2.86 5.16V18.38h8.61c.73 0 1.17.79.81 1.42z" fill="#fff"/>
          </svg>
          <span className="bal-num">{balance.toFixed(4)}</span>
        </div>
      </div>

      <div className="tabs-bar">
        {visibleTabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="app-content">
        {tab === 'home'      && <Home      user={user} onTab={setTab} />}
        {tab === 'staking'   && <Staking   user={user} />}
        {tab === 'tasks'     && <Tasks     />}
        {tab === 'customer'  && <Customer  />}
        {tab === 'referrals' && <Referrals user={user} />}
        {tab === 'wallet'    && <Wallet    user={user} />}
        {tab === 'admin'     && <Admin     />}
      </div>

      <nav className="bottom-nav">
        {visibleTabs.map(t => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}