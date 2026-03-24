import { useState, useEffect, useRef } from 'react'
import { getUserStakes, createStake, unstake, reinvestStake, addToStake, collectStake, withdrawStake } from '../../api/index'
import api from '../../api/index'
import { useUserStore } from '../../store/userStore'
import './Staking.css'

const RATE_MS = 0.01 / (24 * 60 * 60 * 1000)

export default function Staking({ user }) {
  const { updateBalance } = useUserStore()
  const [dep, setDep] = useState(0)
  const [bonusDep, setBonusDep] = useState(0)
  const [wal, setWal] = useState(parseFloat(user?.balance_ton ?? 0))
  const [acc, setAcc] = useState(0)
  const [t0, setT0] = useState(Date.now())
  const [income, setIncome] = useState(0)
  const [modal, setModal] = useState(null)
  const [amount, setAmount] = useState('')
  const [stakeId, setStakeId] = useState(null)
  const [toast, setToast] = useState('')
  const [mins, setMins] = useState({ deposit: 0.01, withdraw: 0.01, reinvest: 0.001, collect: 0.001 })
  const timerRef = useRef(null)
  const depRef = useRef(dep)

  useEffect(() => { depRef.current = dep }, [dep])

  const getIncome = (a, t) => a + depRef.current * RATE_MS * (Date.now() - t)

  useEffect(() => {
    // Загружаем минимумы из настроек
    api.get('/api/staking/info').then(r => {
      if (r.data?.mins) setMins(r.data.mins)
    }).catch(() => {})

    // Загружаем активный стейк
    getUserStakes().then(r => {
      if (r.data?.length > 0) {
        const s = r.data[0]
        setDep(parseFloat(s.amount))
        setStakeId(s.id)
        setAcc(parseFloat(s.earned) || 0)
        setT0(new Date(s.started_at).getTime())
      }
    }).catch(() => {})
  }, [])

  // Когда user обновился — обновляем wal и bonusDep
  useEffect(() => {
    setWal(parseFloat(user?.balance_ton ?? 0))
    setBonusDep(parseFloat(user?.bonus_balance ?? 0))
  }, [user])

  // Live ticker
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIncome(getIncome(acc, t0))
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [dep, acc, t0])

  const reloadStake = async () => {
    try {
      const r = await getUserStakes()
      if (r.data?.length > 0) {
        const s = r.data[0]
        setDep(parseFloat(s.amount))
        setStakeId(s.id)
        setAcc(parseFloat(s.earned) || 0)
        setT0(new Date(s.started_at).getTime())
      }
    } catch {}
  }

  const snap = () => {
    const cur = getIncome(acc, t0)
    setAcc(cur)
    setT0(Date.now())
    return cur
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleCollect = async () => {
    if (income < 1e-9) return
    if (income < mins.collect) { showToast(`МИН. СБОР: ${mins.collect} TON`); return }
    if (income < mins.collect) { showToast(`МИН. СБОР: ${mins.collect} TON`); return }
    const v = snap()
    setAcc(0); setT0(Date.now())
    setWal(w => w + v)
    updateBalance(v)
    showToast(`СОБРАНО +${v.toFixed(6)} TON`)
    try {
      if (stakeId) await collectStake(stakeId)
    } catch {}
  }

  const handleReinvest = async () => {
    if (income < 1e-9) return
    if (income < mins.reinvest) { showToast(`МИН. РЕИНВЕСТ: ${mins.reinvest} TON`); return }
    const v = snap()
    const newDep = dep + v
    setAcc(0); setT0(Date.now())
    setDep(newDep)
    showToast(`РЕИНВЕСТ +${v.toFixed(6)} TON`)
    try {
      if (stakeId) {
        await reinvestStake(stakeId, v, newDep)
      } else {
        const res = await createStake({ amount: newDep })
        if (res.data?.stake?.id) setStakeId(res.data.stake.id)
      }
    } catch {}
  }

  const handleConfirm = async () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) { showToast('ВВЕДИ СУММУ'); return }
    if (modal === 'plus') {
      if (val < mins.deposit) { showToast(`МИН. ДЕПОЗИТ: ${mins.deposit} TON`); return }
      if (val > wal) { showToast('НЕДОСТАТОЧНО СРЕДСТВ'); return }
      snap(); setAcc(0); setT0(Date.now())
      setWal(w => w - val)
      setDep(d => d + val)
      updateBalance(-val)
      try {
        await addToStake(stakeId, val)
        await reloadStake()
      } catch {}
      showToast(`ДЕПОЗИТ +${val.toFixed(4)} TON`)
    } else {
      // Нельзя вывести бонусную часть
      const withdrawable = dep - bonusDep
      if (val < mins.withdraw) { showToast(`МИН. ВЫВОД: ${mins.withdraw} TON`); return }
      if (val > withdrawable) {
        showToast(`МАКС. ВЫВОД: ${withdrawable.toFixed(4)} TON`)
        return
      }
      snap(); setAcc(0); setT0(Date.now())
      setDep(d => d - val)
      setWal(w => w + val)
      updateBalance(val)
      try {
        await withdrawStake(stakeId, val)
        await reloadStake()
      } catch {}
      showToast(`ВЫВЕДЕНО ${val.toFixed(4)} TON`)
    }
    setModal(null); setAmount('')
  }

  return (
    <div className="staking-wrap">
      {toast && <div className="stake-toast">{toast}</div>}

      <div className="stake-topbar">
        <div className="swpill">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 13a1 1 0 100 2 1 1 0 000-2z" fill="currentColor"/><path d="M2 10h20" stroke="currentColor" strokeWidth="1.8"/></svg>
          <span className="swp-b">{wal.toFixed(4)}</span>
          <span className="swp-c">TON</span>
        </div>
        <div className="dep-badge">РАБОЧИЙ ДЕПОЗИТ</div>
      </div>

      <div className="stake-row">
        <div>
          <div className="sr-label">ДЕПОЗИТ</div>
          <div className="sr-val">
            <span className="sr-num">{dep.toFixed(4)}</span>
            <span className="sr-cur">TON</span>
          </div>
          {bonusDep > 0 && (
            <div className="sr-bonus">🎁 {bonusDep.toFixed(4)} TON бонус (вывод недоступен)</div>
          )}
        </div>
        <div className="sbg">
          <button className="sbsq sbsq-m" onClick={() => { setModal('minus'); setAmount('') }}>−</button>
          <button className="sbsq sbsq-p" onClick={() => { setModal('plus'); setAmount('') }}>+</button>
        </div>
      </div>

      <div className="stake-row">
        <div>
          <div className="sr-label">ДОХОД В ДЕНЬ</div>
          <div className="sr-val">
            <span className="sr-num" style={{fontSize:22}}>1%</span>
            <span className="sr-sub">~{(dep * 0.01).toFixed(4)} TON</span>
          </div>
        </div>
        <button className="sbsq-po" onClick={() => { setModal('plus'); setAmount('') }}>+</button>
      </div>

      <div className="income-card">
        <div className="inc-lbl">ДОХОД</div>
        <div className="inc-row">
          <span className={`inc-num ${income > 0 ? 'g' : ''}`}>{income.toFixed(8)}</span>
          <span className="inc-ton">TON</span>
        </div>
        <div className="inc-btns">
          <button className="ibtn ibtn-c" onClick={handleCollect}>Собрать</button>
          <button className="ibtn ibtn-r" onClick={handleReinvest}>Реинвест</button>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-inner">
            <div className="modal-title">{modal === 'plus' ? 'ДОБАВИТЬ ДЕПОЗИТ' : 'ВЫВЕСТИ ДЕПОЗИТ'}</div>
            {modal === 'minus' && bonusDep > 0 && (
              <div className="modal-bonus-note">
                🎁 Бонус {bonusDep.toFixed(4)} TON не выводится. Доступно к выводу: {(dep - bonusDep).toFixed(4)} TON
              </div>
            )}
            <div className="mi-wrap">
              <input className="mi" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus/>
              <span className="mi-cur">TON</span>
            </div>
            <div className="mhint">
              {modal === 'plus' ? 'Доступно в кошельке: ' : 'Доступно к выводу: '}
              <span>{modal === 'plus' ? wal.toFixed(4) : (dep - bonusDep).toFixed(4)}</span> TON
            </div>
            <div className="mbtns">
              <button className="mbtn mb-c" onClick={() => setModal(null)}>Отмена</button>
              <button className="mbtn mb-ok" onClick={handleConfirm}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
