import type { Move } from 'chess.js';

type MoveListProps = {
  moves: Move[];
};

export function MoveList({ moves }: MoveListProps) {
  if (moves.length === 0) {
    return <p className="muted">Пока ходов нет — начните дублировать партию.</p>;
  }

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i]?.san ?? '',
      black: moves[i + 1]?.san ?? '',
    });
  }

  return (
    <div className="move-list">
      <div className="move-row header">
        <span>#</span>
        <span>Белые</span>
        <span>Чёрные</span>
      </div>
      {rows.map((row) => (
        <div className="move-row" key={row.number}>
          <span>{row.number}</span>
          <span>{row.white}</span>
          <span>{row.black}</span>
        </div>
      ))}
    </div>
  );
}


