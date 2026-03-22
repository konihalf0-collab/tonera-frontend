import { useUserStore } from '../../store/userStore'
import { useNavigate } from 'react-router-dom'
import './Home.css'

export default function Home() {
  const { user } = useUserStore()
  const navigate = useNavigate()

  const balance = user?.balance_ton ?? 0
  const username = user?.username || user?.first_name || 'Пользователь'

  return (
    <div className="home fade-up">
      {/* Header */}
      <div className="home-header">
        <div className="home-greeting">
          <span className="home-greeting-text">Привет, {username} 👋</span>
          <span className="home-subtitle">Твой крипто-дашборд</span>
        </div>
        <div className="home-avatar">
          {username[0]?.toUpperCase()}
        </div>
      </div>

      {/* Balance card */}
      <div className="balance-card">
        <div className="balance-bg-glow" />
        <div className="balance-label">Общий баланс</div>
        <div className="balance-amount">
          <span className="balance-value">{balance.toFixed(2)}</span>
          <span className="balance-currency">TON</span>
        </div>
        <div className="balance-actions">
          <button className="btn-primary balance-btn" onClick={() => navigate('/wallet')}>
            Пополнить
          </button>
          <button className="btn-ghost balance-btn" onClick={() => navigate('/wallet')}>
            Вывести
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/staking')}>
          <div className="stat-icon stat-icon-green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">—</div>
            <div className="stat-label">В стейкинге</div>
          </div>
          <div className="stat-arrow">›</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/tasks')}>
          <div className="stat-icon stat-icon-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">0</div>
            <div className="stat-label">Заданий выполнено</div>
          </div>
          <div className="stat-arrow">›</div>
        </div>

        <div className="stat-card" onClick={() => navigate('/referrals')}>
          <div className="stat-icon stat-icon-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="18" cy="8" r="2.5" stroke="currentColor" strokeWidth="2"/>
              <path d="M14.5 20c0-2.485 1.567-4.5 3.5-4.5s3.5 2.015 3.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-value">{user?.referral_count ?? 0}</div>
            <div className="stat-label">Рефералов</div>
          </div>
          <div className="stat-arrow">›</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="section-title">Быстрые действия</div>
      <div className="quick-actions">
        <div className="quick-action" onClick={() => navigate('/staking')}>
          <div className="qa-icon">📈</div>
          <div className="qa-label">Застейкать</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/tasks')}>
          <div className="qa-icon">✅</div>
          <div className="qa-label">Задания</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/referrals')}>
          <div className="qa-icon">🔗</div>
          <div className="qa-label">Пригласить</div>
        </div>
        <div className="quick-action" onClick={() => navigate('/wallet')}>
          <div className="qa-icon">💳</div>
          <div className="qa-label">История</div>
        </div>
      </div>
    </div>
  )
}
