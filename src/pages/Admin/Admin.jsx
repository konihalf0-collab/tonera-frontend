import { useState, useEffect, useRef } from 'react'
import api from '../../api/index'
import './Admin.css'

const SETTING_GROUPS = [
  {
    id: 'staking',
    title: '📈 Стейкинг',
    settings: [
      { key: 'min_deposit',  label: 'Минимальный депозит (TON)' },
      { key: 'min_withdraw', label: 'Минимальный вывод (TON)' },
      { key: 'min_reinvest', label: 'Минимальный реинвест (TON)' },
    ]
  },
  {
    id: 'tasks',
    title: '✅ Задания',
    settings: [
      { key: 'task_reward',      label: 'Награда исполнителю (TON)' },
      { key: 'task_price',       label: 'Цена для заказчика (TON)' },
      { key: 'task_ref_bonus',   label: 'Реф. бонус за задание (TON)' },
      { key: 'task_project_fee', label: 'Комиссия проекта (TON)' },
    ]
  },
  {
    id: 'wallet',
    title: '💎 Кошелёк проекта',
    settings: [
      { key: 'project_wallet',  label: 'Адрес кошелька (TON)' },
      { key: 'min_deposit_ton', label: 'Мин. сумма депозита (TON)' },
    ]
  },
  {
    id: 'referrals',
    title: '👥 Рефералы',
    settings: [
      { key: 'ref_register_bonus',  label: 'Бонус за регистрацию (TON)' },
      { key: 'ref_task_percent',    label: '% от задания реферала' },
      { key: 'ref_deposit_percent', label: '% от депозита реферала' },
    ]
  },
]

