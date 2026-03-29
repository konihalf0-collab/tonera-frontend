import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Spin.css'

const COLORS = ['#1a2a4a','#0d3a1a','#1a1a3a','#0a2a3a','#1a3a0a','#2a1a3a','#3a2a0a','#0a3a2a']

export default function Spin({ user }) {
  const { updateBalance } = useUserStore()
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState(null)
  const [spinPrice, setSpinPrice] = useState(0.1)
  const [jackpot, setJackpot] = useState(0)
  const [sectors, setSectors] = useState([])
  const [toast, setToast] = useState('')
  const [history, setHistory] = useState([])
  const [toastErr, setToastErr] = useState(false)
  const canvasRef = useRef(null)
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    api.get('/api/spin/info').then(r => {
      setSpinPrice(r.data.spin_price || 0.1)
      setJackpot(parseFloat(r.data.spin_jackpot || 0))
      setSectors(r.data.sectors || [])
    }).catch(() => {})

    const loadHistory = () => api.get('/api/spin/history').then(r => setHistory(r.data || [])).catch(() => {})
    loadHistory()

    // Обновляем джекпот и историю каждые 10 секунд
    const t = setInterval(() => {
      api.get('/api/spin/info').then(r => {
        setJackpot(parseFloat(r.data.spin_jackpot || 0))
      }).catch(() => {})
      loadHistory()
    }, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (sectors.length > 0) drawWheel(rotation)
  }, [rotation, sectors])

  const showToast = (msg, err = false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 4000)
  }

  const drawWheel = (rot) => {
    const canvas = canvasRef.current
    if (!canvas || sectors.length === 0) return
    const ctx = canvas.getContext('2d')
    const size = canvas.width
    const cx = size / 2, cy = size / 2, r = size / 2 - 8
    const arc = (Math.PI * 2) / sectors.length

    ctx.clearRect(0, 0, size, size)

    sectors.forEach((s, i) => {
      const angle = arc * i + rot
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + arc)
      ctx.closePath()
      ctx.fillStyle = s.type === 'jackpot' ? '#3a1a00' : s.type === 'nothing' ? '#1a1a2a' : COLORS[i % COLORS.length]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,212,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle + arc / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = s.type === 'jackpot' ? '#ffb300' : '#e8f2ff'
      ctx.font = `bold ${size < 300 ? 9 : 11}px Orbitron, sans-serif`
      ctx.fillText(s.label, r - 10, 4)
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
    ctx.fillStyle = '#00d4ff'
    ctx.font = 'bold 10px Orbitron, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SPIN', cx, cy + 4)
  }

  const handleSpin = async () => {
    if (spinning || sectors.length === 0) return
    if (balance < spinPrice) { showToast(`Нужно ${spinPrice} TON`, true); return }

    setSpinning(true)
    setResult(null)

    try {
      const r = await api.post('/api/spin/play')
      const { result: res, sectorIndex } = r.data

      const arc = (Math.PI * 2) / sectors.length
      const spins = 8 + Math.floor(Math.random() * 5)
      const targetRot = -Math.PI / 2 - arc * sectorIndex - arc / 2
      const normalizedTarget = ((targetRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const currentPos = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const diff = ((normalizedTarget - currentPos) + Math.PI * 2) % (Math.PI * 2)
      const finalRot = rotation + spins * Math.PI * 2 + diff

      const start = performance.now()
      const duration = 5000
      const startRot = rotation

      const animate = (now) => {
        const elapsed = now - start
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 4)
        setRotation(startRot + (finalRot - startRot) * ease)
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setResult(res)
          if (res.type === 'jackpot') {
            setJackpot(0)
            updateBalance(-spinPrice + res.value)
            showToast(`🎰 ДЖЕКПОТ! +${parseFloat(res.value).toFixed(4)} TON!`)
          } else if (res.type === 'ton' && res.value > 0) {
            updateBalance(-spinPrice + res.value)
          } else {
            updateBalance(-spinPrice)
          }
          // Обновляем историю после спина
          api.get('/api/spin/history').then(r => setHistory(r.data || [])).catch(() => {})
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

      <div className="spin-jackpot-card">
        <div className="sj-label">💰 ДЖЕКПОТ</div>
        <div className="sj-value">{jackpot.toFixed(4)} TON</div>
      </div>

      <div className="spin-balance">Баланс: <span>{balance.toFixed(4)} TON</span></div>

      <div className="spin-wheel-wrap">
        <div className="spin-arrow">▼</div>
        <canvas ref={canvasRef} width={300} height={300} className="spin-canvas"/>
      </div>

      {result && (
        <div className={`spin-result ${result.type === 'nothing' ? 'nothing' : 'win'}`}>
          {result.type === 'nothing' ? '😢 Не повезло в этот раз'
            : result.type === 'jackpot' ? `🎰 ДЖЕКПОТ! +${parseFloat(result.value).toFixed(4)} TON!`
            : `🎉 +${result.value} TON на баланс!`}
        </div>
      )}

      <button className="spin-btn" onClick={handleSpin} disabled={spinning || balance < spinPrice || sectors.length === 0}>
        {spinning ? '⏳ КРУТИТСЯ...' : `🎰 КРУТИТЬ за ${spinPrice} TON`}
      </button>

      <div className="spin-sectors">
        <div className="ss-title">🏆 ПОСЛЕДНИЕ ВЫИГРЫШИ</div>
        {history.length === 0 && <div style={{textAlign:'center',color:'rgba(232,242,255,0.3)',fontFamily:'DM Sans',fontSize:13,padding:'10px 0'}}>Пока нет выигрышей</div>}
        {history.map((h, i) => (
          <div key={i} className="ss-item">
            <div className="sh-avatar">{(h.username||h.first_name||'?')[0].toUpperCase()}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:'#e8f2ff'}}>{h.username ? '@'+h.username : h.first_name}</div>
              <div style={{fontFamily:'Orbitron,sans-serif',fontSize:9,color:'rgba(232,242,255,0.3)',marginTop:2}}>{new Date(h.created_at).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            {parseFloat(h.amount) > 0
              ? <div style={{fontFamily:'Orbitron,sans-serif',fontSize:12,fontWeight:700,color:h.label?.includes('ДЖЕКПОТ')?'#ffb300':'#00e676'}}>
                  {h.label?.includes('ДЖЕКПОТ') ? `🎰 ДЖЕКПОТ` : `🎉 +${parseFloat(h.amount).toFixed(4)} TON`}
                </div>
              : <div style={{fontFamily:'Orbitron,sans-serif',fontSize:11,color:'rgba(232,242,255,0.35)'}}>😢 Ничего</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}