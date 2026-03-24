import { useState, useEffect, useRef } from 'react'
import { getTasks, completeTask, createTask, getMyTasks } from '../../api/index'
import { useUserStore } from '../../store/userStore'
import api from '../../api/index'
import './Tasks.css'

const COUNTS = [50, 100, 200, 500, 1000]
const PRICE_PER = 0.002

const TYPE_LABEL = { subscribe:'ПОДПИСКА', bot:'БОТ' }
const TYPE_CLS   = { subscribe:'t-sub', bot:'t-bot' }
const TYPE_BADGE = { subscribe:'b-sub', bot:'b-bot' }

export default function Tasks({ initialView = 'list', onViewChange }) {
  const { user, updateBalance } = useUserStore()
  const [view, setView] = useState(initialView)
  const [myTasks, setMyTasks] = useState([])

  const changeView = (v) => { setView(v); onViewChange?.(v) }

  useEffect(() => { setView(initialView) }, [initialView])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)

  // Create form
  const [form, setForm] = useState({ type:'subscribe', link:'', title:'', channel_title:'', channel_photo:'', count:100 })
  const [loadingCh, setLoadingCh] = useState(false)
  const [creating, setCreating] = useState(false)
  const [botCheck, setBotCheck] = useState(null)
  const linkTimer = useRef(null)

  const [pricing, setPricing] = useState({ task_price: 0.002, task_reward: 0.001, task_ref_bonus: 0.0005, task_project_fee: 0.0005 })
  const balance = parseFloat(user?.balance_ton ?? 0)
  const pricePerExec = parseFloat(pricing.task_price)
  const totalCost = form.count * pricePerExec

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    api.get('/api/admin/settings').then(r => {
      const s = r.data || {}
      setPricing({
        task_price:       parseFloat(s.task_price      || 0.002),
        task_reward:      parseFloat(s.task_reward     || 0.001),
        task_ref_bonus:   parseFloat(s.task_ref_bonus  || 0.0005),
        task_project_fee: parseFloat(s.task_project_fee|| 0.0005),
      })
    }).catch(() => {})

    getTasks()
      .then(r => setTasks(r.data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
    getMyTasks().then(r => setMyTasks(r.data || [])).catch(() => {})
    // Загружаем цены из настроек стейкинга (публичный эндпоинт)
    api.get('/api/staking/info').then(r => {
      if (r.data?.prices) setPrices(r.data.prices)
    }).catch(() => {})
  }, [])

  const handleClaim = async (task) => {
    if (task.completed || completing === task.id) return
    setCompleting(task.id)
    if (task.link) {
      const tg = window.Telegram?.WebApp
      if (tg) tg.openTelegramLink(task.link)
      else window.open(task.link, '_blank')
    }
    try {
      const res = await completeTask(task.id)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t))
      updateBalance(parseFloat(res.data?.reward || task.reward))
      showToast(`+${res.data?.reward || task.reward} TON ЗАЧИСЛЕНО`)
    } catch (e) {
      showToast(e?.response?.data?.message || 'ОШИБКА', true)
    }
    setCompleting(null)
  }

  const handleLinkChange = async (link) => {
    if (!link || !link.includes('t.me/')) return
    setLoadingCh(true)
    setBotCheck(null)
    try {
      const infoRes = await api.get(`/api/channels/info?link=${encodeURIComponent(link)}`)
      setForm(p => ({ ...p, title: infoRes.data.title || p.title, channel_title: infoRes.data.title || '', channel_photo: infoRes.data.photo || '' }))
      if (form.type === 'subscribe') {
        const checkRes = await api.get(`/api/channels/check?link=${encodeURIComponent(link)}`)
        setBotCheck(checkRes.data)
      }
    } catch {}
    setLoadingCh(false)
  }

  const handleCreate = async () => {
    if (!form.link) { showToast('ВВЕДИ ССЫЛКУ', true); return }
    if (!form.title) { showToast('ВВЕДИ НАЗВАНИЕ', true); return }
    if (balance < totalCost) { showToast('НЕДОСТАТОЧНО СРЕДСТВ', true); return }
    setCreating(true)
    try {
      await createTask({ type: form.type, title: form.title, link: form.link, channel_title: form.channel_title, channel_photo: form.channel_photo, max_executions: form.count, price_per_exec: pricePerExec })
      updateBalance(-totalCost)
      showToast('ЗАДАНИЕ СОЗДАНО!')
      setForm({ type:'subscribe', link:'', title:'', channel_title:'', channel_photo:'', count:100 })
      changeView('list')
      const r = await getTasks()
      setTasks(r.data || [])
    } catch (e) {
      showToast(e?.response?.data?.error || 'ОШИБКА', true)
    }
    setCreating(false)
  }

  return (
    <div className="tasks-wrap">
      {toast && <div className={`tasks-toast ${toastErr ? 'err' : ''}`}>{toast}</div>}

      <div className="tasks-tabs">
        <button className={`ttab ${view==='list'?'on':''}`} onClick={() => changeView('list')}>ЗАДАНИЯ</button>
        <button className={`ttab ${view==='create'?'on':''}`} onClick={() => changeView('create')}>ЗАКАЗАТЬ</button>
        <button className={`ttab ${view==='my'?'on':''}`} onClick={() => changeView('my')}>МОИ</button>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          {loading ? (
            <div className="tasks-empty"><div className="spinner"></div></div>
          ) : tasks.length === 0 ? (
            <div className="tasks-empty">
              <div className="empty-icon">📋</div>
              <div className="empty-text">Заданий пока нет</div>
            </div>
          ) : (
            <div className="tasks-list">
              {tasks.map(task => (
                <div key={task.id} className={`task-card ${task.completed ? 'done' : ''}`}>
                  {task.channel_photo
                    ? <img src={task.channel_photo} className="task-photo" onError={e => e.target.style.display='none'}/>
                    : <div className={`task-ico ${TYPE_CLS[task.type] || 't-sub'}`}>
                        {task.icon || (task.type === 'bot' ? '🤖' : '✈️')}
                      </div>
                  }
                  <div className="task-body">
                    <div className="task-name">{task.channel_title || task.title}</div>
                    <div className="task-rew">+{task.reward} TON</div>
                    {task.link && <div className="task-link">{task.link.replace('https://', '')}</div>}
                    <div className="task-meta">
                      <span className={`task-badge ${TYPE_BADGE[task.type] || 'b-sub'}`}>
                        {TYPE_LABEL[task.type] || 'ЗАДАНИЕ'}
                      </span>
                      <button
                        className={`claim-btn ${task.completed ? 'claimed' : ''}`}
                        onClick={() => handleClaim(task)}
                        disabled={task.completed || completing === task.id}
                      >
                        {task.completed ? '✓ Готово' : completing === task.id ? '...' : task.type === 'bot' ? 'Запустить' : 'Подписаться'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* CREATE VIEW */}
      {view === 'create' && (
        <div className="create-form">
          <div className="cf-balance">
            Баланс: <span>{balance.toFixed(4)} TON</span>
          </div>

          <div className="cf-row">
            <div className="cf-label">ТИП ЗАДАНИЯ</div>
            <div className="type-btns">
              <button className={`type-btn ${form.type==='subscribe'?'on':''}`} onClick={() => { setForm({ type:'subscribe', link:'', title:'', channel_title:'', channel_photo:'', count:form.count }); setBotCheck(null) }}>✈️ Подписка</button>
              <button className={`type-btn ${form.type==='bot'?'on':''}`} onClick={() => { setForm({ type:'bot', link:'', title:'', channel_title:'', channel_photo:'', count:form.count }); setBotCheck(null) }}>🤖 Бот</button>
            </div>
          </div>

          <div className="cf-row">
            <div className="cf-label">ССЫЛКА</div>
            <div className="cf-input-wrap">
              <input className="cf-input" placeholder="https://t.me/username" value={form.link} onChange={e => setForm(p=>({...p,link:e.target.value}))}/>
              <button className="cf-check-btn" onClick={() => handleLinkChange(form.link)} disabled={loadingCh || !form.link}>
                {loadingCh ? '...' : '→'}
              </button>
            </div>
          </div>

          {form.channel_photo && (
            <div className="ch-preview">
              <img src={form.channel_photo} className="ch-img" onError={e => e.target.style.display='none'}/>
              <div><div className="ch-name">{form.channel_title}</div><div className="ch-url">{form.link}</div></div>
            </div>
          )}

          {botCheck !== null && form.type === 'subscribe' && (
            <div className={`task-bot-check ${botCheck.ok ? 'ok' : 'fail'}`}>
              {botCheck.ok ? (
                <span>✅ Бот добавлен в канал — проверка подписки работает</span>
              ) : (
                <div>
                  <div>⚠️ Бот не является администратором канала</div>
                  <div className="task-bot-hint">
                    Без этого проверка подписки не будет работать.<br/>
                    Добавь @tonera_bot в канал как администратора.
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="cf-row">
            <div className="cf-label">НАЗВАНИЕ</div>
            <input className="cf-input" placeholder="Название задания" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}/>
          </div>

          <div className="cf-row">
            <div className="cf-label">КОЛИЧЕСТВО ВЫПОЛНЕНИЙ</div>
            <div className="count-btns">
              {COUNTS.map(c => (
                <button key={c} className={`count-btn ${form.count===c?'on':''}`} onClick={() => setForm(p=>({...p,count:c}))}>{c}</button>
              ))}
            </div>
          </div>

          <div className="price-card">
            <div className="price-row"><span>Выполнений</span><span>{form.count}</span></div>
            <div className="price-row"><span>Цена за выполнение</span><span>{pricePerExec.toFixed(4)} TON</span></div>
            <div className="price-divider"/>
            <div className="price-row total">
              <span>ИТОГО</span>
              <span className={balance < totalCost ? 'not-enough' : 'ok'}>{totalCost.toFixed(4)} TON</span>
            </div>
            {balance < totalCost && <div className="price-warn">Недостаточно средств</div>}
          </div>

          <div className="dist-card">
            <div className="dist-title">РАСПРЕДЕЛЕНИЕ ЗА 1 ВЫПОЛНЕНИЕ</div>
            <div className="dist-row"><span>💰 Цена заказчика</span><span>{pricePerExec.toFixed(4)} TON</span></div>
            <div className="dist-row"><span>👤 Исполнитель</span><span>{parseFloat(pricing.task_reward).toFixed(4)} TON</span></div>
            <div className="dist-row"><span>👥 Реферал</span><span>{parseFloat(pricing.task_ref_bonus).toFixed(4)} TON</span></div>
            <div className="dist-row"><span>🏦 Комиссия</span><span>{parseFloat(pricing.task_project_fee).toFixed(4)} TON</span></div>
          </div>

          <button className="create-btn" onClick={handleCreate} disabled={creating || balance < totalCost || !form.link || !form.title || (form.type === 'subscribe' && botCheck !== null && !botCheck.ok)}>
            {creating ? 'СОЗДАНИЕ...' : `СОЗДАТЬ ЗА ${totalCost.toFixed(4)} TON`}
          </button>
        </div>
      )}
      {/* MY TASKS VIEW */}
      {view === 'my' && (
        <div className="my-tasks">
          {myTasks.length === 0 ? (
            <div className="tasks-empty">
              <div className="empty-icon">📋</div>
              <div className="empty-text">Нет созданных заданий</div>
            </div>
          ) : (
            myTasks.map(task => (
              <div key={task.id} className="my-task-card">
                <div className="mt-header">
                  {task.channel_photo
                    ? <img src={task.channel_photo} className="mt-photo" onError={e => e.target.style.display='none'}/>
                    : <div className="mt-icon">{task.icon}</div>
                  }
                  <div className="mt-info">
                    <div className="mt-title">{task.channel_title || task.title}</div>
                    <div className="mt-link">{task.link}</div>
                  </div>
                  <div className={`mt-status ${task.active ? 'active' : 'done'}`}>
                    {task.active ? 'АКТИВНО' : 'ЗАВЕРШЕНО'}
                  </div>
                </div>
                <div className="mt-progress">
                  <div className="mt-prog-bar">
                    <div className="mt-prog-fill" style={{width:`${Math.min((task.executions/task.max_executions)*100,100)}%`}}/>
                  </div>
                  <div className="mt-prog-text">{task.executions} / {task.max_executions} выполнений</div>
                </div>
                <div className="mt-stats">
                  <div className="mt-stat"><span>Бюджет</span><span>{parseFloat(task.budget).toFixed(4)} TON</span></div>
                  <div className="mt-stat"><span>Потрачено</span><span>{(task.executions * 0.002).toFixed(4)} TON</span></div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
