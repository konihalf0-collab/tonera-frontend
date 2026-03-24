import { useState, useEffect } from 'react'
import { getTransactions } from '../../api/index'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import './Wallet.css'

const TX_ICONS = {
  stake: '📈', reward: '🎁', deposit: '⬇️', withdraw: '⬆️',
  task: '✅', ref_task: '👥', ref_deposit: '👥', bonus: '🎁',
  reinvest: '🔄', collect: '💰'
}

export default function Wallet({ user }) {
  const { updateBalance, setUser } = useUserStore()
  const [txs, setTxs] = useState([])
  const [modal, setModal] = useState(null) // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('')
  const [walletAddr, setWalletAddr] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const [projectWallet, setProjectWallet] = useState('')
  const [minDeposit, setMinDeposit] = useState(0.5)

  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const balance = parseFloat(user?.balance_ton ?? 0)

  useEffect(() => {
    getTransactions().then(r => setTxs((r.data || []).filter(t => t.type !== 'fee'))).catch(() => {})
    api.get('/api/deposit/info').then(r => {
      setProjectWallet(r.data.wallet)
      setMinDeposit(r.data.min_amount || 0.5)
    }).catch(() => {})
  }, [])

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 5000)
  }

  const handleDeposit = async () => {
    const val = parseFloat(amount)
    if (!val || val < minDeposit) { showToast(`МИН. ДЕПОЗИТ: ${minDeposit} TON`, true); return }
    if (!projectWallet) { showToast('КОШЕЛЁК ПРОЕКТА НЕ НАСТРОЕН', true); return }

    setLoading(true)
    try {
      const amountNano = Math.floor(val * 1e9).toString()
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: projectWallet,
          amount: amountNano,
          payload: btoa(`deposit:${user?.telegram_id}`),
        }]
      }
      const result = await tonConnectUI.sendTransaction(tx)
      // Подтверждаем депозит на бэкенде
      await api.post('/api/deposit/confirm', {
        amount: val,
        tx_hash: result?.boc || null
      })
      updateBalance(val)
      // Перезагружаем транзакции
      const r = await getTransactions()
      setTxs((r.data || []).filter(t => t.type !== 'fee'))
      showToast(`+${val} TON ЗАЧИСЛЕНО`)
      setModal(null)
      setAmount('')
    } catch (e) {
      if (e?.message?.includes('User rejects')) {
        showToast('ОТМЕНЕНО', true)
      } else {
        showToast(e?.response?.data?.error || 'ОШИБКА', true)
      }
    }
    setLoading(false)
  }

  const handleWithdraw = async () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) { showToast('ВВЕДИ СУММУ', true); return }
    if (val > balance) { showToast('НЕДОСТАТОЧНО СРЕДСТВ', true); return }
    const addr = walletAddr || wallet?.account?.address
    if (!addr) { showToast('ПОДКЛЮЧИ КОШЕЛЁК', true); return }

    setLoading(true)
    try {
      await api.post('/api/deposit/withdraw', { amount: val, wallet_address: addr })
      updateBalance(-val)
      const r = await getTransactions()
      setTxs((r.data || []).filter(t => t.type !== 'fee'))
      showToast('ЗАЯВКА СОЗДАНА. ОБРАБОТКА ДО 24Ч')
      setModal(null)
      setAmount('')
      setWalletAddr('')
    } catch (e) {
      showToast(e?.response?.data?.error || 'ОШИБКА', true)
    }
    setLoading(false)
  }

  return (
    <div className="wallet-wrap">
      {toast && <div className={`wallet-toast ${toastErr ? 'err' : ''}`}>{toast}</div>}

      <div className="wallet-title">Кошелёк</div>

      <div className="wallet-card">
        <div className="wc-glow"/>
        <div className="wc-label">БАЛАНС</div>
        <div className="wc-row">
          <svg width="36" height="36" viewBox="0 0 56 56" fill="none"><path d="M28 0C12.536 0 0 12.536 0 28s12.536 28 28 28 28-12.536 28-28S43.464 0 28 0z" fill="#0098EA"/><path d="M37.56 15.63H18.44c-3.52 0-5.74 3.79-3.98 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.45-6.86-3.97-6.86zM26.26 36.28l-2.86-5.16-6.56-11.3c-.37-.63.07-1.42.8-1.42h8.62v17.88zm12.9-16.48-6.56 11.32-2.86 5.16V18.38h8.61c.73 0 1.17.79.81 1.42z" fill="#fff"/></svg>
          <span className="wc-num">{balance.toFixed(4)}</span>
        </div>
        <div className="wc-usd">≈ ${(balance * 6.5).toFixed(2)} USD</div>

        <div className="tc-row">
          <TonConnectButton />
        </div>

        <div className="wc-btns">
          <button className="wc-btn wc-in" onClick={() => { setModal('deposit'); setAmount('') }}>⬇ ПОПОЛНИТЬ</button>
          <button className="wc-btn wc-out" onClick={() => { setModal('withdraw'); setAmount('') }}>⬆ ВЫВЕСТИ</button>
        </div>
      </div>

      <div className="tx-label">ИСТОРИЯ</div>
      <div className="tx-list">
        {txs.length === 0 && <div className="tx-empty">Нет транзакций</div>}
        {txs.map(tx => (
          <div className="tx-item" key={tx.id}>
            <div className={`tx-icon ${parseFloat(tx.amount) > 0 ? 'ti-g' : 'ti-b'}`}>
              {TX_ICONS[tx.type] || '💫'}
            </div>
            <div className="tx-info">
              <div className="tx-name">{tx.label}</div>
              <div className="tx-date">{new Date(tx.created_at || tx.date).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div className={`tx-amt ${parseFloat(tx.amount) > 0 ? 'pos' : 'neg'}`}>
              {parseFloat(tx.amount) > 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(4)} TON
            </div>
          </div>
        ))}
      </div>

      {/* DEPOSIT MODAL */}
      {modal === 'deposit' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="wmodal">
            <div className="wm-title">ПОПОЛНИТЬ</div>
            <div className="wm-info">
              Минимум: <span>{minDeposit} TON</span>
            </div>
            {!wallet ? (
              <div className="wm-connect">
                <div className="wm-hint">Подключи кошелёк чтобы пополнить</div>
                <TonConnectButton />
              </div>
            ) : (
              <>
                <div className="wm-connected">
                  ✅ {wallet.account.address.slice(0,8)}...{wallet.account.address.slice(-4)}
                </div>
                <div className="mi-wrap">
                  <input className="mi" type="number" step="0.1" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} autoFocus/>
                  <span className="mi-cur">TON</span>
                </div>
                <button className="wm-btn" onClick={handleDeposit} disabled={loading}>
                  {loading ? 'ОЖИДАНИЕ...' : `ПОПОЛНИТЬ ${amount || '0'} TON`}
                </button>
              </>
            )}
            <button className="wm-cancel" onClick={() => setModal(null)}>Отмена</button>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {modal === 'withdraw' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="wmodal">
            <div className="wm-title">ВЫВЕСТИ</div>
            <div className="wm-info">
              Доступно: <span>{balance.toFixed(4)} TON</span>
            </div>
            <div className="mi-wrap">
              <input className="mi" type="number" step="0.1" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/>
              <span className="mi-cur">TON</span>
            </div>
            <div className="wm-addr-label">TON АДРЕС</div>
            <input
              className="wm-addr"
              placeholder={wallet?.account?.address || 'EQ... или UQ...'}
              value={walletAddr}
              onChange={e => setWalletAddr(e.target.value)}
            />
            {wallet && !walletAddr && (
              <div className="wm-use-connected" onClick={() => setWalletAddr(wallet.account.address)}>
                Использовать подключённый кошелёк
              </div>
            )}
            <div className="wm-warn">⚠️ Обработка до 24 часов вручную</div>
            <button className="wm-btn" onClick={handleWithdraw} disabled={loading}>
              {loading ? 'ОТПРАВКА...' : 'СОЗДАТЬ ЗАЯВКУ'}
            </button>
            <button className="wm-cancel" onClick={() => setModal(null)}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
