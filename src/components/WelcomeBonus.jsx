import { useState, useEffect } from 'react'
import api from '../api/index'
import './WelcomeBonus.css'

export default function WelcomeBonus({ onClaim }) {
  const [show, setShow] = useState(false)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    api.get('/api/bonus/status').then(r => {
      if (!r.data.claimed) setShow(true)
    }).catch(() => {})
  }, [])

  const handleClaim = async () => {
    setClaiming(true)
    try {
      await api.post('/api/bonus/claim')
      setShow(false)
      onClaim()
    } catch {}
    setClaiming(false)
  }

  if (!show) return null

  return (
    <div className="wb-overlay">
      <div className="wb-modal">
        <div className="wb-glow" />
        <div className="wb-icon">🎁</div>
        <div className="wb-title">ДОБРО ПОЖАЛОВАТЬ!</div>
        <div className="wb-subtitle">Ты получаешь стартовый бонус</div>
        <div className="wb-amount">
          <span className="wb-num">0.1000</span>
          <span className="wb-cur">TON</span>
        </div>
        <div className="wb-note">
          Бонус зачисляется на стейкинг и начинает приносить 1% в день. Вывод недоступен — только реинвест.
        </div>
        <button className="wb-btn" onClick={handleClaim} disabled={claiming}>
          {claiming ? 'ЗАЧИСЛЕНИЕ...' : '🚀 ЗАБРАТЬ БОНУС'}
        </button>
      </div>
    </div>
  )
}
