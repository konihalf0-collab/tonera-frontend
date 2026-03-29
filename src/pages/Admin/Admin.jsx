import { useState, useEffect, useRef } from 'react'
import api from '../../api/index'
import './Admin.css'

const SETTING_GROUPS = [
  {
    id: 'spin_custom',
    title: '🎰 Спин',
    settings: []
  },
  {
    id: 'staking',
    title: '📈 Стейкинг',
    settings: [
      { key: 'min_deposit',  label: 'Минимальный депозит (TON)' },
      { key: 'min_withdraw', label: 'Минимальный вывод (TON)' },
      { key: 'min_reinvest', label: 'Минимальный реинвест (TON)' },
      { key: 'min_collect',          label: 'Минимальный сбор (TON)' },
      { key: 'staking_withdraw_fee', label: 'Комиссия вывода из стейка (%)' },
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
      { key: 'withdraw_fee',    label: 'Комиссия за вывод (TON)' },
      { key: 'min_withdraw_ton', label: 'Минимальный вывод (TON)' },
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
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at') // created_at | balance_ton | referral_count
  const [sortDir, setSortDir] = useState('desc')
  const [selectedUser, setSelectedUser] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [usersTab, setUsersTab] = useState('all') // all | donors
  const [withdrawals, setWithdrawals] = useState([])
  const [maintenance, setMaintenance] = useState(false)
  const [spinSectors, setSpinSectors] = useState([])
  const [editSector, setEditSector] = useState(null)
  const [uptime, setUptime] = useState('')
  const [dbBackup, setDbBackup] = useState(null)
  const linkTimer = useRef(null)

  const showToast = (msg, err=false) => {
    setToast(msg); setToastErr(err)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, se, t, u, w, maint] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/settings'),
        api.get('/api/admin/tasks'),
        api.get('/api/admin/users'),
        api.get('/api/admin/withdrawals'),
        api.get('/api/admin/maintenance'),
      ])
      setStats(s.data)
      setSettings(se.data)
      setTasks(t.data)
      setUsers(u.data)
      setWithdrawals(w.data || [])
      try {
        const spinInfo = await api.get('/api/spin/info')
        setSpinSectors(spinInfo.data.sectors || [])
      } catch {}
      setMaintenance(maint.data?.maintenance === '1')
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

  useEffect(() => {
    const launchDate = settings?.launch_date || '2025-03-01'
    const START = new Date(launchDate)
    const update = () => {
      const diff = Date.now() - START.getTime()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setUptime(`${days}д ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [settings?.launch_date])

  const toggleMaintenance = async () => {
    try {
      const newVal = !maintenance
      await api.post('/api/admin/maintenance', { value: newVal ? '1' : '0' })
      setMaintenance(newVal)
      showToast(newVal ? 'ТЕХ ОБСЛУЖИВАНИЕ ВКЛЮЧЕНО' : 'ПРОЕКТ АКТИВЕН')
    } catch { showToast('ОШИБКА', true) }
  }

  const restoreBackup = async (file) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.users) { showToast('НЕВЕРНЫЙ ФАЙЛ', true); return }
      if (!window.confirm(`Восстановить из бэкапа от ${data.date?.slice(0,10)}? Данные будут перезаписаны.`)) return
      const r = await api.post('/api/admin/restore', data)
      showToast(`ВОССТАНОВЛЕНО: ${r.data.restored.users} юзеров, ${r.data.restored.stakes} стейков`)
      await loadAll()
    } catch (e) { showToast(e?.response?.data?.error || 'ОШИБКА', true) }
  }

  const downloadBackup = async () => {
    try {
      const r = await api.get('/api/admin/backup')
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `tonera-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('БЭКАП СКАЧАН')
    } catch { showToast('ОШИБКА БЭКАПА', true) }
  }

  const openUserStats = async (user) => {
    setSelectedUser(user)
    try {
      const r = await api.get(`/api/admin/users/${user.id}/stats`)
      setUserStats(r.data)
    } catch {}
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
    } catch (e) { showToast(e?.response?.data?.error || 'ОШИБКА', true) }
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
        {[
          {id:'stats',icon:'📊',label:'СТАТ'},
          {id:'settings',icon:'⚙️',label:'НАСТР'},
          {id:'tasks',icon:'✅',label:'ЗАДАНИЯ'},
          {id:'users',icon:'👥',label:'ЮЗЕРЫ'},
          {id:'withdrawals',icon:'💸',label:`ЗАЯВКИ${withdrawals.filter(w=>w.status==='pending').length > 0 ? ' ('+withdrawals.filter(w=>w.status==='pending').length+')' : ''}`},
          {id:'system',icon:'🔧',label:'СИСТЕМА'},
        ].map(t => (
          <button key={t.id} className={`atab ${tab===t.id?'on':''}`} onClick={() => setTab(t.id)}>
            <span style={{fontSize:18,display:'block',lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:7,display:'block',marginTop:2,letterSpacing:'.05em'}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* STATS */}
      {tab === 'stats' && stats && (
        <div className="admin-section">
          <div className="stats-section-title">👥 ПОЛЬЗОВАТЕЛИ</div>
          <div className="stats-cards">
            <div className="astat-card"><div className="astat-val">{stats.total_users}</div><div className="astat-lbl">Всего</div></div>
            <div className="astat-card"><div className="astat-val">{stats.blocked_users}</div><div className="astat-lbl">Заблокировано</div></div>
            <div className="astat-card"><div className="astat-val">{stats.total_referrals}</div><div className="astat-lbl">Рефералов</div></div>
            <div className="astat-card"><div className="astat-val">{stats.tasks_completed}</div><div className="astat-lbl">Заданий выполнено</div></div>
          </div>

          <div className="stats-section-title">📈 СТЕЙКИНГ</div>
          <div className="stats-cards">
            <div className="astat-card"><div className="astat-val">{stats.active_stakes}</div><div className="astat-lbl">Активных стейков</div></div>
            <div className="astat-card"><div className="astat-val">{parseFloat(stats.total_staked).toFixed(2)}</div><div className="astat-lbl">TON в стейке</div></div>
            <div className="astat-card fee"><div className="astat-val">{parseFloat(stats.staking_fee_earned||0).toFixed(4)}</div><div className="astat-lbl">Комиссия стейкинга</div></div>
          </div>

          <div className="stats-section-title">✅ ЗАДАНИЯ</div>
          <div className="stats-cards">
            <div className="astat-card"><div className="astat-val">{stats.active_tasks||0}</div><div className="astat-lbl">Активных заданий</div></div>
            <div className="astat-card fee"><div className="astat-val">{parseFloat(stats.task_fee_earned||0).toFixed(4)}</div><div className="astat-lbl">Комиссия заданий</div></div>
          </div>

          <div className="stats-section-title">💰 ФИНАНСЫ ПРОЕКТА</div>
          <div className="stats-cards">
            <div className="astat-card green"><div className="astat-val">+{parseFloat(stats.total_deposited||0).toFixed(2)}</div><div className="astat-lbl">Пополнено</div></div>
            <div className="astat-card red"><div className="astat-val">-{parseFloat(stats.total_withdrawn||0).toFixed(2)}</div><div className="astat-lbl">Выведено</div></div>
            <div className="astat-card fee"><div className="astat-val">{(parseFloat(stats.total_deposited||0) - parseFloat(stats.total_withdrawn||0)).toFixed(2)}</div><div className="astat-lbl">Баланс проекта</div></div>
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
                    {s.key === 'project_wallet' ? (
                      <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                        <div style={{padding:'10px 14px',background:'#0b1630',border:'1px solid rgba(26,95,255,0.4)',borderRadius:10,fontFamily:'Orbitron,sans-serif',fontSize:9,color:'#00d4ff',wordBreak:'break-all',lineHeight:1.6,minHeight:40}}>
                          {settings[s.key] || 'Не задан'}
                        </div>
                        <button style={{padding:'9px',background:'#0e1c3a',border:'1px solid rgba(26,95,255,0.4)',borderRadius:10,fontFamily:'Orbitron,sans-serif',fontSize:10,fontWeight:700,color:'#e8f2ff',cursor:'pointer'}}
                          onClick={() => {
                            const val = prompt('Введите адрес TON кошелька:', settings['project_wallet'] || '')
                            if (val !== null) setSettings(p => ({...p, project_wallet: val.trim()}))
                          }}>
                          ✏️ ИЗМЕНИТЬ АДРЕС
                        </button>
                      </div>
                    ) : (
                      <input
                        className="setting-input"
                        type="number"
                        step="0.0001"
                        value={settings[s.key] ?? ''}
                        onChange={e => setSettings(p => ({...p, [s.key]: e.target.value}))}
                      />
                    )}
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
            // Парсим адрес и net сумму из label
            const labelParts = (w.label || '').split('|net:')
            const addr = labelParts[0]?.replace('Вывод на ', '') || '—'
            const netAmount = labelParts[1] ? parseFloat(labelParts[1]).toFixed(4) : Math.abs(parseFloat(w.amount)).toFixed(4)
            const amount = netAmount
            return (
              <div key={w.id} className={`withdrawal-item ${w.status}`}>
                <div className="wi-info">
                  <div className="wi-user">{w.username || w.first_name || 'Пользователь'}</div>
                  <div className="wi-date">{new Date(w.created_at).toLocaleDateString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  <div className="wi-copy-row">
                    <div className="wi-addr-short">{addr.length > 20 ? addr.slice(0,10)+'...'+addr.slice(-6) : addr}</div>
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

      {/* SPIN SETTINGS */}
      {tab === 'settings' && settingsTab === 'spin_custom' && (
        <div className="admin-section">
          <div className="stats-section-title">🎰 НАСТРОЙКИ СПИНА</div>
          <div className="setting-item">
            <div className="setting-label">Цена спина (TON)</div>
            <div className="setting-row">
              <input className="setting-input" type="number" step="0.01" value={settings['spin_price']||''} onChange={e=>setSettings(p=>({...p,spin_price:e.target.value}))}/>
              <button className="save-btn" onClick={()=>saveSetting('spin_price')}>{saving==='spin_price'?'...':'СОХР'}</button>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">Включён (1/0)</div>
            <div className="setting-row">
              <input className="setting-input" type="number" step="1" value={settings['spin_enabled']||''} onChange={e=>setSettings(p=>({...p,spin_enabled:e.target.value}))}/>
              <button className="save-btn" onClick={()=>saveSetting('spin_enabled')}>{saving==='spin_enabled'?'...':'СОХР'}</button>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-label">% от спина в джекпот</div>
            <div className="setting-row">
              <input className="setting-input" type="number" step="1" value={settings['spin_jackpot_fee']||''} onChange={e=>setSettings(p=>({...p,spin_jackpot_fee:e.target.value}))}/>
              <button className="save-btn" onClick={()=>saveSetting('spin_jackpot_fee')}>{saving==='spin_jackpot_fee'?'...':'СОХР'}</button>
            </div>
          </div>
          <div className="stats-section-title" style={{marginTop:16}}>СЕКТОРЫ</div>
          {spinSectors.map((s,i) => (
            <div key={i} className="sector-item">
              <div className="si-info">
                <div className="si-label">{s.label}</div>
                <div className="si-meta">Шанс: {s.chance}% · Приз: {s.type==='jackpot'?'ДЖЕКПОТ':`${s.value} TON`}</div>
              </div>
              <button className="si-edit" onClick={()=>setEditSector({...s,index:i})}>✏️</button>
            </div>
          ))}
        </div>
      )}

      {/* SECTOR EDIT MODAL */}
      {editSector && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditSector(null)}>
          <div className="modal-inner">
            <div className="modal-title">РЕДАКТОР СЕКТОРА</div>
            <div className="cf-row"><div className="cf-label">НАЗВАНИЕ</div>
              <input className="cf-input" value={editSector.label} onChange={e=>setEditSector(p=>({...p,label:e.target.value}))}/>
            </div>
            <div className="cf-row"><div className="cf-label">ТИП (ton/nothing/jackpot)</div>
              <input className="cf-input" value={editSector.type} onChange={e=>setEditSector(p=>({...p,type:e.target.value}))}/>
            </div>
            <div className="cf-row"><div className="cf-label">ПРИЗ (TON)</div>
              <input className="cf-input" type="number" step="0.01" value={editSector.value} onChange={e=>setEditSector(p=>({...p,value:parseFloat(e.target.value)||0}))}/>
            </div>
            <div className="cf-row"><div className="cf-label">ШАНС (%)</div>
              <input className="cf-input" type="number" step="1" value={editSector.chance} onChange={e=>setEditSector(p=>({...p,chance:parseFloat(e.target.value)||0}))}/>
            </div>
            <div className="mbtns" style={{marginTop:14}}>
              <button className="mbtn mb-c" onClick={()=>setEditSector(null)}>Отмена</button>
              <button className="mbtn mb-ok" onClick={async()=>{
                const updated = [...spinSectors]
                updated[editSector.index] = {label:editSector.label,type:editSector.type,value:editSector.value,chance:editSector.chance}
                await api.post('/api/admin/settings',{key:'spin_sectors',value:JSON.stringify(updated)})
                setSpinSectors(updated)
                setEditSector(null)
                showToast('СЕКТОР СОХРАНЁН')
              }}>СОХРАНИТЬ</button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM */}
      {tab === 'system' && (
        <div className="admin-section">
          <div className="system-card">
            <div className="sys-title">⏱ ПРОЕКТ РАБОТАЕТ</div>
            <div style={{fontFamily:'Orbitron,sans-serif',fontSize:22,fontWeight:700,color:'#00d4ff',textAlign:'center',padding:'10px 0',letterSpacing:'.05em'}}>{uptime}</div>
            <div style={{textAlign:'center',marginTop:4}}>
              <button className="sys-btn" style={{width:'auto',padding:'8px 16px',fontSize:9}} onClick={() => {
                const val = prompt('Дата запуска (ГГГГ-ММ-ДД):', settings?.launch_date || '2025-03-01')
                if (val) { api.post('/api/admin/settings', { key: 'launch_date', value: val }).then(() => setSettings(p => ({...p, launch_date: val}))).catch(() => {}) }
              }}>✏️ ИЗМЕНИТЬ ДАТУ</button>
            </div>
          </div>
          <div className="system-card">
            <div className="sys-title">🔧 ТЕХ ОБСЛУЖИВАНИЕ</div>
            <div className="sys-desc">При включении юзеры не смогут зайти в приложение</div>
            <button className={`sys-toggle ${maintenance ? 'on' : ''}`} onClick={toggleMaintenance}>
              {maintenance ? '🔴 ВЫКЛЮЧИТЬ (сейчас активно)' : '🟢 ВКЛЮЧИТЬ'}
            </button>
          </div>
          <div className="system-card">
            <div className="sys-title">💾 РЕЗЕРВНАЯ КОПИЯ БД</div>
            <div className="sys-desc">Скачать все данные проекта в формате JSON для переноса на другой сервер</div>
            <button className="sys-btn" onClick={downloadBackup} style={{marginBottom:8}}>⬇ СКАЧАТЬ БЭКАП</button>
            <label className="sys-btn" style={{display:'block',textAlign:'center',cursor:'pointer'}}>
              ⬆ ВОССТАНОВИТЬ ИЗ ФАЙЛА
              <input type="file" accept=".json" style={{display:'none'}} onChange={e => { if(e.target.files[0]) restoreBackup(e.target.files[0]) }}/>
            </label>
          </div>
          <div className="system-card">
            <div className="sys-title">📤 ВОССТАНОВИТЬ ИЗ БЭКАПА</div>
            <div className="sys-desc">Загрузи JSON файл бэкапа для восстановления данных</div>
            <input type="file" accept=".json" id="restore-file" style={{display:'none'}} onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              try {
                const text = await file.text()
                const data = JSON.parse(text)
                if (!window.confirm(`Восстановить из бэкапа от ${data.date?.slice(0,10)}?
Юзеров: ${data.users?.length}, Стейков: ${data.stakes?.length}`)) return
                const r = await api.post('/api/admin/restore', data)
                showToast(`ВОССТАНОВЛЕНО: ${r.data.restored.users} юзеров, ${r.data.restored.stakes} стейков`)
              } catch (err) {
                showToast('ОШИБКА: ' + (err?.response?.data?.error || err.message), true)
              }
              e.target.value = ''
            }}/>
            <button className="sys-btn" style={{borderColor:'rgba(0,230,118,0.4)',color:'#00e676'}} onClick={() => document.getElementById('restore-file').click()}>
              ⬆ ЗАГРУЗИТЬ БЭКАП
            </button>
          </div>
          <div className="system-card">
            <div className="sys-title">♻️ ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА</div>
            <div className="sys-desc">Загрузи JSON файл бэкапа для восстановления данных. Существующие данные будут перезаписаны.</div>
            <label className="sys-btn" style={{display:'block',textAlign:'center',cursor:'pointer'}}>
              ⬆ ЗАГРУЗИТЬ БЭКАП
              <input type="file" accept=".json" style={{display:'none'}} onChange={e => e.target.files[0] && restoreBackup(e.target.files[0])}/>
            </label>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && !selectedUser && (
        <div className="admin-section">
          <div className="users-search-row">
            <input className="users-search" placeholder="🔍 Поиск по имени или ID..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="users-sort-row">
            <div className="users-tabs">
              <button className={`utab ${usersTab==='all'?'on':''}`} onClick={() => setUsersTab('all')}>ВСЕ</button>
              <button className={`utab ${usersTab==='donors'?'on':''}`} onClick={() => setUsersTab('donors')}>💎 ДОНАТОРЫ</button>
            </div>
            <div className="sort-btns">
              {[{k:'created_at',l:'ДАТА'},{k:'balance_ton',l:'БАЛАНС'},{k:'referral_count',l:'РЕФЫ'}].map(s => (
                <button key={s.k} className={`sort-btn ${sortBy===s.k?'on':''}`} onClick={() => { if(sortBy===s.k) setSortDir(d=>d==='desc'?'asc':'desc'); else { setSortBy(s.k); setSortDir('desc') } }}>
                  {s.l}{sortBy===s.k ? (sortDir==='desc'?' ↓':' ↑') : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="users-count">{users.length} пользователей</div>
          {users
            .filter(u => {
              if (usersTab === 'donors') return parseFloat(u.balance_ton) > 0
              const q = search.toLowerCase()
              return !q || (u.username||'').toLowerCase().includes(q) || (u.first_name||'').toLowerCase().includes(q) || String(u.telegram_id).includes(q)
            })
            .sort((a, b) => {
              const va = parseFloat(a[sortBy]) || new Date(a[sortBy]).getTime() || 0
              const vb = parseFloat(b[sortBy]) || new Date(b[sortBy]).getTime() || 0
              return sortDir === 'desc' ? vb - va : va - vb
            })
            .map(u => (
            <div key={u.id} className={`admin-user-item ${u.is_blocked ? 'blocked' : ''}`} onClick={() => openUserStats(u)} style={{cursor:'pointer'}}>
              <div className="aui-avatar">{(u.username||u.first_name||'?')[0].toUpperCase()}</div>
              <div className="aui-info">
                <div className="aui-name">
                  {u.username || u.first_name || 'Пользователь'}
                  {u.is_blocked && <span className="blocked-badge">БЛОК</span>}
                </div>
                <div className="aui-meta">ID: {u.telegram_id} · Рефов: {u.referral_count}</div>
              </div>
              <div className="aui-balance">{parseFloat(u.balance_ton).toFixed(4)}</div>
              <div className="aui-actions" onClick={e => e.stopPropagation()}>
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

      {/* USER STATS */}
      {tab === 'users' && selectedUser && (
        <div className="admin-section">
          <button className="back-btn" onClick={() => { setSelectedUser(null); setUserStats(null) }}>← Назад</button>
          <div className="user-profile">
            <div className="up-avatar">{(selectedUser.username||selectedUser.first_name||'?')[0].toUpperCase()}</div>
            <div className="up-name">{selectedUser.username || selectedUser.first_name}</div>
            <div className="up-id">ID: {selectedUser.telegram_id}</div>
          </div>
          {userStats ? (
            <>
              <div className="stats-cards">
                <div className="astat-card"><div className="astat-val">{parseFloat(selectedUser.balance_ton).toFixed(4)}</div><div className="astat-lbl">Баланс TON</div></div>
                <div className="astat-card"><div className="astat-val">{userStats.stats.totalDeposit.toFixed(4)}</div><div className="astat-lbl">Депозитов</div></div>
                <div className="astat-card"><div className="astat-val">{userStats.stats.totalWithdraw.toFixed(4)}</div><div className="astat-lbl">Выводов</div></div>
                <div className="astat-card"><div className="astat-val">{userStats.stats.tasksCount}</div><div className="astat-lbl">Заданий</div></div>
                <div className="astat-card"><div className="astat-val">{selectedUser.referral_count}</div><div className="astat-lbl">Рефералов</div></div>
                <div className="astat-card"><div className="astat-val">{userStats.stats.totalStaked.toFixed(4)}</div><div className="astat-lbl">В стейке</div></div>
              </div>
              <div className="ut-section-title">ТРАНЗАКЦИИ</div>
              {userStats.txs.map(tx => (
                <div key={tx.id} className="ut-tx">
                  <div className="ut-tx-label">{tx.label?.split('|net:')[0]}</div>
                  <div className={`ut-tx-amt ${parseFloat(tx.amount)>0?'pos':'neg'}`}>{parseFloat(tx.amount)>0?'+':''}{parseFloat(tx.amount).toFixed(4)}</div>
                </div>
              ))}
            </>
          ) : <div className="spinner" style={{margin:'20px auto'}}/>}
        </div>
      )}
    </div>
    </>
  )
}