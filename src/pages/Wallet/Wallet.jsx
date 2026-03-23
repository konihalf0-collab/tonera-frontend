import { useState, useEffect } from 'react'
import { getTransactions } from '../../api/index'
import './Wallet.css'

const MOCK = [
  { id:1, type:'stake',   amount:-10,  label:'Стейкинг',          date:'2024-03-20T10:00:00Z' },
  { id:2, type:'reward',  amount:+0.5, label:'Реферальный бонус', date:'2024-03-19T14:22:00Z' },
  { id:3, type:'deposit', amount:+50,  label:'Пополнение',        date:'2024-03-18T18:05:00Z' },
]

export default function Wallet({ user }) {
  const [txs, setTxs] = useState(MOCK)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    getTransactions().then(r => setTxs(r.data)).catch(() => {})
  }, [])

  return (
    <div className="wallet-wrap">
      <div className="wallet-title">Кошелёк</div>

      <div className="wallet-card">
        <div className="wc-glow"/>
        <div className="wc-label">БАЛАНС</div>
        <div className="wc-row">
          <svg width="36" height="36" viewBox="0 0 56 56" fill="none"><path d="M28 0C12.536 0 0 12.536 0 28s12.536 28 28 28 28-12.536 28-28S43.464 0 28 0z" fill="#0098EA"/><path d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.26 36.28l-2.86-5.16-6.56-11.3c-.37-.63.07-1.42.8-1.42h8.62v17.88zm12.9-16.48-6.56 11.32-2.86 5.16V18.38h8.61c.73 0 1.17.79.81 1.42z" fill="#fff"/></svg>
          <span className="wc-num">{balance.toFixed(4)}</span>
        </div>
        <div className="wc-usd">≈ ${(balance * 6.5).toFixed(2)} USD</div>
        <div className="wc-btns">
          <button className="wc-btn wc-in">⬇ ПОПОЛНИТЬ</button>
          <button className="wc-btn wc-out">⬆ ВЫВЕСТИ</button>
        </div>
      </div>

      <div className="tx-label">ИСТОРИЯ</div>
      <div className="tx-list">
        {txs.map(tx => (
          <div className="tx-item" key={tx.id}>
            <div className={`tx-icon ${tx.amount > 0 ? 'ti-g' : 'ti-b'}`}>
              {tx.type === 'stake' ? '📈' : tx.type === 'reward' ? '🎁' : '⬇️'}
            </div>
            <div className="tx-info">
              <div className="tx-name">{tx.label}</div>
              <div className="tx-date">{new Date(tx.date).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div className={`tx-amt ${tx.amount > 0 ? 'pos' : 'neg'}`}>
              {tx.amount > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(4)} TON
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}