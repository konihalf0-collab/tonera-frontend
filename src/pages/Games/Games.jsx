import './Games.css'

const GAMES = [
  { id: 'spin',    icon: '🎡', title: 'КОЛЕСО ФОРТУНЫ', desc: 'Крути колесо и выигрывай TON' },
  { id: 'trading', icon: '₿',  title: 'ТРЕЙДИНГ BTC',   desc: 'Угадай движение цены Bitcoin' },
]

export default function Games({ onGame, tradingStatus = '1' }) {
  return (
    <div className="games-wrap">
      <div className="games-title">🎮 ИГРЫ</div>
      <div className="games-grid">
        {GAMES.map(g => {
          if (g.id === 'trading' && String(tradingStatus) === '0') return null
          const isMaint = g.id === 'trading' && String(tradingStatus) === '2'

          return (
            <div key={g.id} className={`game-card ${isMaint ? 'maint' : ''}`}
              onClick={() => !isMaint && onGame(g.id)}>
              <div className="gc-icon">{isMaint ? '🔧' : g.icon}</div>
              <div className="gc-title">{g.title}</div>
              <div className="gc-desc">{isMaint ? 'Технические работы' : g.desc}</div>
              {isMaint && <div className="gc-maint-badge">ТЕХ. РАБОТЫ</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
