import { useState, useEffect } from 'react'
import { getTasks, completeTask } from '../../api/index'
import './Tasks.css'

const MOCK_TASKS = [
  { id: 1, type: 'subscribe', title: 'Подписаться на канал',   reward: 0.5,  completed: false, icon: '📢' },
  { id: 2, type: 'checkin',   title: 'Ежедневный чекин',       reward: 0.1,  completed: false, icon: '📅' },
  { id: 3, type: 'referral',  title: 'Пригласить 1 друга',     reward: 1.0,  completed: false, icon: '👥' },
  { id: 4, type: 'twitter',   title: 'Подписаться на Twitter', reward: 0.3,  completed: true,  icon: '🐦' },
  { id: 5, type: 'stake',     title: 'Сделать первый стейк',   reward: 0.5,  completed: false, icon: '💰' },
]

export default function Tasks() {
  const [tasks, setTasks]         = useState(MOCK_TASKS)
  const [completing, setCompleting] = useState(null)

  useEffect(() => {
    getTasks().then(r => setTasks(r.data)).catch(() => {})
  }, [])

  const handleComplete = async (task) => {
    if (task.completed || completing === task.id) return
    setCompleting(task.id)
    try {
      await completeTask(task.id)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t))
    } catch {}
    setCompleting(null)
  }

  const done  = tasks.filter(t => t.completed).length
  const total = tasks.length

  return (
    <div className="tasks fade-up">
      <div className="page-header">
        <div className="page-title">Задания</div>
        <div className="page-subtitle">Выполняй и получай TON</div>
      </div>

      {/* Progress */}
      <div className="tasks-progress card">
        <div className="progress-top">
          <span className="progress-label">Прогресс</span>
          <span className="progress-count">{done}/{total}</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Tasks list */}
      <div className="tasks-list">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`task-item card ${task.completed ? 'completed' : ''}`}
            onClick={() => handleComplete(task)}
          >
            <div className="task-icon">{task.icon}</div>
            <div className="task-info">
              <div className="task-title">{task.title}</div>
              <div className="task-reward">+{task.reward} TON</div>
            </div>
            <div className="task-action">
              {task.completed ? (
                <div className="task-done">✓</div>
              ) : completing === task.id ? (
                <div className="task-spinner" />
              ) : (
                <div className="task-btn">→</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
