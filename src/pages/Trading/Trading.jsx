import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Trading.css'

const TF = [
  { label: '1м', value: '1' },
  { label: '3м', value: '3' },
  { label: '5м', value: '5' },
  { label: '15м', value: '15' },
]
const BET_TIMES = [
  { label: '1м', seconds: 60 },
  { label: '2м', seconds: 120 },
  { label: '3м', seconds: 180 },
  { label: '5м', seconds: 300 },
]

const CANDLE_W = 10 // ширина свечи в пикселях
const CANDLE_GAP = 3

export default function Trading({ user, onBack }) {
  const { updateBalance } = useUserStore()
  const [amount, setAmount] = useState('0.1')
  const [candles, setCandles] = useState([])
  const [currentPrice, setCurrentPrice] = useState(null)
  const [bet, setBet] = useState(null)
  const [result, setResult] = useState(null)
  const [config, setConfig] = useState({ trading_multiplier: 1.9, trading_min_bet: 0.01, trading_enabled: '1' })
  const [configLoaded, setConfigLoaded] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const [tf, setTf] = useState(TF[0])
  const [betTime, setBetTime] = useState(BET_TIMES[0])
  const [history, setHistory] = useState([])
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const candlesRef = useRef([])
  const betRef = useRef(null)
  // Скролл — offsetX = сколько пикселей сдвинуто от правого края
  const offsetXRef = useRef(0)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const CANDLE_W_REF = useRef(8)
  const CANDLE_GAP_REF = useRef(2)
  const [, forceRedraw] = useState(0)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    api.get('/api/trading/info').then(r => { setConfig(r.data); setConfigLoaded(true) }).catch(() => { setConfigLoaded(true) })
    loadHistory()
  }, [])

  useEffect(() => {
    loadCandles()
    connectWS()
    return () => { wsRef.current?.close(); clearInterval(timerRef.current) }
  }, [tf])

  useEffect(() => { betRef.current = bet }, [bet])

  useEffect(() => { drawChart() }, [candles, bet, countdown])

  const loadCandles = async () => {
    try {
      const r = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=TONUSDT&interval=${tf.value}&limit=200`)
      const data = await r.json()
      const raw = (data.result?.list || []).reverse()
      const c = raw.map(k => ({
        open: parseFloat(k[1]), high: parseFloat(k[2]),
        low: parseFloat(k[3]), close: parseFloat(k[4]),
        isGreen: parseFloat(k[4]) >= parseFloat(k[1]),
        time: parseInt(k[0])
      }))
      candlesRef.current = c
      offsetXRef.current = 0
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
    const ws = new WebSocket(`wss://stream.bybit.com/v5/public/spot`)
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.${tf.value}.TONUSDT`] }))
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.topic && msg.data?.[0]) {
        const k = msg.data[0]
        const candle = {
          open: parseFloat(k.open), high: parseFloat(k.high),
          low: parseFloat(k.low), close: parseFloat(k.close),
          isGreen: parseFloat(k.close) >= parseFloat(k.open),
          time: parseInt(k.start)
        }
        const price = parseFloat(k.close)
        setCurrentPrice(price)
        const arr = [...candlesRef.current]
        if (k.confirm) { arr.push(candle); if (arr.length > 300) arr.shift() }
        else arr[arr.length - 1] = candle
        candlesRef.current = arr
        setCandles([...arr])

        if (betRef.current && Date.now() >= betRef.current.endTime) {
          const b = betRef.current
          const diff = Math.abs(price - b.startPrice)
          const won = diff < 0.0001 ? null : b.direction === 'up' ? price > b.startPrice : price < b.startPrice
          betRef.current = null; setBet(null)
          finishBet(won, b.amount)
        }
      }
    }
    ws.onerror = ws.onclose = () => setTimeout(connectWS, 3000)
  }

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    const W = canvas.width, H = canvas.height
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const Wr = rect.width, Hr = rect.height
    ctx.clearRect(0, 0, Wr, Hr)
    ctx.fillStyle = '#060f2a'
    ctx.fillRect(0, 0, Wr, Hr)

    const all = candlesRef.current
    if (all.length === 0) return

    const step = CANDLE_W_REF.current + CANDLE_GAP_REF.current
    // Правый край: последняя свеча рисуется справа с отступом
    // offsetXRef.current = смещение влево в пикселях (0 = последняя свеча у правого края)
    const PRICE_PANEL = 52

    // Какие свечи видны
    const chartW = Wr - PRICE_PANEL
    const rightPad = 20
    // Индекс последней видимой свечи
    const lastVisible = Math.floor((offsetXRef.current) / step)
    const lastIdx = Math.max(0, all.length - 1 - lastVisible)
    // Сколько свечей влезает
    const visCount = Math.floor((chartW - rightPad) / step) + 1
    const firstIdx = Math.max(0, lastIdx - visCount + 1)
    const visible = all.slice(firstIdx, lastIdx + 1)

    if (visible.length === 0) return

    const prices = visible.flatMap(c => [c.high, c.low])
    if (bet?.startPrice) prices.push(bet.startPrice)
    const minP = Math.min(...prices), maxP = Math.max(...prices)
    const range = maxP - minP || 0.001
    const pad = range * 0.15
    const pH = Hr - 18
    const toY = p => pH - ((p - minP + pad) / (range + pad * 2)) * pH

    // Grid
    for (let i = 0; i <= 4; i++) {
      const p = minP - pad + (range + pad * 2) * (1 - i / 4)
      const y = toY(p)
      ctx.strokeStyle = 'rgba(0,212,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke()
      ctx.fillStyle = 'rgba(232,242,255,0.3)'
      ctx.font = '8px Orbitron, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('$' + p.toFixed(3), chartW + 3, y + 3)
    }

    // Рисуем свечи справа налево
    visible.forEach((c, i) => {
      // x последней свечи = chartW - rightPad - offset_внутри_экрана
      const distFromRight = (visible.length - 1 - i)
      const x = chartW - rightPad - distFromRight * step
      if (x < -CANDLE_W) return

      const openY = toY(c.open), closeY = toY(c.close)
      const highY = toY(c.high), lowY = toY(c.low)
      const color = c.isGreen ? '#00e676' : '#ff4d6a'

      ctx.strokeStyle = color + '99'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x + CANDLE_W_REF.current/2, highY); ctx.lineTo(x + CANDLE_W_REF.current/2, lowY); ctx.stroke()

      ctx.fillStyle = color
      const top = Math.min(openY, closeY)
      const h = Math.max(Math.abs(closeY - openY), 1.5)
      ctx.fillRect(x, top, Math.max(CANDLE_W_REF.current, 1.5), h)

      // Время
      if (distFromRight % Math.ceil(visCount / 5) === 0) {
        const d = new Date(c.time)
        ctx.fillStyle = 'rgba(232,242,255,0.2)'
        ctx.font = '7px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`, x + CANDLE_W_REF.current/2, H - 4)
      }
    })

    // Линия входа
    if (bet) {
      const entryY = toY(bet.startPrice)
      const entryX = chartW - rightPad

      // Цвет зависит от текущей цены vs цена входа
      const curPrice = candlesRef.current[candlesRef.current.length - 1]?.close || bet.startPrice
      const diff = curPrice - bet.startPrice
      let col
      if (Math.abs(diff) < 0.0001) col = '#888888' // равная — серый
      else if (bet.direction === 'up') col = diff > 0 ? '#26a69a' : '#ef5350'
      else col = diff < 0 ? '#26a69a' : '#ef5350'

      ctx.strokeStyle = col
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, entryY); ctx.lineTo(chartW, entryY); ctx.stroke()
      ctx.setLineDash([])

      // Точка
      ctx.beginPath(); ctx.arc(entryX, entryY, 5, 0, Math.PI * 2)
      ctx.fillStyle = col; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()

      // Метка — ВЕРХ/НИЗ + таймер
      const dirLabel = bet.direction === 'up' ? 'ВЕРХ' : 'НИЗ'
      const lbl = `${dirLabel} ${countdown}с`
      ctx.font = 'bold 10px Orbitron, sans-serif'
      const tw = ctx.measureText(lbl).width
      const lx = Math.max(4, entryX - tw - 20)
      ctx.fillStyle = col + 'dd'
      ctx.beginPath(); ctx.roundRect(lx - 2, entryY - 12, tw + 10, 16, 4); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'
      ctx.fillText(lbl, lx + 3, entryY + 1)
    }

    // Текущая цена
    if (currentPrice && offsetXRef.current < 30) {
      const priceY = toY(currentPrice)
      const isUp = all.length > 1 && currentPrice >= all[all.length-2]?.close
      const col = isUp ? '#00e676' : '#ff4d6a'
      ctx.strokeStyle = col + '44'
      ctx.setLineDash([2, 4]); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(chartW, priceY); ctx.stroke()
      ctx.setLineDash([])
      const ps = '$' + currentPrice.toFixed(3)
      ctx.font = 'bold 9px Orbitron, sans-serif'
      const pw = ctx.measureText(ps).width
      ctx.fillStyle = col
      ctx.fillRect(chartW + 2, priceY - 8, PRICE_PANEL - 4, 14)
      ctx.fillStyle = '#050a1a'
      ctx.textAlign = 'center'
      ctx.fillText(ps, chartW + PRICE_PANEL/2, priceY + 2)
    }
  }

  // Touch скролл как на бирже — свайп вправо = смотрим историю (прошлое)
  const onTouchStart = e => {
    // Только если тач на графике — блокируем скролл страницы
    isDragging.current = true
    lastX.current = e.touches[0].clientX
  }
  const onTouchMove = e => {
    if (!isDragging.current) return
    e.stopPropagation() // не мешаем скроллу страницы по вертикали
    const dx = e.touches[0].clientX - lastX.current // вправо = положительный = в прошлое
    lastX.current = e.touches[0].clientX
    const step = CANDLE_W_REF.current + CANDLE_GAP_REF.current
    const maxOffset = (candlesRef.current.length - 5) * step
    offsetXRef.current = Math.max(0, Math.min(offsetXRef.current + dx, maxOffset))
    drawChart()
  }
  const onTouchEnd = () => { isDragging.current = false }
  const onMouseDown = e => { isDragging.current = true; lastX.current = e.clientX; e.preventDefault() }
  const onMouseMove = e => {
    if (!isDragging.current) return
    const dx = e.clientX - lastX.current // вправо = в прошлое
    lastX.current = e.clientX
    const step = CANDLE_W_REF.current + CANDLE_GAP_REF.current
    const maxOffset = (candlesRef.current.length - 5) * step
    offsetXRef.current = Math.max(0, Math.min(offsetXRef.current + dx, maxOffset))
    drawChart()
  }
  const onMouseUp = () => { isDragging.current = false }
  const onWheel = e => {
    e.preventDefault()
    const step = CANDLE_W_REF.current + CANDLE_GAP_REF.current
    const maxOffset = (candlesRef.current.length - 5) * step
    // Горизонтальный скролл — колесо влево/вправо
    offsetXRef.current = Math.max(0, Math.min(offsetXRef.current - e.deltaY * 0.5, maxOffset))
    drawChart()
  }

  // Зум кнопками
  const zoomIn = () => {
    CANDLE_W_REF.current = Math.min(CANDLE_W_REF.current + 2, 20)
    CANDLE_GAP_REF.current = Math.max(CANDLE_GAP_REF.current - 0.5, 1)
    drawChart()
  }
  const zoomOut = () => {
    CANDLE_W_REF.current = Math.max(CANDLE_W_REF.current - 2, 4)
    CANDLE_GAP_REF.current = Math.min(CANDLE_GAP_REF.current + 0.5, 3)
    drawChart()
  }

  const finishBet = async (won, betAmount) => {
    clearInterval(timerRef.current); setCountdown(0)
    try {
      if (won === null) {
        setResult({ won: null, amount: betAmount })
        showToast('🔄 Цена не изменилась — возврат средств')
        await api.post('/api/trading/result', { amount: betAmount, won: null })
        // Перезагружаем конфиг
        api.get('/api/trading/info').then(r => setConfig(r.data)).catch(() => {})
        return
      }
      const r = await api.post('/api/trading/result', { amount: betAmount, won })
      if (won) {
        updateBalance(-betAmount + r.data.profit)
        setResult({ won: true, profit: r.data.profit, amount: betAmount })
        showToast(`📈 +${(r.data.profit - betAmount).toFixed(4)} TON!`)
      } else {
        updateBalance(-betAmount)
        setResult({ won: false, amount: betAmount })
        showToast('📉 Не угадал', true)
      }
      loadHistory()
      // Перезагружаем конфиг — если банк пустой трейдинг отключится
      api.get('/api/trading/info').then(r => setConfig(r.data)).catch(() => {})
    } catch (e) {
      if (e?.response?.data?.disabled) {
        setConfig(c => ({...c, trading_enabled: '0'}))
        showToast('⚠️ Трейдинг отключён — банк пуст', true)
      } else {
        showToast(e?.response?.data?.error || 'Ошибка', true)
      }
    }
  }

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 5000)
  }

  const handleBet = dir => {
    if (bet) return
    const val = parseFloat(amount)
    if (!val || val < parseFloat(config.trading_min_bet)) { showToast(`МИН.: ${config.trading_min_bet} TON`, true); return }
    if (val > balance) { showToast('НЕДОСТАТОЧНО', true); return }
    const b = { direction: dir, amount: val, startPrice: currentPrice || 0, endTime: Date.now() + betTime.seconds * 1000 }
    setBet(b); betRef.current = b; setResult(null)
    setCountdown(betTime.seconds)
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) {
        clearInterval(t)
        // Принудительно закрываем позицию если WS не закрыл
        setTimeout(() => {
          if (betRef.current) {
            const b = betRef.current
            const price = candlesRef.current[candlesRef.current.length - 1]?.close || b.startPrice
            const diff = Math.abs(price - b.startPrice) / b.startPrice
            const won = diff < 0.00005 ? null : (b.direction === 'up' ? price > b.startPrice : price < b.startPrice)
            betRef.current = null
            setBet(null)
            finishBet(won, b.amount)
          }
        }, 1500) // даём 1.5с на последнее сообщение WS
        return 0
      }
      return c - 1
    }), 1000)
    timerRef.current = t
  }

  if (!configLoaded) return (
    <div className="trading-wrap">
      <div className="tr-header"><button className="tr-back" onClick={onBack}>←</button><div className="tr-title">💎 TON/USDT</div></div>
      <div className="tr-maintenance"><div className="tr-maint-icon">⏳</div><div className="tr-maint-text">Загрузка...</div></div>
    </div>
  )

  if (config.trading_enabled === '0') return (
    <div className="trading-wrap">
      <div className="tr-header"><button className="tr-back" onClick={onBack}>←</button><div className="tr-title">💎 TON/USDT</div></div>
      <div className="tr-maintenance">
        <div className="tr-maint-icon">🔧</div>
        <div className="tr-maint-title">ТЕХНИЧЕСКИЕ РАБОТЫ</div>
        <div className="tr-maint-text">Трейдинг временно недоступен.<br/>Скоро вернёмся!</div>
      </div>
    </div>
  )

  return (
    <div className="trading-wrap">
      {toast && <div className={`trading-toast ${toastErr?'err':''}`}>{toast}</div>}
      <div className="tr-header">
        <button className="tr-back" onClick={onBack}>←</button>
        <div className="tr-title">💎 TON / USDT</div>
        <div className="tr-balance">{balance.toFixed(4)} TON</div>
      </div>

      <div className="tr-tf-row">
        {TF.map(t => (
          <button key={t.value} className={`tr-tf-btn ${tf.value===t.value?'on':''}`}
            onClick={() => { setTf(t); offsetXRef.current = 0 }}>{t.label}</button>
        ))}
        {currentPrice && <span className="tr-live-price">${currentPrice.toFixed(3)}</span>}
      </div>

      <div className="tr-controls-row">
        <button className="tr-ctrl-btn" onClick={zoomOut}>−</button>
        <button className="tr-ctrl-btn" onClick={zoomIn}>+</button>
        {offsetXRef.current > 0 && <button className="tr-ctrl-btn tr-live-btn" onClick={() => { offsetXRef.current = 0; drawChart() }}>▶ LIVE</button>}
      </div>
      <div className="tr-chart-wrap" style={{touchAction:'pan-y',cursor:'grab'}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel}>
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
        <div className="tr-bet-label" style={{marginTop:10}}>ВРЕМЯ СТАВКИ</div>
        <div className="tr-bet-inputs">
          {BET_TIMES.map(bt => (
            <button key={bt.label} className={`tr-bet-btn ${betTime.seconds===bt.seconds?'on':''}`}
              onClick={()=>setBetTime(bt)} disabled={!!bet}>{bt.label}</button>
          ))}
        </div>
        {(() => {
          const val = parseFloat(amount) || 0
          const pct = parseFloat(config.trading_multiplier) || 90
          const multiplier = pct > 10 ? 1 + pct / 100 : pct
          const payout = val * multiplier
          const profit = payout - val
          return val > 0 ? (
            <div className="tr-payout-info">
              <div className="tr-payout-row">
                <span>Ставка</span><span>{val.toFixed(4)} TON</span>
              </div>
              <div className="tr-payout-row">
                <span>Профит при выигрыше</span><span className="green">+{profit.toFixed(4)} TON</span>
              </div>
              <div className="tr-payout-row total">
                <span>Итого при выигрыше</span><span className="green">{payout.toFixed(4)} TON</span>
              </div>
            </div>
          ) : null
        })()}
      </div>

      <div className="tr-btns">
        <button className="tr-btn up" onClick={()=>handleBet('up')} disabled={!!bet}>📈 ВВЕРХ</button>
        <button className="tr-btn down" onClick={()=>handleBet('down')} disabled={!!bet}>📉 ВНИЗ</button>
      </div>

      {history.length > 0 && (
        <div className="tr-history">
          <div className="tr-hist-title">МОИ СДЕЛКИ</div>
          {history.map((h, i) => {
            const amt = parseFloat(h.amount)
            const lbl = h.label || ''
            const isRefund = lbl.includes('refund') || lbl.includes('возврат')
            const isWin = !isRefund && amt > 0
            const parts = lbl.split(':')
            const betAmt = isRefund ? amt : (lbl.includes('win') ? parseFloat(parts[3] || 0) : parseFloat(parts[1] || Math.abs(amt)))
            const profit = isWin ? amt - betAmt : 0
            const type = isRefund ? 'refund' : isWin ? 'win' : 'lose'
            return (
              <div key={i} className={`tr-hist-item ${type}`}>
                <div className="tr-hist-badge">
                  {isRefund ? '↩' : isWin ? '▲' : '▼'}
                </div>
                <div className="tr-hist-info">
                  <div className="tr-hist-type">
                    {isRefund ? 'ВОЗВРАТ' : isWin ? 'ВВЕРХ' : 'ВНИЗ'}
                  </div>
                  <div className="tr-hist-date">{new Date(h.created_at).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <div className="tr-hist-right">
                  {isRefund ? (
                    <>
                      <div className="tr-hist-amt refund">+{amt.toFixed(4)} TON</div>
                      <div className="tr-hist-profit">возврат ставки</div>
                    </>
                  ) : isWin ? (
                    <>
                      <div className="tr-hist-amt win">+{amt.toFixed(4)} TON</div>
                      <div className="tr-hist-profit">ставка {betAmt.toFixed(4)} · профит +{profit.toFixed(4)}</div>
                    </>
                  ) : (
                    <>
                      <div className="tr-hist-amt lose">-{Math.abs(amt).toFixed(4)} TON</div>
                      <div className="tr-hist-profit lose">ставка {betAmt.toFixed(4)}</div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}