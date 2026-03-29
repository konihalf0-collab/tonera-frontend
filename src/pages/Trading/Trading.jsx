import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Trading.css'

export default function Trading({ user, onBack }) {
  const { updateBalance } = useUserStore()
  const [amount, setAmount] = useState('0.1')
  const [timer, setTimer] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const [candles, setCandles] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({ trading_timer: 30, trading_multiplier: 1.9, trading_min_bet: 0.01 })
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    api.get('/api/trading/info').then(r => setConfig(r.data)).catch(() => {})
    generateIdleCandles()
  }, [])

  useEffect(() => {
    if (candles.length > 0) drawChart()
  }, [candles])

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 4000)
  }

  const generateIdleCandles = () => {
    const c = []
    let price = 100
    for (let i = 0; i < 20; i++) {
      const isGreen = Math.random() > 0.5
      const change = (Math.random() * 2 + 0.3) * (isGreen ? 1 : -1)
      const open = price
      const close = price + change
      c.push({ open, close, high: Math.max(open,close)+Math.random(), low: Math.min(open,close)-Math.random(), isGreen: close>open })
      price = close
    }
    setCandles(c)
  }

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background grid
    ctx.strokeStyle = 'rgba(0,212,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(0, H * i / 4)
      ctx.lineTo(W, H * i / 4)
      ctx.stroke()
    }

    const prices = candles.flatMap(c => [c.high, c.low])
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const range = maxP - minP || 1
    const toY = p => H - ((p - minP) / range) * (H * 0.8) - H * 0.1

    const cw = W / candles.length
    candles.forEach((c, i) => {
      const x = i * cw + cw * 0.1
      const cw2 = cw * 0.8
      const openY = toY(c.open), closeY = toY(c.close)
      const highY = toY(c.high), lowY = toY(c.low)
      const color = c.isGreen ? '#00e676' : '#ff4d6a'

      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + cw2/2, highY)
      ctx.lineTo(x + cw2/2, lowY)
      ctx.stroke()

      ctx.fillStyle = color
      const top = Math.min(openY, closeY)
      const h = Math.max(Math.abs(closeY - openY), 2)
      ctx.fillRect(x, top, cw2, h)
    })
  }

  const handleBet = async (direction) => {
    if (loading || countdown > 0) return
    const val = parseFloat(amount)
    if (!val || val < parseFloat(config.trading_min_bet)) {
      showToast(`МИН. СТАВКА: ${config.trading_min_bet} TON`, true); return
    }
    if (val > balance) { showToast('НЕДОСТАТОЧНО СРЕДСТВ', true); return }

    setLoading(true)
    setResult(null)
    const timerVal = parseInt(config.trading_timer) || 30
    setCountdown(timerVal)

    // Запрос к бэкенду
    let betResult = null
    try {
      const r = await api.post('/api/trading/bet', { amount: val, direction })
      betResult = r.data
    } catch (e) {
      showToast(e?.response?.data?.error || 'ОШИБКА', true)
      setLoading(false)
      setCountdown(0)
      return
    }

    // Анимируем свечи
    if (betResult.candles) {
      let i = 0
      const animate = () => {
        if (i < betResult.candles.length) {
          setCandles(betResult.candles.slice(0, i + 1))
          i++
          setTimeout(animate, timerVal * 1000 / betResult.candles.length)
        }
      }
      animate()
    }

    // Обратный отсчёт
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current)
          setResult(betResult)
          if (betResult.won) {
            updateBalance(-val + betResult.profit)
            showToast(`📈 ВЫИГРЫШ +${(betResult.profit - val).toFixed(4)} TON!`)
          } else {
            updateBalance(-val)
            showToast('📉 Не угадал', true)
          }
          setLoading(false)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  return (
    <div className="trading-wrap">
      {toast && <div className={`trading-toast ${toastErr?'err':''}`}>{toast}</div>}
      <div className="tr-header">
        <button className="tr-back" onClick={onBack}>←</button>
        <div className="tr-title">📈 ТРЕЙДИНГ</div>
        <div className="tr-balance">{balance.toFixed(4)} TON</div>
      </div>

      <div className="tr-chart-wrap">
        {countdown > 0 && <div className="tr-countdown">{countdown}с</div>}
        <canvas ref={canvasRef} width={340} height={200} className="tr-canvas"/>
      </div>

      {result && (
        <div className={`tr-result ${result.won?'win':'lose'}`}>
          {result.won
            ? `🎉 ВЫИГРЫШ! +${(result.profit - parseFloat(amount)).toFixed(4)} TON (x${parseFloat(config.trading_multiplier).toFixed(1)})`
            : '😢 Не угадал. Попробуй снова!'}
        </div>
      )}

      <div className="tr-bet-row">
        <div className="tr-bet-label">СТАВКА</div>
        <div className="tr-bet-inputs">
          {['0.01','0.05','0.1','0.5','1'].map(v => (
            <button key={v} className={`tr-bet-btn ${amount===v?'on':''}`} onClick={()=>setAmount(v)}>{v}</button>
          ))}
        </div>
        <div className="tr-custom">
          <input className="tr-input" type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
          <span className="tr-cur">TON</span>
        </div>
      </div>

      <div className="tr-mult">Коэффициент: <span>x{parseFloat(config.trading_multiplier).toFixed(1)}</span> · Таймер: <span>{config.trading_timer}с</span></div>

      <div className="tr-btns">
        <button className="tr-btn up" onClick={()=>handleBet('up')} disabled={loading || countdown>0}>
          {countdown>0 ? `⏳ ${countdown}с` : '📈 ВВЕРХ'}
        </button>
        <button className="tr-btn down" onClick={()=>handleBet('down')} disabled={loading || countdown>0}>
          {countdown>0 ? `⏳ ${countdown}с` : '📉 ВНИЗ'}
        </button>
      </div>
    </div>
  )
}
