import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Trading.css'

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@kline_1m'
const CANDLE_COUNT = 30
const VISIBLE = 20 // сколько свечей видно, последняя по центру

export default function Trading({ user, onBack }) {
  const { updateBalance } = useUserStore()
  const [amount, setAmount] = useState('0.1')
  const [candles, setCandles] = useState([])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [bet, setBet] = useState(null)
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
    return () => { wsRef.current?.close(); clearInterval(timerRef.current) }
  }, [])

  useEffect(() => { betRef.current = bet }, [bet])

  useEffect(() => { if (candles.length > 0) drawChart() }, [candles, bet, countdown])

  const loadHistory = async () => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=${CANDLE_COUNT}`)
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
      const price = parseFloat(k.c)
      setCurrentPrice(price)
      const arr = [...candlesRef.current]
      if (k.x) { arr.push(candle); if (arr.length > CANDLE_COUNT) arr.shift() }
      else { arr[arr.length - 1] = candle }
      candlesRef.current = arr
      setCandles([...arr])

      if (betRef.current && Date.now() >= betRef.current.endTime) {
        const b = betRef.current
        const won = b.direction === 'up' ? price > b.startPrice : price < b.startPrice
        betRef.current = null
        setBet(null)
        finishBet(won, b.amount, b.direction)
      }
    }
    ws.onerror = () => setTimeout(connectWS, 3000)
    ws.onclose = () => setTimeout(connectWS, 3000)
  }

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#060f2a'
    ctx.fillRect(0, 0, W, H)

    // Последняя свеча по центру — берём VISIBLE свечей, последняя в центре
    const half = Math.floor(VISIBLE / 2)
    const lastIdx = candles.length - 1
    const startIdx = Math.max(0, lastIdx - half)
    const endIdx = Math.min(candles.length - 1, lastIdx + half)
    const visible = candles.slice(startIdx, endIdx + 1)

    const prices = visible.flatMap(c => [c.high, c.low])
    if (bet?.startPrice) prices.push(bet.startPrice)
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const range = maxP - minP || 1
    const pad = range * 0.15
    const toY = p => H * 0.9 - ((p - minP + pad) / (range + pad * 2)) * (H * 0.8)

    // Grid
    ctx.strokeStyle = 'rgba(0,212,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const p = minP + range * i / 4
      const y = toY(p)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.fillStyle = 'rgba(232,242,255,0.2)'
      ctx.font = '8px Orbitron, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('$' + Math.round(p).toLocaleString('en'), 4, y - 2)
    }

    const cw = W / VISIBLE
    const centerX = W / 2 // последняя свеча по центру

    visible.forEach((c, i) => {
      // Позиция: последняя свеча (i === visible.length-1) в центре
      const offsetFromLast = i - (visible.length - 1)
      const x = centerX + offsetFromLast * cw
      const cw2 = cw * 0.6
      const openY = toY(c.open), closeY = toY(c.close)
      const highY = toY(c.high), lowY = toY(c.low)
      const color = c.isGreen ? '#00e676' : '#ff4d6a'

      ctx.strokeStyle = color + '99'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      ctx.fillStyle = color
      const top = Math.min(openY, closeY)
      const h = Math.max(Math.abs(closeY - openY), 1.5)
      ctx.fillRect(x - cw2/2, top, cw2, h)
    })

    // Точка входа с таймером и направлением
    if (bet) {
      const entryY = toY(bet.startPrice)
      const color = bet.direction === 'up' ? '#00e676' : '#ff4d6a'

      // Пунктирная линия входа
      ctx.strokeStyle = color
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, entryY); ctx.lineTo(W, entryY); ctx.stroke()
      ctx.setLineDash([])

      // Точка входа (на центре — последняя свеча)
      ctx.beginPath()
      ctx.arc(centerX, entryY, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Метка направление + таймер
      const arrow = bet.direction === 'up' ? '▲' : '▼'
      const label = `${arrow} ${countdown}с`
      ctx.font = 'bold 11px Orbitron, sans-serif'
      const tw = ctx.measureText(label).width
      const lx = centerX + 12
      const ly = entryY - 8

      ctx.fillStyle = color + 'cc'
      ctx.beginPath()
      ctx.roundRect(lx - 4, ly - 12, tw + 8, 16, 4)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.fillText(label, lx, ly)

      // Стрелка направления справа
      const arrowSize = 16
      const ax = W - 20, ay = entryY
      ctx.fillStyle = color
      ctx.beginPath()
      if (bet.direction === 'up') {
        ctx.moveTo(ax, ay - arrowSize); ctx.lineTo(ax + arrowSize/2, ay); ctx.lineTo(ax - arrowSize/2, ay)
      } else {
        ctx.moveTo(ax, ay + arrowSize); ctx.lineTo(ax + arrowSize/2, ay); ctx.lineTo(ax - arrowSize/2, ay)
      }
      ctx.closePath(); ctx.fill()
    }

    // Текущая цена
    if (currentPrice) {
      const priceY = toY(currentPrice)
      const isUp = candles.length > 1 && currentPrice >= candles[candles.length-2]?.close
      ctx.strokeStyle = isUp ? '#00e676' : '#ff4d6a'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(W, priceY); ctx.stroke()

      // Цена badge справа
      const priceStr = '$' + currentPrice.toLocaleString('en', {maximumFractionDigits:0})
      ctx.font = 'bold 10px Orbitron, sans-serif'
      const pw = ctx.measureText(priceStr).width
      ctx.fillStyle = isUp ? '#00e676' : '#ff4d6a'
      ctx.fillRect(W - pw - 10, priceY - 9, pw + 8, 14)
      ctx.fillStyle = '#050a1a'
      ctx.textAlign = 'right'
      ctx.fillText(priceStr, W - 5, priceY + 2)
    }

    // Вертикальная линия по центру (текущая свеча)
    ctx.strokeStyle = 'rgba(0,212,255,0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, H); ctx.stroke()
    ctx.setLineDash([])
  }

  const finishBet = async (won, betAmount, direction) => {
    clearInterval(timerRef.current)
    setCountdown(0)
    try {
      const r = await api.post('/api/trading/bet', { amount: betAmount, direction, force_result: won })
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

  const handleBet = (direction) => {
    if (bet) return
    const val = parseFloat(amount)
    if (!val || val < parseFloat(config.trading_min_bet)) { showToast(`МИН. СТАВКА: ${config.trading_min_bet} TON`, true); return }
    if (val > balance) { showToast('НЕДОСТАТОЧНО СРЕДСТВ', true); return }

    const timerVal = parseInt(config.trading_timer) || 30
    const startPrice = currentPrice || 0
    const endTime = Date.now() + timerVal * 1000
    const b = { direction, amount: val, startPrice, endTime }
    setBet(b); betRef.current = b
    setResult(null)
    setCountdown(timerVal)

    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0 } return c - 1 })
    }, 1000)
  }

  return (
    <div className="trading-wrap">
      {toast && <div className={`trading-toast ${toastErr?'err':''}`}>{toast}</div>}
      <div className="tr-header">
        <button className="tr-back" onClick={onBack}>←</button>
        <div className="tr-title">₿ BTC / USDT</div>
        <div className="tr-balance">{balance.toFixed(4)} TON</div>
      </div>

      <div className="tr-chart-wrap">
        <canvas ref={canvasRef} width={360} height={220} className="tr-canvas"/>
      </div>

      {result && (
        <div className={`tr-result ${result.won?'win':'lose'}`}>
          {result.won
            ? `🎉 ВЫИГРЫШ! +${(result.profit - result.amount).toFixed(4)} TON`
            : `😢 Не угадал. -${result.amount} TON`}
        </div>
      )}

      <div className="tr-bet-row">
        <div className="tr-bet-label">СТАВКА (TON)</div>
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
        x{parseFloat(config.trading_multiplier).toFixed(1)} выплата · {config.trading_timer}с таймер
      </div>

      <div className="tr-btns">
        <button className="tr-btn up" onClick={()=>handleBet('up')} disabled={!!bet}>
          📈 ВВЕРХ
        </button>
        <button className="tr-btn down" onClick={()=>handleBet('down')} disabled={!!bet}>
          📉 ВНИЗ
        </button>
      </div>
    </div>
  )
}
