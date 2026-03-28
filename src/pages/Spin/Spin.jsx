import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Spin.css'

const SECTORS = [
  { label: '😢 Ничего', color: '#1a2a4a' },
  { label: '🎁 0.01 бонус', color: '#0d2a1a' },
  { label: '🎁 0.05 бонус', color: '#0d2a1a' },
  { label: '💎 0.01 TON', color: '#0a1a3a' },
  { label: '🎁 0.1 бонус', color: '#0d2a1a' },
  { label: '💎 0.05 TON', color: '#0a1a3a' },
  { label: '💎 0.1 TON', color: '#0a2a3a' },
]

const COLORS = ['#1a2a4a','#0d3a1a','#1a1a3a','#0a2a3a','#1a3a0a','#2a1a3a','#3a1a0a']

export default function Spin({ user }) {
  const { updateBalance } = useUserStore()
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState(null)
  const [spinPrice, setSpinPrice] = useState(0.1)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const canvasRef = useRef(null)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    api.get('/api/spin/info').then(r => {
      setSpinPrice(r.data.spin_price || 0.1)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    drawWheel(rotation)
  }, [rotation])

  const showToast = (msg, err = false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 4000)
  }

  const drawWheel = (rot) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    const arc = (Math.PI * 2) / SECTORS.length

    ctx.clearRect(0, 0, size, size)

    SECTORS.forEach((s, i) => {
      const angle = arc * i + rot
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + arc)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,212,255,0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#e8f2ff'
      ctx.font = `bold ${size < 300 ? 10 : 12}px Orbitron, sans-serif`
      ctx.fillText(s.label, r - 12, 4)
      ctx.restore()
    })

    // Центр
    ctx.beginPath()
    ctx.arc(cx, cy, 28, 0, Math.PI * 2)
    ctx.fillStyle = '#050a1a'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,212,255,0.6)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Лого
    ctx.fillStyle = '#00d4ff'
    ctx.font = 'bold 11px Orbitron, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SPIN', cx, cy + 4)
  }

  const handleSpin = async () => {
    if (spinning) return
    if (balance < spinPrice) { showToast(`Нужно ${spinPrice} TON`, true); return }

    setSpinning(true)
    setResult(null)

    try {
      const r = await api.post('/api/spin/play')
      const { result: res, sectorIndex } = r.data

      const arc = (Math.PI * 2) / SECTORS.length
      const targetAngle = -(arc * sectorIndex + arc / 2)
      const spins = 5 + Math.random() * 3
      const finalRot = targetAngle + spins * Math.PI * 2

      // Анимация
      const start = performance.now()
      const duration = 4000
      const startRot = rotation

      const animate = (now) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        // easeOut
        const ease = 1 - Math.pow(1 - progress, 4)
        const current = startRot + (finalRot - startRot) * ease
        setRotation(current)
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setResult(res)
          updateBalance(-spinPrice)
          if (res.type === 'ton') updateBalance(res.value)
          setSpinning(false)
        }
      }
      requestAnimationFrame(animate)

    } catch (e) {
      showToast(e?.response?.data?.error || 'ОШИБКА', true)
      setSpinning(false)
    }
  }

  return (
    <div className="spin-wrap">
      {toast && <div className={`spin-toast ${toastErr ? 'err' : ''}`}>{toast}</div>}

      <div className="spin-title">🎰 КОЛЕСО ФОРТУНЫ</div>
      <div className="spin-balance">Баланс: <span>{balance.toFixed(4)} TON</span></div>

      <div className="spin-wheel-wrap">
        {/* Стрелка */}
        <div className="spin-arrow">▼</div>
        <canvas ref={canvasRef} width={300} height={300} className="spin-canvas"/>
      </div>

      {result && (
        <div className={`spin-result ${result.type === 'nothing' ? 'nothing' : 'win'}`}>
          {result.type === 'nothing' ? '😢 Не повезло в этот раз' : `🎉 ${result.label}!`}
        </div>
      )}

      <button className="spin-btn" onClick={handleSpin} disabled={spinning || balance < spinPrice}>
        {spinning ? '⏳ КРУТИТСЯ...' : `🎰 КРУТИТЬ за ${spinPrice} TON`}
      </button>

      <div className="spin-sectors">
        <div className="ss-title">ПРИЗЫ</div>
        {SECTORS.map((s, i) => (
          <div key={i} className="ss-item">
            <div className="ss-dot" style={{background: COLORS[i % COLORS.length]}}/>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
