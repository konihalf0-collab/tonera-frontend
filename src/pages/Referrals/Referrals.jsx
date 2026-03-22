import { useState, useEffect } from 'react'
import { getReferrals } from '../../api/index'
import { useUserStore } from '../../store/userStore'
import './Referrals.css'

export default function Referrals() {
  const { user } = useUserStore()
  const [referrals, setReferrals] = useState([])
  const [copied, setCopied] = useState(false)

  const refLink = user?.ref_code
    ? `https://t.me/YourBot?start=${user.ref_code}`
    : 'Загрузка...'

  useEffect(() => {
    getReferrals().then(r => setReferrals(r.data)).catch(() => {})
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=Заходи в Tonera — зарабатывай TON!`)
    }
  }

  return (
    <div className="referrals fade-up">
      <div className="page-header">
        <div className="page-title">Рефералы</div>
        <div className="page-subtitle">Приглашай и получай бонусы</div>
      </div>

      {/* Stats */}
      <div className="ref-stats">
        <div className="ref-stat card">
          <div className="ref-stat-value">{referrals.length}</div>
          <div className="ref-stat-label">Приглашено</div>
        </div>
        <div className="ref-stat card">
          <div className="ref-stat-value">{(referrals.length * 0.5).toFixed(1)}</div>
          <div className="ref-stat-label">TON заработано</div>
        </div>
      </div>

      {/* Invite card */}
      <div className="invite-card card">
        <div className="invite-title">Твоя реферальная ссылка</div>
        <div className="invite-link-wrap">
          <div className="invite-link">{refLink}</div>
        </div>
        <div className="invite-actions">
          <button className="btn-primary" onClick={handleShare}>
            📤 Поделиться
          </button>
          <button className="btn-ghost copy-btn" onClick={handleCopy}>
            {copied ? '✓ Скопировано' : 'Копировать'}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="how-it-works card">
        <div className="hiw-title">Как это работает</div>
        <div className="hiw-steps">
          <div className="hiw-step">
            <div className="hiw-num">1</div>
            <div className="hiw-text">Поделись своей ссылкой с другом</div>
          </div>
          <div className="hiw-step">
            <div className="hiw-num">2</div>
            <div className="hiw-text">Друг регистрируется в Tonera</div>
          </div>
          <div className="hiw-step">
            <div className="hiw-num">3</div>
            <div className="hiw-text">Ты получаешь 0.5 TON за каждого</div>
          </div>
        </div>
      </div>

      {/* Referral list */}
      {referrals.length > 0 && (
        <>
          <div className="section-title">Приглашённые</div>
          <div className="ref-list">
            {referrals.map((ref, i) => (
              <div key={ref.id || i} className="ref-item card">
                <div className="ref-avatar">{ref.username?.[0]?.toUpperCase() || '?'}</div>
                <div className="ref-info">
                  <div className="ref-name">{ref.username || 'Пользователь'}</div>
                  <div className="ref-date">{new Date(ref.created_at).toLocaleDateString('ru')}</div>
                </div>
                <div className="ref-bonus">+0.5 TON</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
