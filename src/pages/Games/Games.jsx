import './Games.css'

const GAMES = [
  { id: 'spin', icon: '🎰', title: 'КОЛЕСО ФОРТУНЫ', desc: 'Крути колесо и выигрывай TON' },
]

export default function Games({ onSelectGame }) {
  return (
    <div className="games-wrap">
      <div className="games-title">🎮 ИГРЫ</div>
      <div className="games-grid">
        {GAMES.map(g => (
          <div key={g.id} className="game-card" onClick={() => onSelectGame(g.id)}>
            <div className="gc-icon">{g.icon}</div>
            <div className="gc-title">{g.title}</div>
            <div className="gc-desc">{g.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
