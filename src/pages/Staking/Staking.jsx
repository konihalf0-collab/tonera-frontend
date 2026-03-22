import { useState, useEffect, useRef } from 'react'
import { getUserStakes, createStake, unstake } from '../../api/index'
import { useUserStore } from '../../store/userStore'
import './Staking.css'

const DAILY_RATE = 0.01 // 1% per day — mirrors backend

function calcEarned(amount, startedAt) {
  const msPerDay = 1000 * 60 * 60 * 24
  const days = (Date.now() - new Date(startedAt).getTime()) / msPerDay
  return parseFloat(amount) * DAILY_RATE * days
}

export default function Staking() {
  const { user, updateBalance } = useUserStore()
  const [stakes, setStakes]     = useState([])
  const [amount, setAmount]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [unstaking, setUnstaking] = useState(null)
  const [tab, setTab]           = useState('stake') // stake | active
  const [earned, setEarned]     = useState({}) // stakeId -> earned
  const tickRef = useRef(null)

  const balance = parseFloat(user?.balance_ton ?? 0)

  // Load active stakes
  const loadStakes = async () => {
    try {
      const res = await getUserStakes()
      setStakes(res.data)
    } catch {}
  }

  useEffect(() => {
    loadStakes()
  }, [])

  // Live earned ticker — updates every second
  useEffect(() => {
    if (stakes.length === 0) return
    tickRef.current = setInterval(() => {
      const updated = {}
      stakes.forEach(s => {
        updated[s.id] = calcEarned(s.amount, s.started_at)
      })
      setEarned(updated)
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [stakes])

  const handleStake = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    if (parseFloat(amount) > balance) return
    setLoading(true)
    try {
      await createStake({ amount: parseFloat(amount) })
      setAmount('')
      await loadStakes()
      setTab('active')
      // Refresh user balance
      updateBalance(balance - parseFloat(amount))
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка')
    }
    setLoading(false)
  }

  const handleUnstake = async (stakeId) => {
    setUnstaking(stakeId)
    try {
      const res = await unstake(stakeId)
      await loadStakes()
      updateBalance(balance + res.data.returned)
      setTab('stake')
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка')
    }
    setUnstaking(null)
  }

  const dailyPreview = amount ? (parseFloat(amount) * DAILY_RATE).toFixed(4) : null

  return (
    <div className="staking fade-up">
      <div className="page-header">
        <div className="page-title">Стейкинг</div>
        <div className="page-subtitle">1% в день от суммы</div>
      </div>

      {/* Info card */}
      <div className="staking-info-card">
        <div className="sic-item">
          <div className="sic-value">1%</div>
          <div className="sic-label">в день</div>
        </div>
        <div className="sic-divider" />
        <div className="sic-item">
          <div className="sic-value">~30%</div>
          <div className="sic-label">в месяц</div>
        </div>
        <div className="sic-divider" />
        <div className="sic-item">
          <div className="sic-value">365%</div>
          <div className="sic-label">в год</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="staking-tabs">
        <button className={`staking-tab ${tab === 'stake' ? 'active' : ''}`} onClick={() => setTab('stake')}>
          Застейкать
        </button>
        <button className={`staking-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          Активные ({stakes.length})
        </button>
      </div>

      {/* STAKE FORM */}
      {tab === 'stake' && (
        <div className="stake-form card">
          <div className="stake-balance-hint">
            Доступно: <span>{balance.toFixed(4)} TON</span>
          </div>

          <div className="stake-input-wrap">
            <input
              className="stake-input"
              type="number"
              placeholder="Сумма TON"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="stake-input-currency">TON</span>
          </div>

          {/* Quick % buttons */}
          <div className="stake-quick">
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                className="quick-pct"
                onClick={() => setAmount((balance * pct / 100).toFixed(4))}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Preview */}
          {dailyPreview && (
            <div className="stake-preview">
              <div className="preview-row">
                <span>Доход в день</span>
                <span className="preview-value">+{dailyPreview} TON</span>
              </div>
              <div className="preview-row">
                <span>Доход в месяц</span>
                <span className="preview-value">+{(parseFloat(dailyPreview) * 30).toFixed(4)} TON</span>
              </div>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleStake}
            disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance}
          >
            {loading ? 'Обработка...' : 'Застейкать'}
          </button>
        </div>
      )}

      {/* ACTIVE STAKES */}
      {tab === 'active' && (
        <div className="active-stakes">
          {stakes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-text">Нет активных стейков</div>
              <div className="empty-sub">Перейди во вкладку «Застейкать»</div>
            </div>
          ) : (
            stakes.map(s => {
              const liveEarned = earned[s.id] ?? calcEarned(s.amount, s.started_at)
              const daily = parseFloat(s.amount) * DAILY_RATE
              const daysActive = (Date.now() - new Date(s.started_at).getTime()) / (1000 * 60 * 60 * 24)

              return (
                <div key={s.id} className="active-stake-card card">
                  <div className="as-header">
                    <div className="as-label">Стейк</div>
                    <span className="tag tag-accent">1% / день</span>
                  </div>

                  <div className="as-amount">{parseFloat(s.amount).toFixed(4)} TON</div>

                  <div className="as-stats">
                    <div className="as-stat">
                      <div className="as-stat-label">Заработано</div>
                      <div className="as-stat-value earned-live">+{liveEarned.toFixed(6)} TON</div>
                    </div>
                    <div className="as-stat">
                      <div className="as-stat-label">В день</div>
                      <div className="as-stat-value">+{daily.toFixed(4)} TON</div>
                    </div>
                    <div className="as-stat">
                      <div className="as-stat-label">Дней</div>
                      <div className="as-stat-value">{daysActive.toFixed(1)}</div>
                    </div>
                  </div>

                  <button
                    className="btn-ghost"
                    onClick={() => handleUnstake(s.id)}
                    disabled={unstaking === s.id}
                    style={{ marginTop: 12 }}
                  >
                    {unstaking === s.id ? 'Вывод...' : `Вывести ${(parseFloat(s.amount) + liveEarned).toFixed(4)} TON`}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
