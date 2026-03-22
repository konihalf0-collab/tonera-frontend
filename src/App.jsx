import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useUserStore } from './store/userStore'
import { authLogin } from './api/index'
import BottomNav from './components/BottomNav'
import Home from './pages/Home/Home'
import Staking from './pages/Staking/Staking'
import Tasks from './pages/Tasks/Tasks'
import Referrals from './pages/Referrals/Referrals'
import Wallet from './pages/Wallet/Wallet'
import './App.css'

export default function App() {
  const { setUser, setError } = useUserStore()

  useEffect(() => {
    // Init Telegram WebApp
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
    }

    // Auth on mount
    authLogin()
      .then((res) => setUser(res.data.user))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <BrowserRouter>
      <div className="app-layout">
        <div className="page-content">
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/staking"   element={<Staking />} />
            <Route path="/tasks"     element={<Tasks />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/wallet"    element={<Wallet />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
