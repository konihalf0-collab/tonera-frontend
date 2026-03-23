import { useState, useEffect } from 'react'
import { getUserStakes } from '../../api/index'
import './Home.css'

export default function Home({ user, onTab, onCreate, onMyTasks }) {
  const balance = parseFloat(user?.balance_ton ?? 0)
  const username = user?.username || user?.first_name || 'Пользователь'
  const [stakeTotal, setStakeTotal] = useState(null)

  useEffect(() => {
    getUserStakes().then(r => {
      const total = (r.data || []).reduce((s, st) => s + parseFloat(st.amount), 0)
      setStakeTotal(total)
    }).catch(() => setStakeTotal(0))
  }, [])

  return (
    <div className="page-wrap fade-up">
      <div className="home-greeting">
        <span className="hi">Привет, {username} 👋</span>
        <span className="sub">Твой крипто-дашборд</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => onTab('staking')}>
          <div className="stat-icon si-cyan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-val">{stakeTotal === null ? '...' : stakeTotal.toFixed(4) + ' TON'}</div>
            <div className="stat-lbl">В стейкинге</div>
          </div>
          <div className="stat-arr">›</div>
        </div>
        <div className="stat-card" onClick={() => onTab('tasks')}>
          <div className="stat-icon si-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-val">{balance.toFixed(4)}</div>
            <div className="stat-lbl">Баланс TON</div>
          </div>
          <div className="stat-arr">›</div>
        </div>
        <div className="stat-card" onClick={() => onTab('referrals')}>
          <div className="stat-icon si-green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-val">{user?.referral_count ?? 0}</div>
            <div className="stat-lbl">Рефералов</div>
          </div>
          <div className="stat-arr">›</div>
        </div>
      </div>

      <div className="section-title">Быстрые действия</div>
      <div className="qa-grid">
        <div className="qa" onClick={() => onTab('staking')}>
          <div className="qa-icon si-cyan"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
          <div className="qa-lbl">СТЕЙК</div>
        </div>
        <div className="qa" onClick={() => onTab('tasks')}>
          <div className="qa-icon si-blue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
          <div className="qa-lbl">ЗАДАНИЯ</div>
        </div>
        <div className="qa" onClick={onCreate}>
          <div className="qa-icon si-warn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg></div>
          <div className="qa-lbl">ЗАКАЗАТЬ</div>
        </div>
        <div className="qa" onClick={onMyTasks}>
          <div className="qa-icon si-green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
          <div className="qa-lbl">МОИ ЗАКАЗЫ</div>
        </div>
      </div>
    </div>
  )
}