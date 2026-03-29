import { useState, useEffect, useRef, useCallback } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Trading.css'

const INTERVALS = [
  { label: '1м', value: '1m', seconds: 60 },
  { label: '2м', value: '2m', seconds: 120 },
  { label: '3м', value: '3m', seconds: 180 },
  { label: '5м', value: '5m', seconds: 300 },
]

export default function Trading({ user, onBack }) {
  const { updateBalance } = useUserStore()
  const [amount, setAmount] = useState('0.1')
  const [candles, setCandles] = useState([])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [bet, setBet] = useState(null)
  const [result, setResult] = useState(null)
  const [config, setConfig] = useState({ trading_multiplier: 1.9, trading_min_bet: 0.01 })
  const [countdown, setCountdown] = useState(0)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const [interval, setInterval2] = useState(INTERVALS[0])
  const [history, setHistory] = useState([])
  const [scrollOffset, setScrollOffset] = useState(0) // сколько свечей сдвинуто влево
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const candlesRef = useRef([])
  const betRef = useRef(null)
  const scrollRef = useRef(0)
  const isDragging = useRef(false)
  const dragStart = useRef(0)
  const balance = parseFloat(user?.balance_ton ?? 0)
  const VISIBLE = 40

  useEffect(() => {
    api.get('/api/trading/info').then(r => setConfig(r.data)).catch(() => {})
    loadHistory()
  }, [])

  useEffect(() => {
    loadCandles()
    connectWS()
    return () => { wsRef.current?.close(); clearInterval(timerRef.current) }
  }, [interval])

  useEffect(() => { betRef.current = bet }, [bet])

  useEffect(() => { if (candles.length > 0) drawChart() }, [candles, bet, countdown, scrollOffset])

  const loadCandles = async () => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=TONUSDT&interval=${interval.value}&limit=100`)
      const data = await r.json()
      const c = data.map(k => ({
        open: parseFloat(k[1]), high: parseFloat(k[2]),
        low: parseFloat(k[3]), close: parseFloat(k[4]),
        isGreen: parseFloat(k[4]) >= parseFloat(k[1]),
        time: k[0]
      }))
      candlesRef.current = c
      setCandles([...c])
      setCurrentPrice(c[c.length-1].close)
    } catch {}
  }

  const loadHistory = async () => {
    try {
      const r = await api.get('/api/trading/history')
      setHistory(r.data || [])
    } catch {}
  }

  const connectWS = () => {
    wsRef.current?.close()
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/tonusdt@kline_${interval.value}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      const k = d.k
      const candle = {
        open: parseFloat(k.o), high: parseFloat(k.h),
        low: parseFloat(k.l), close: parseFloat(k.c),
        isGreen: parseFloat(k.c) >= parseFloat(k.o),
        time: k.t
      }
      const price = parseFloat(k.c)
      setCurrentPrice(price)
      const arr = [...candlesRef.current]
      if (k.x) { arr.push(candle); if (arr.length > 200) arr.shift() }
      else { arr[arr.length - 1] = candle }
      candlesRef.current = arr
      setCandles([...arr])

      if (betRef.current && Date.now() >= betRef.current.endTime) {
        const b = betRef.current
        const diff = Math.abs(price - b.startPrice)
        const won = diff < 0.0001 ? null : (b.direction === 'up' ? price > b.startPrice : price < b.startPrice)
        betRef.current = null
        setBet(null)
        finishBet(won, b.amount, b.direction)
      }
    }
    ws.onerror = () => setTimeout(connectWS, 3000)
    ws.onclose = () => {}
  }

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#060f2a'
    ctx.fillRect(0, 0, W, H)

    const total = candles.length
    const offset = Math.max(0, Math.min(scrollRef.current, total - VISIBLE))
    const startIdx = Math.max(0, total - VISIBLE - offset)
    const endIdx = Math.min(total - 1, startIdx + VISIBLE - 1)
    const visible = candles.slice(startIdx, endIdx + 1)

    const prices = visible.flatMap(c => [c.high, c.low])
    if (bet?.startPrice) prices.push(bet.startPrice)
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const range = maxP - minP || 0.001
    const pad = range * 0.12
    const priceH = H - 20
    const toY = p => priceH - ((p - minP + pad) / (range + pad * 2)) * priceH

    // Grid
    ctx.strokeStyle = 'rgba(0,212,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = priceH * i / 4
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 50, y); ctx.stroke()
      const p = maxP + pad - (range + pad * 2) * i / 4
      ctx.fillStyle = 'rgba(232,242,255,0.25)'
      ctx.font = '8px Orbitron, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('$' + p.toFixed(3), W - 48, y + 3)
    }

    const cw = (W - 50) / VISIBLE
    visible.forEach((c, i) => {
      const x = i * cw + cw / 2
      const cw2 = Math.max(cw * 0.6, 1)
      const openY = toY(c.open), closeY = toY(c.close)
      const highY = toY(c.high), lowY = toY(c.low)
      const color = c.isGreen ? '#00e676' : '#ff4d6a'

      ctx.strokeStyle = color + '88'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, highY); ctx.lineTo(x, lowY); ctx.stroke()

      ctx.fillStyle = color
      const top = Math.min(openY, closeY)
      const h = Math.max(Math.abs(closeY - openY), 1.5)
      ctx.fillRect(x - cw2/2, top, cw2, h)

      // Время под свечой
      if (i % Math.ceil(VISIBLE / 6) === 0) {
        const d = new Date(c.time)
        ctx.fillStyle = 'rgba(232,242,255,0.25)'
        ctx.font = '7px DM Sans, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`, x, H - 4)
      }
    })

    // Линия входа
    if (bet) {
      const entryY = toY(bet.startPrice)
      const col = bet.direction === 'up' ? '#00e676' : '#ff4d6a'

      ctx.strokeStyle = col
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, entryY); ctx.lineTo(W - 50, entryY); ctx.stroke()
      ctx.setLineDash([])

      // Точка входа на последней видимой свече
      const lastX = (visible.length - 1) * cw + cw / 2
      ctx.beginPath()
      ctx.arc(lastX, entryY, 5, 0, Math.PI * 2)
      ctx.fillStyle = col
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Метка
      const lbl = `${bet.direction === 'up' ? '▲' : '▼'} ${countdown}с`
      ctx.font = 'bold 10px Orbitron, sans-serif'
      const tw = ctx.measureText(lbl).width
      ctx.fillStyle = col + 'dd'
      ctx.beginPath()
      ctx.roundRect(lastX + 8, entryY - 11, tw + 8, 15, 4)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.fillText(lbl, lastX + 12, entryY)
    }

    // Текущая цена badge
    if (currentPrice && offset === 0) {
      const priceY = toY(currentPrice)
      const isUp = candles.length > 1 && currentPrice >= candles[candles.length-2]?.close
      const col = isUp ? '#00e676' : '#ff4d6a'
      const ps = '$' + currentPrice.toFixed(3)
      ctx.font = 'bold 9px Orbitron, sans-serif'
      const pw = ctx.measureText(ps).width
      ctx.fillStyle = col
      ctx.fillRect(W - pw - 16, priceY - 8, pw + 12, 14)
      ctx.fillStyle = '#050a1a'
      ctx.textAlign = 'right'
      ctx.fillText(ps, W - 6, priceY + 2)

      ctx.strokeStyle = col + '44'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(W - pw - 16, priceY); ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Скролл мышью/тачем
  const onWheel = (e) => {
    e.preventDefault()
    scrollRef.current = Math.max(0, Math.min(scrollRef.current + (e.deltaY > 0 ? -2 : 2), candles.length - VISIBLE))
    setScrollOffset(scrollRef.current)
  }

  const onTouchStart = (e) => { isDragging.current = true; dragStart.current = e.touches[0].clientX }
  const onTouchMove = (e) => {
    if (!isDragging.current) return
    const dx = e.touches[0].clientX - dragStart.current
    const delta = Math.round(dx / 8)
    scrollRef.current = Math.max(0, Math.min(scrollRef.current - delta, candles.length - VISIBLE))
    setScrollOffset(scrollRef.current)
    dragStart.current = e.touches[0].clientX
  }
  const onTouchEnd = () => { isDragging.current = false }

  const finishBet = async (won, betAmount, direction) => {
    clearInterval(timerRef.current)
    setCountdown(0)
    try {
      if (won === null) {
        // Цена не изменилась — возврат средств
        setResult({ won: null, amount: betAmount })
        showToast('🔄 Цена не изменилась — возврат средств')
        await api.post('/api/trading/result', { amount: betAmount, won: null })
        return
      }
      const r = await api.post('/api/trading/result', { amount: betAmount, won })
      if (won) {
        updateBalance(-betAmount + r.data.profit)
        setResult({ won: true, profit: r.data.profit, amount: betAmount })
        showToast(`📈 ВЫИГРЫШ +${(r.data.profit - betAmount).toFixed(4)} TON!`)
      } else {
        updateBalance(-betAmount)
        setResult({ won: false, amount: betAmount })
        showToast('📉 Не угадал', true)
      }
      loadHistory()
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

    const timerSec = interval.seconds
    const startPrice = currentPrice || 0
    const endTime = Date.now() + timerSec * 1000
    const b = { direction, amount: val, startPrice, endTime }
    setBet(b); betRef.current = b
    setResult(null)
    setCountdown(timerSec)

    const t = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(t); return 0 } return c - 1 })
    }, 1000)
    timerRef.current = t
  }

  return (
    <div className="trading-wrap">
      {toast && <div className={`trading-toast ${toastErr?'err':''}`}>{toast}</div>}
      <div className="tr-header">
        <button className="tr-back" onClick={onBack}>←</button>
        <div className="tr-title">💎 TON / USDT</div>
        <div className="tr-balance">{balance.toFixed(4)} TON</div>
      </div>

      <div className="tr-intervals">
        {INTERVALS.map(iv => (
          <button key={iv.value} className={`tr-iv-btn ${interval.value===iv.value?'on':''}`}
            onClick={() => { setInterval2(iv); scrollRef.current = 0; setScrollOffset(0) }}>
            {iv.label}
          </button>
        ))}
        {currentPrice && <span className="tr-live-price">${currentPrice.toFixed(3)}</span>}
      </div>

      <div className="tr-chart-wrap"
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <canvas ref={canvasRef} width={360} height={220} className="tr-canvas"/>
      </div>

      {result && (
        <div className={`tr-result ${result.won===null?'refund':result.won?'win':'lose'}`}>
          {result.won===null ? `🔄 Возврат ${result.amount} TON`
            : result.won ? `🎉 +${(result.profit-result.amount).toFixed(4)} TON (x${parseFloat(config.trading_multiplier).toFixed(1)})`
            : `😢 -${result.amount} TON`}
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
        x{parseFloat(config.trading_multiplier).toFixed(1)} выплата · {interval.label} таймер
      </div>

      <div className="tr-btns">
        <button className="tr-btn up" onClick={()=>handleBet('up')} disabled={!!bet}>📈 ВВЕРХ</button>
        <button className="tr-btn down" onClick={()=>handleBet('down')} disabled={!!bet}>📉 ВНИЗ</button>
      </div>

      {history.length > 0 && (
        <div className="tr-history">
          <div className="tr-hist-title">МОИ СДЕЛКИ</div>
          {history.map((h, i) => (
            <div key={i} className={`tr-hist-item ${h.amount > 0 ? 'win' : h.amount === 0 ? 'refund' : 'lose'}`}>
              <span className="tr-hist-icon">{h.amount > 0 ? '📈' : h.amount === 0 ? '🔄' : '📉'}</span>
              <span className="tr-hist-label">{h.label?.replace('Трейдинг BTC: ', '') || '—'}</span>
              <span className="tr-hist-date">{new Date(h.created_at).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
              <span className="tr-hist-amt">{parseFloat(h.amount) > 0 ? '+' : ''}{parseFloat(h.amount).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
