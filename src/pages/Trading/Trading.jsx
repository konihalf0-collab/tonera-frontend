import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Trading.css'

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m'
const CANDLE_COUNT = 40

export default function Trading({ user, onBack }) {
  const { updateBalance } = useUserStore()
  const [amount, setAmount] = useState('0.1')
  const [candles, setCandles] = useState([])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [bet, setBet] = useState(null) // {direction, amount, startPrice, endTime}
  const [result, setResult] = useState(null)
  const [config, setConfig] = useState({ trading_timer:30, trading_multiplier:1.9, trading_min_bet:0.01 })
  const [countdown, setCountdown] = useState(0)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const candlesRef = useRef([])
  const betRef = useRef(null)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    api.get('/api/trading/info').then(r => setConfig(r.data)).catch(() => {})
    loadHistory()
    connectWS()
    return () => {
      wsRef.current?.close()
      clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    betRef.current = bet
  }, [bet])

  useEffect(() => {
    if (candles.length > 0) drawChart()
  }, [candles, bet])

  const loadHistory = async () => {
    try {
      const r = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=' + CANDLE_COUNT)
      const data = await r.json()
      const c = data.map(k => ({
        open: parseFloat(k[1]), high: parseFloat(k[2]),
        low: parseFloat(k[3]), close: parseFloat(k[4]),
        isGreen: parseFloat(k[4]) >= parseFloat(k[1])
      }))
      candlesRef.current = c
      setCandles([...c])
      setCurrentPrice(c[c.length-1].close)
    } catch {}
  }

  const connectWS = () => {
    const ws = new WebSocket(BINANCE_WS)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      const k = d.k
      const candle = {
        open: parseFloat(k.o), high: parseFloat(k.h),
        low: parseFloat(k.l), close: parseFloat(k.c),
        isGreen: parseFloat(k.c) >= parseFloat(k.o)
      }
      setCurrentPrice(parseFloat(k.c))
      const arr = [...candlesRef.current]
      if (k.x) { // свеча закрылась
        arr.push(candle)
        if (arr.length > CANDLE_COUNT) arr.shift()
      } else { // обновляем последнюю
        arr[arr.length - 1] = candle
      }
      candlesRef.current = arr
      setCandles([...arr])

      // Проверяем результат ставки
      if (betRef.current && Date.now() >= betRef.current.endTime) {
        const b = betRef.current
        const won = b.direction === 'up' ? parseFloat(k.c) > b.startPrice : parseFloat(k.c) < b.startPrice
        finishBet(won, b.amount)
        betRef.current = null
        setBet(null)
      }
    }
    ws.onerror = () => setTimeout(connectWS, 3000)
    ws.onclose = () => setTimeout(connectWS, 3000)
  }

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height - 30
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background
    ctx.fillStyle = '#060f2a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = 'rgba(0,212,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke()
    }

    const prices = candles.flatMap(c => [c.high, c.low])
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const range = maxP - minP || 1
    const pad = range * 0.1
    const toY = p => H - ((p - minP + pad) / (range + pad * 2)) * H

    // Ставка линия
    if (bet) {
      const betY = toY(bet.startPrice)
      ctx.strokeStyle = bet.direction === 'up' ? 'rgba(0,230,118,0.5)' : 'rgba(255,77,106,0.5)'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, betY); ctx.lineTo(W, betY); ctx.stroke()
      ctx.setLineDash([])
    }

    const cw = W / candles.length
    candles.forEach((c, i) => {
      const x = i * cw
      const cw2 = cw * 0.7
      const openY = toY(c.open), closeY = toY(c.close)
      const highY = toY(c.high), lowY = toY(c.low)
      const color = c.isGreen ? '#00e676' : '#ff4d6a'

      // Фитиль
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + cw2/2, highY)
      ctx.lineTo(x + cw2/2, lowY)
      ctx.stroke()

      // Тело
      ctx.fillStyle = color
      const top = Math.min(openY, closeY)
      const h = Math.max(Math.abs(closeY - openY), 1.5)
      ctx.fillRect(x + (cw - cw2)/2, top, cw2, h)
    })

    // Текущая цена
    if (currentPrice) {
      const priceY = toY(currentPrice)
      ctx.strokeStyle = '#00d4ff'
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(W, priceY); ctx.stroke()
      ctx.setLineDash([])

      // Цена label
      ctx.fillStyle = '#00d4ff'
      ctx.font = 'bold 11px Orbitron, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('$' + currentPrice.toLocaleString('en', {maximumFractionDigits:0}), W - 4, priceY - 4)
    }

    // Цены по оси Y
    ctx.fillStyle = 'rgba(232,242,255,0.3)'
    ctx.font = '9px Orbitron, sans-serif'
    ctx.textAlign = 'left'
    for (let i = 0; i <= 4; i++) {
      const p = minP + (range * i / 4)
      const y = toY(p)
      ctx.fillText('$' + Math.round(p).toLocaleString('en'), 4, y - 2)
    }
  }

  const finishBet = async (won, betAmount) => {
    clearInterval(timerRef.current)
    setCountdown(0)
    try {
      const r = await api.post('/api/trading/bet', {
        amount: betAmount,
        direction: betRef.current?.direction || 'up',
        force_result: won
      })
      if (r.data.won) {
        updateBalance(-betAmount + r.data.profit)
        setResult({ won: true, profit: r.data.profit, amount: betAmount })
        showToast(`📈 ВЫИГРЫШ +${(r.data.profit - betAmount).toFixed(4)} TON!`)
      } else {
        updateBalance(-betAmount)
        setResult({ won: false, amount: betAmount })
        showToast('📉 Не угадал', true)
      }
    } catch {}
  }

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 5000)
  }

  const handleBet = async (direction) => {
    if (bet) return
    const val = parseFloat(amount)
    if (!val || val < parseFloat(config.trading_min_bet)) {
      showToast(`МИН. СТАВКА: ${config.trading_min_bet} TON`, true); return
    }
    if (val > balance) { showToast('НЕДОСТАТОЧНО СРЕДСТВ', true); return }

    const timerVal = parseInt(config.trading_timer) || 30
    const startPrice = currentPrice || 0
    const endTime = Date.now() + timerVal * 1000

    setBet({ direction, amount: val, startPrice, endTime })
    betRef.current = { direction, amount: val, startPrice, endTime }
    setResult(null)
    setCountdown(timerVal)

    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0 }
        return c - 1
      })
    }, 1000)
  }

  return (
    <div className="trading-wrap">
      {toast && <div className={`trading-toast ${toastErr?'err':''}`}>{toast}</div>}
      <div className="tr-header">
        <button className="tr-back" onClick={onBack}>←</button>
        <div className="tr-title">₿ ТРЕЙДИНГ BTC</div>
        <div className="tr-balance">{balance.toFixed(4)} TON</div>
      </div>

      <div className="tr-chart-wrap">
        {countdown > 0 && (
          <div className="tr-overlay">
            <div className={`tr-direction-label ${bet?.direction}`}>
              {bet?.direction === 'up' ? '📈 ВВЕРХ' : '📉 ВНИЗ'}
            </div>
            <div className="tr-countdown">{countdown}с</div>
          </div>
        )}
        <canvas ref={canvasRef} width={360} height={240} className="tr-canvas"/>
      </div>

      {result && (
        <div className={`tr-result ${result.won?'win':'lose'}`}>
          {result.won
            ? `🎉 ВЫИГРЫШ! +${(result.profit - result.amount).toFixed(4)} TON (x${parseFloat(config.trading_multiplier).toFixed(1)})`
            : `😢 Не угадал. Потеряно ${result.amount} TON`}
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

      <div className="tr-mult">
        Коэффициент: <span>x{parseFloat(config.trading_multiplier).toFixed(1)}</span>
        {' · '}Таймер: <span>{config.trading_timer}с</span>
        {currentPrice && <> · <span>${currentPrice.toLocaleString('en', {maximumFractionDigits:0})}</span></>}
      </div>

      <div className="tr-btns">
        <button className="tr-btn up" onClick={()=>handleBet('up')} disabled={!!bet || countdown>0}>
          {countdown>0 && bet?.direction==='up' ? `📈 ${countdown}с` : '📈 ВВЕРХ'}
        </button>
        <button className="tr-btn down" onClick={()=>handleBet('down')} disabled={!!bet || countdown>0}>
          {countdown>0 && bet?.direction==='down' ? `📉 ${countdown}с` : '📉 ВНИЗ'}
        </button>
      </div>
    </div>
  )
}