export default function Admin() {
  const [tab, setTab] = useState('stats')
  const [settingsTab, setSettingsTab] = useState('staking')
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState({})
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [toast, setToast] = useState('')
  const [toastErr, setToastErr] = useState(false)
  const [saving, setSaving] = useState(null)
  const [loadingChannel, setLoadingChannel] = useState(false)
  const [botCheck, setBotCheck] = useState(null) // null | {ok, status}
  const [form, setForm] = useState({ title:'', link:'', type:'subscribe', icon:'✈️', channel_title:'', channel_photo:'' })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const linkTimer = useRef(null)

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, se, t, u, w] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/settings'),
        api.get('/api/admin/tasks'),
        api.get('/api/admin/users'),
        api.get('/api/admin/withdrawals'),
      ])
      setStats(s.data)
      setSettings(se.data)
      setTasks(t.data)
      setUsers(u.data)
      setWithdrawals(w.data || [])
    } catch {}
  }

  const saveSetting = async (key) => {
    setSaving(key)
    try {
      await api.post('/api/admin/settings', { key, value: settings[key] })
      showToast('СОХРАНЕНО ✓')
    } catch { showToast('ОШИБКА', true) }
    setSaving(null)
  }

  const handleLinkChange = async (link) => {
    if (!link) return
    let normalizedLink = link.trim()
    if (normalizedLink.startsWith('@')) {
      normalizedLink = 'https://t.me/' + normalizedLink.slice(1)
    } else if (!normalizedLink.includes('t.me/')) {
      normalizedLink = 'https://t.me/' + normalizedLink
    } else if (!normalizedLink.startsWith('http')) {
      normalizedLink = 'https://' + normalizedLink
    }
    link = normalizedLink
    setForm(p => ({...p, link}))
    setLoadingChannel(true)
    setBotCheck(null)
    try {
      const infoRes = await api.get(`/api/channels/info?link=${encodeURIComponent(link)}`)
      setForm(p => ({ ...p, title: infoRes.data.title || p.title, channel_title: infoRes.data.title || '', channel_photo: infoRes.data.photo || '', icon: p.type === 'bot' ? '🤖' : '✈️' }))
      if (form.type === 'subscribe') {
        const checkRes = await api.get(`/api/channels/check?link=${encodeURIComponent(link)}`)
        setBotCheck(checkRes.data)
      }
    } catch {}
    setLoadingChannel(false)
  }

  const addTask = async () => {
    if (!form.title.trim()) { showToast('ВВЕДИ НАЗВАНИЕ', true); return }
    try {
      await api.post('/api/admin/tasks', form)
      showToast('ЗАДАНИЕ ДОБАВЛЕНО ✓')
      setForm({ title:'', link:'', type:'subscribe', icon:'✈️', channel_title:'', channel_photo:'' })
      setBotCheck(null)
      const r = await api.get('/api/admin/tasks')
      setTasks(r.data)
    } catch { showToast('ОШИБКА', true) }
  }

  const deleteTask = async (id) => {
    try {
      await api.delete(`/api/admin/tasks/${id}`)
      setTasks(prev => prev.filter(t => t.id !== id))
      showToast('УДАЛЕНО')
    } catch { showToast('ОШИБКА', true) }
  }

  const blockUser = async (user) => {
    try {
      await api.post(`/api/admin/users/${user.id}/block`)
      setUsers(prev => prev.map(u => u.id === user.id ? {...u, is_blocked: true} : u))
      showToast('ЗАБЛОКИРОВАН')
    } catch { showToast('ОШИБКА', true) }
  }

  const unblockUser = async (user) => {
    try {
      await api.post(`/api/admin/users/${user.id}/unblock`)
      setUsers(prev => prev.map(u => u.id === user.id ? {...u, is_blocked: false} : u))
      showToast('РАЗБЛОКИРОВАН')
    } catch { showToast('ОШИБКА', true) }
  }

  const markWithdrawalDone = async (id) => {
    try {
      await api.post(`/api/admin/withdrawals/${id}/complete`)
      setWithdrawals(prev => prev.map(w => w.id === id ? {...w, status:'completed'} : w))
      showToast('ОТМЕЧЕНО КАК ВЫПЛАЧЕНО')
    } catch { showToast('ОШИБКА', true) }
  }

  const deleteUser = async (user) => {
    try {
      await api.delete(`/api/admin/users/${user.id}`)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      setConfirmDelete(null)
      showToast('УДАЛЁН')
    } catch { showToast('ОШИБКА', true) }
  }

  const currentGroup = SETTING_GROUPS.find(g => g.id === settingsTab)

  return (
    <>
      {confirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-title">УДАЛИТЬ ПОЛЬЗОВАТЕЛЯ?</div>
            <div className="confirm-name">{confirmDelete.username || confirmDelete.first_name}</div>
            <div className="confirm-warn">Это действие нельзя отменить</div>
            <div className="confirm-btns">
              <button className="mbtn mb-c" type="button" onClick={() => { setConfirmDelete(null) }}>Отмена</button>
              <button className="mbtn mb-del" type="button" onClick={() => { const u = confirmDelete; setConfirmDelete(null); deleteUser(u) }}>УДАЛИТЬ</button>
            </div>
          </div>
        </div>
      )}
    <div className="admin-wrap">
      {toast && <div className={`admin-toast ${toastErr ? 'err' : ''}`}>{toast}</div>}

      <div className="admin-header">
        <div className="admin-title">⚙️ Админ панель</div>
        <div className="admin-only-note">🔒 Только для администратора</div>
      </div>

      <div className="admin-tabs">
        {[{id:'stats',label:'📊 СТАТ'},{id:'settings',label:'⚙️ НАСТРОЙКИ'},{id:'tasks',label:'✅ ЗАДАНИЯ'},{id:'users',label:'👥 ЮЗЕРЫ'},{id:'withdrawals',label:`💸 ЗАЯВКИ${withdrawals.filter(w=>w.status==='pending').length > 0 ? ' ('+withdrawals.filter(w=>w.status==='pending').length+')' : ''}`}].map(t => (
          <button key={t.id} className={`atab ${tab===t.id?'on':''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* STATS */}
      {tab === 'stats' && stats && (
        <div className="admin-section">
          <div className="stats-cards">
            <div className="astat-card"><div className="astat-val">{stats.total_users}</div><div className="astat-lbl">Пользователей</div></div>
            <div className="astat-card"><div className="astat-val">{stats.blocked_users}</div><div className="astat-lbl">Заблокировано</div></div>
            <div className="astat-card"><div className="astat-val">{stats.active_stakes}</div><div className="astat-lbl">Стейков</div></div>
            <div className="astat-card"><div className="astat-val">{parseFloat(stats.total_staked).toFixed(4)}</div><div className="astat-lbl">TON в стейке</div></div>
            <div className="astat-card"><div className="astat-val">{stats.total_referrals}</div><div className="astat-lbl">Рефералов</div></div>
            <div className="astat-card"><div className="astat-val">{stats.tasks_completed}</div><div className="astat-lbl">Заданий выполнено</div></div>
          </div>
          <button className="reload-btn" onClick={loadAll}>↻ Обновить</button>
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div className="admin-section">
          <div className="settings-tabs">
            {SETTING_GROUPS.map(g => (
              <button key={g.id} className={`stab ${settingsTab===g.id?'on':''}`} onClick={() => setSettingsTab(g.id)}>
                {g.title}
              </button>
            ))}
          </div>

          {currentGroup && (
            <div className="settings-group-card">
              <div className="sg-title">{currentGroup.title}</div>
              {currentGroup.settings.map(s => (
                <div key={s.key} className="setting-item">
                  <div className="setting-label">{s.label}</div>
                  <div className="setting-row">
                    <input
                      className="setting-input"
                      type="number"
                      step="0.0001"
                      value={settings[s.key] ?? ''}
                      onChange={e => setSettings(p => ({...p, [s.key]: e.target.value}))}
                    />
                    <button
                      className="save-btn"
                      onClick={() => saveSetting(s.key)}
                    >
                      {saving === s.key ? '...' : 'СОХР'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TASKS */}
      {tab === 'tasks' && (
        <div className="admin-section">
          <div className="add-task-form">
            <div className="atf-title">ДОБАВИТЬ ЗАДАНИЕ</div>
            <div className="atf-row">
              <label className="atf-label">ТИП</label>
              <div className="type-btns">
                <button className={`type-btn ${form.type==='subscribe'?'on':''}`} onClick={() => { setForm({ title:'', link:'', type:'subscribe', icon:'✈️', channel_title:'', channel_photo:'' }); setBotCheck(null) }}>✈️ Подписка</button>
                <button className={`type-btn ${form.type==='bot'?'on':''}`} onClick={() => { setForm({ title:'', link:'', type:'bot', icon:'🤖', channel_title:'', channel_photo:'' }); setBotCheck(null) }}>🤖 Бот</button>
              </div>
            </div>
            <div className="atf-row">
              <label className="atf-label">ССЫЛКА</label>
              <div className="atf-link-wrap">
                <input className="atf-input" placeholder="https://t.me/username" value={form.link} onChange={e => setForm(p=>({...p,link:e.target.value}))}/>
                <button className="atf-check-btn" onClick={() => handleLinkChange(form.link)} disabled={loadingChannel || !form.link}>
                  {loadingChannel ? '...' : '→'}
                </button>
              </div>
            </div>
            {form.channel_photo && (
              <div className="channel-preview">
                <img src={form.channel_photo} className="ch-photo" onError={e=>e.target.style.display='none'}/>
                <div className="ch-info"><div className="ch-title">{form.channel_title}</div><div className="ch-link">{form.link}</div></div>
              </div>
            )}
            {botCheck !== null && form.type === 'subscribe' && (
              <div className={`bot-check ${botCheck.ok ? 'ok' : 'fail'}`}>
                {botCheck.ok ? (
                  <span>✅ Бот является администратором канала</span>
                ) : (
                  <div>
                    <div>❌ Бот не является администратором</div>
                    <div className="bot-check-hint">
                      Добавь @tonera_bot в канал как администратора:<br/>
                      1. Открой настройки канала<br/>
                      2. Администраторы → Добавить администратора<br/>
                      3. Найди @tonera_bot и добавь
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="atf-row">
              <label className="atf-label">НАЗВАНИЕ</label>
              <input className="atf-input" placeholder="Название задания" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}/>
            </div>
            <div className="atf-reward-info">Награда: <span>{settings.task_reward || '0.001'} TON</span></div>
            <button className="atf-add-btn" onClick={addTask}>+ ДОБАВИТЬ</button>
          </div>

          <div className="tasks-list">
            {tasks.length === 0 && <div className="no-tasks">Нет заданий</div>}
            {tasks.map(task => (
              <div key={task.id} className="admin-task-item">
                {task.channel_photo ? <img src={task.channel_photo} className="ati-photo" onError={e=>e.target.style.display='none'}/> : <div className="ati-icon">{task.icon}</div>}
                <div className="ati-info">
                  <div className="ati-name">{task.title}</div>
                  <div className="ati-meta">
                    <span className={`ati-type ${task.type==='bot'?'type-bot':'type-sub'}`}>{task.type==='bot'?'БОТ':'ПОДПИСКА'}</span>
                    <span className="ati-reward">+{task.reward} TON</span>
                    <span className="ati-exec">{task.executions || 0} выполнений</span>
                  </div>
                </div>
                <button className="ati-del" onClick={() => deleteTask(task.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WITHDRAWALS */}
      {tab === 'withdrawals' && (
        <div className="admin-section">
          <div className="users-count">{withdrawals.filter(w=>w.status==='pending').length} ожидают обработки</div>
          {withdrawals.length === 0 && <div className="no-tasks">Нет заявок</div>}
          {withdrawals.map(w => {
            const addr = w.label?.replace('Вывод на ', '') || '—'
            const amount = Math.abs(parseFloat(w.amount)).toFixed(4)
            return (
              <div key={w.id} className={`withdrawal-item ${w.status}`}>
                <div className="wi-info">
                  <div className="wi-user">{w.username || w.first_name || 'Пользователь'}</div>
                  <div className="wi-date">{new Date(w.created_at).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  <div className="wi-copy-row">
                    <div className="wi-addr-short">{addr.slice(0,10)}...{addr.slice(-6)}</div>
                    <button className="wi-copy-btn" onClick={() => { navigator.clipboard.writeText(addr); showToast('АДРЕС СКОПИРОВАН') }}>📋 Адрес</button>
                    <button className="wi-copy-btn wi-copy-amt" onClick={() => { navigator.clipboard.writeText(amount); showToast('СУММА СКОПИРОВАНА') }}>📋 {amount}</button>
                  </div>
                </div>
                <div className="wi-right">
                  <div className={`wi-status ${w.status}`}>{w.status === 'pending' ? 'ОЖИДАЕТ' : 'ВЫПЛАЧЕНО'}</div>
                  {w.status === 'pending' && (
                    <button className="wi-done-btn" onClick={() => markWithdrawalDone(w.id)}>✓</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="admin-section">
          <div className="users-count">{users.length} пользователей</div>
          {users.map(u => (
            <div key={u.id} className={`admin-user-item ${u.is_blocked ? 'blocked' : ''}`}>
              <div className="aui-avatar">{(u.username||u.first_name||'?')[0].toUpperCase()}</div>
              <div className="aui-info">
                <div className="aui-name">
                  {u.username || u.first_name || 'Пользователь'}
                  {u.is_blocked && <span className="blocked-badge">БЛОК</span>}
                </div>
                <div className="aui-meta">ID: {u.telegram_id} · Рефов: {u.referral_count}</div>
              </div>
              <div className="aui-balance">{parseFloat(u.balance_ton).toFixed(4)}</div>
              <div className="aui-actions">
                {u.is_blocked
                  ? <button className="aui-btn unblock" onClick={() => unblockUser(u)}>✓</button>
                  : <button className="aui-btn block" onClick={() => blockUser(u)}>🚫</button>
                }
                <button className="aui-btn del" onClick={() => setConfirmDelete(u)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
