import { useState, useEffect } from 'react'
import { getTransactions } from '../../api/index'
import { useUserStore } from '../../store/userStore'
import './Wallet.css'

const MOCK_TXS = [
  { id: 1, type: 'stake',    amount: -10,  label: 'Стейкинг Standard', date: '2024-03-20T10:00:00Z' },
  { id: 2, type: 'reward',   amount: +0.5, label: 'Реферальный бонус', date: '2024-03-19T14:22:00Z' },
  { id: 3, type: 'task',     amount: +0.1, label: 'Ежедневный чекин',  date: '2024-03-19T09:00:00Z' },
  { id: 4, type: 'deposit',  amount: +50,  label: 'Пополнение',        date: '2024-03-18T18:05:00Z' },
  { id: 5, type: 'withdraw', amount: -5,   label: 'Вывод TON',         date: '2024-03-17T12:30:00Z' },
]

const TX_ICONS = {
  stake:    { icon: '📈', color: 'var(--accent2)' },
  reward:   { icon: '🎁', color: 'var(--success)' },
  task:     { icon: '✅', color: 'var(--success)' },
  deposit:  { icon: '⬇️', color: 'var(--success)' },
  withdraw: { icon: '⬆️', color: 'var(--danger)' },
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Wallet() {
  const { user } = useUserStore()
  const [txs, setTxs]       = useState(MOCK_TXS)
  const [tab, setTab]       = useState('all') // all | in | out
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wAmount, setWAmount] = useState('')

  useEffect(() => {
    getTransactions().then(r => setTxs(r.data)).catch(() => {})
  }, [])

  const filtered = txs.filter(tx => {
    if (tab === 'in')  return tx.amount > 0
    if (tab === 'out') return tx.amount < 0
    return true
  })

  const balance = user?.balance_ton ?? 0

  return (
    <div className="wallet fade-up">
      <div className="page-header">
        <div className="page-title">Кошелёк</div>
        <div className="page-subtitle">Баланс и транзакции</div>
      </div>

      {/* Balance */}
      <div className="wallet-balance-card">
        <div className="wb-glow" />
        <div className="wb-label">Баланс TON</div>
        <div className="wb-amount">
          <span className="wb-value">{balance.toFixed(4)}</span>
          <span className="wb-currency">TON</span>
        </div>
        <div className="wb-usd">≈ ${(balance * 6.5).toFixed(2)} USD</div>
        <div className="wb-actions">
          <button className="wb-btn wb-btn-primary" onClick={() => { setShowDeposit(true); setShowWithdraw(false) }}>
            <span>⬇</span> Пополнить
          </button>
          <button className="wb-btn wb-btn-ghost" onClick={() => { setShowWithdraw(true); setShowDeposit(false) }}>
            <span>⬆</span> Вывести
          </button>
        </div>
      </div>

      {/* Deposit form */}
      {showDeposit && (
        <div className="wallet-form card">
          <div className="wf-title">Пополнение</div>
          <div className="wf-desc">Отправь TON на этот адрес:</div>
          <div className="wf-address">
            UQC...{user?.ton_address?.slice(-6) || 'адрес не привязан'}
          </div>
          <button className="btn-ghost" onClick={() => setShowDeposit(false)}>Закрыть</button>
        </div>
      )}

      {/* Withdraw form */}
      {showWithdraw && (
        <div className="wallet-form card">
          <div className="wf-title">Вывод TON</div>
          <div className="stake-input-wrap" style={{ marginBottom: 10 }}>
            <input
              className="stake-input"
              type="number"
              placeholder="Сумма TON"
              value={wAmount}
              onChange={e => setWAmount(e.target.value)}
            />
            <span className="stake-input-currency">TON</span>
          </div>
          <button className="btn-primary" style={{ marginBottom: 8 }}>Вывести</button>
          <button className="btn-ghost" onClick={() => setShowWithdraw(false)}>Закрыть</button>
        </div>
      )}

      {/* Transactions */}
      <div className="tx-header">
        <div className="section-title" style={{ marginBottom: 0 }}>История</div>
        <div className="tx-tabs">
          {['all', 'in', 'out'].map(t => (
            <button
              key={t}
              className={`tx-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'Все' : t === 'in' ? '⬇ Вход' : '⬆ Выход'}
            </button>
          ))}
        </div>
      </div>

      <div className="tx-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-text">Нет транзакций</div>
          </div>
        ) : (
          filtered.map(tx => {
            const meta = TX_ICONS[tx.type] || { icon: '💱', color: 'var(--text-secondary)' }
            const positive = tx.amount > 0
            return (
              <div key={tx.id} className="tx-item card">
                <div className="tx-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
                  {meta.icon}
                </div>
                <div className="tx-info">
                  <div className="tx-label">{tx.label}</div>
                  <div className="tx-date">{formatDate(tx.date)}</div>
                </div>
                <div className={`tx-amount ${positive ? 'positive' : 'negative'}`}>
                  {positive ? '+' : ''}{tx.amount} TON
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
