import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Move } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Arrow, PromotionPieceOption, Square } from 'react-chessboard/dist/chessboard/types';
import { useStockfishEngine } from './hooks/useStockfishEngine.ts';
import { MoveList } from './components/MoveList.tsx';

type BoardOrientation = 'white' | 'black';
type PromotionState = { from: Square; to: Square; color: 'w' | 'b' } | null;
type SyncStatus = 'idle' | 'connecting' | 'live' | 'error';

const BOARD_SIZES = {
  desktop: 520,
  mobile: 360,
};

const ARROW_COLORS = ['#4ade80', '#facc15', '#fb7185'];

export default function App() {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [orientation, setOrientation] = useState<BoardOrientation>('white');
  const [lastMoveSquares, setLastMoveSquares] = useState<{ from: string; to: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('Играйте как обычно и дублируйте ходы на доске.');
  const [promotionState, setPromotionState] = useState<PromotionState>(null);
  const [lichessLink, setLichessLink] = useState('');
  const [syncedGameId, setSyncedGameId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const history = useMemo(() => chessRef.current.history({ verbose: true }) as Move[], [fen]);
  const { analyze, suggestions, isReady, error, depth, lastUpdated } = useStockfishEngine();

  useEffect(() => {
    analyze(fen);
  }, [fen, analyze]);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      if (syncedGameId) {
        return false;
      }

      if (requiresPromotion(piece, targetSquare)) {
        setPromotionState({ from: sourceSquare as Square, to: targetSquare as Square, color: piece[0] as 'w' | 'b' });
        return false;
      }

      const move = chessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: determinePromotion(piece, targetSquare),
      });

      if (move) {
        setFen(chessRef.current.fen());
        setLastMoveSquares({ from: move.from, to: move.to });
        setStatusMessage(`Последний ход: ${move.san}`);
        return true;
      }

      return false;
    },
    [syncedGameId],
  );

  const handlePromotionPieceSelect = useCallback(
    (piece?: PromotionPieceOption) => {
      if (!promotionState || !piece) {
        setPromotionState(null);
        return false;
      }

      const promotion = mapPromotionPiece(piece);
      const move = chessRef.current.move({
        from: promotionState.from,
        to: promotionState.to,
        promotion,
      });

      if (move) {
        setFen(chessRef.current.fen());
        setLastMoveSquares({ from: move.from, to: move.to });
        setStatusMessage(`Последний ход: ${move.san}`);
      }

      setPromotionState(null);
      return Boolean(move);
    },
    [promotionState],
  );

  const handlePromotionCheck = useCallback((sourceSquare: Square, targetSquare: Square, piece: string) => {
    const needsPromotion = requiresPromotion(piece, targetSquare);
    if (needsPromotion) {
      setPromotionState({ from: sourceSquare, to: targetSquare, color: piece[0] as 'w' | 'b' });
    }
    return needsPromotion;
  }, []);

  const stopSync = useCallback(() => {
    setSyncedGameId(null);
    setSyncStatus('idle');
    setSyncError(null);
    setStatusMessage('Режим синхронизации отключён. Можно делать ходы вручную.');
  }, []);

  const startSync = useCallback(() => {
    const id = extractGameId(lichessLink);
    if (!id) {
      setSyncError('Введите корректную ссылку на партию Lichess.');
      setSyncStatus('error');
      return;
    }

    setSyncedGameId(id);
    setSyncStatus('connecting');
    setSyncError(null);
    setStatusMessage('Подключаемся к партии Lichess…');
  }, [lichessLink]);

  const undoLastMove = useCallback(() => {
    const undone = chessRef.current.undo();
    if (undone) {
      setFen(chessRef.current.fen());
      const previous = chessRef.current.history({ verbose: true }).at(-1);
      setLastMoveSquares(previous ? { from: previous.from, to: previous.to } : null);
    }
  }, []);

  const resetGame = useCallback(() => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setLastMoveSquares(null);
    setStatusMessage('Доска очищена, можно начинать новую партию.');
  }, []);

  useEffect(() => {
    if (!syncedGameId) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadFromLichess = async () => {
      try {
        const response = await fetch(`/api/lichess?game=${encodeURIComponent(syncedGameId)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || 'Не удалось получить данные партии. Убедитесь, что ссылка публичная.',
          );
        }

        const pgn = await response.text();
        const syncedChess = new Chess();
        syncedChess.loadPgn(pgn);

        if (!cancelled) {
          chessRef.current = syncedChess;
          setFen(syncedChess.fen());
          const latest = syncedChess.history({ verbose: true }).at(-1);
          setLastMoveSquares(latest ? { from: latest.from, to: latest.to } : null);
          setStatusMessage(latest ? `Последний ход: ${latest.san}` : 'Партия началась, ждём ходы.');
          setSyncStatus('live');
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Ошибка синхронизации с Lichess.');
      }
    };

    loadFromLichess();
    const poller = window.setInterval(loadFromLichess, 4000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(poller);
    };
  }, [syncedGameId]);

  const highlightStyles = useMemo(() => {
    if (!lastMoveSquares) return {};
    return {
      [lastMoveSquares.from]: {
        background:
          'radial-gradient(circle, rgba(255,255,0,0.6) 0%, rgba(255,255,0,0.35) 60%, rgba(255,255,0,0) 70%)',
      },
      [lastMoveSquares.to]: {
        background:
          'radial-gradient(circle, rgba(144,238,144,0.7) 0%, rgba(144,238,144,0.4) 60%, rgba(144,238,144,0) 70%)',
      },
    };
  }, [lastMoveSquares]);

  const boardSize =
    typeof window === 'undefined' || window.innerWidth >= 768 ? BOARD_SIZES.desktop : BOARD_SIZES.mobile;
  const evaluationText = suggestions[0]?.score ?? '—';
  const suggestionArrows = useMemo<Arrow[]>(() => {
    return suggestions.slice(0, 3).flatMap((entry, index) => {
      if (!entry.uci || entry.uci.length < 4) return [];
      const from = entry.uci.slice(0, 2);
      const to = entry.uci.slice(2, 4);
      if (!isSquare(from) || !isSquare(to)) return [];
      return [[from, to, ARROW_COLORS[index] ?? ARROW_COLORS[0]] as Arrow];
    });
  }, [suggestions]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">ИИ-помощник для живой партии</p>
          <h1>Дублируйте ходы и получайте лучшие подсказки</h1>
          <p className="subtitle">
            Вы играете на другом сайте, а здесь повторяете позицию. Stockfish анализирует и предлагает сильнейшие
            продолжения для вашей стороны.
          </p>
        </div>
        <div className="controls">
          <label className="control">
            <span>Моя сторона</span>
            <select value={orientation} onChange={(event) => setOrientation(event.target.value as BoardOrientation)}>
              <option value="white">Белые</option>
              <option value="black">Чёрные</option>
            </select>
          </label>
          <button type="button" onClick={undoLastMove} disabled={history.length === 0}>
            Отменить ход
          </button>
          <button type="button" className="ghost" onClick={resetGame}>
            Сбросить доску
          </button>
        </div>
        <div className="sync-panel">
          <label className="control full">
            <span>Ссылка на партию Lichess</span>
            <input
              type="text"
              placeholder="https://lichess.org/abcd1234"
              value={lichessLink}
              onChange={(event) => setLichessLink(event.target.value)}
            />
          </label>
          <div className="sync-actions">
            <button type="button" onClick={startSync} disabled={!lichessLink}>
              Подключить
            </button>
            {syncedGameId && (
              <button type="button" className="ghost" onClick={stopSync}>
                Отключить
              </button>
            )}
            <span className={`sync-status ${syncStatus}`}>
              {syncStatus === 'idle' && 'ожидание'}
              {syncStatus === 'connecting' && 'подключение…'}
              {syncStatus === 'live' && 'онлайн'}
              {syncStatus === 'error' && 'ошибка'}
            </span>
          </div>
          {syncError && <p className="error small">{syncError}</p>}
        </div>
      </header>

      <main className="layout">
        <section className="board-panel">
          <Chessboard
            position={fen}
            boardOrientation={orientation}
            onPieceDrop={handlePieceDrop}
            onPromotionCheck={handlePromotionCheck}
            onPromotionPieceSelect={handlePromotionPieceSelect}
            promotionToSquare={promotionState?.to ?? null}
            showPromotionDialog={Boolean(promotionState)}
            customBoardStyle={{ borderRadius: 18, boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)' }}
            customSquareStyles={highlightStyles}
            arePiecesDraggable={!syncedGameId}
            animationDuration={200}
            boardWidth={boardSize}
            customArrows={suggestionArrows}
          />
          <p className="status">{statusMessage}</p>
        </section>

        <section className="sidebar">
          <div className="card">
            <div className="card-header">
              <p className="eyebrow">Подсказки ИИ</p>
              <span className={`badge ${isReady ? 'success' : 'muted'}`}>{isReady ? 'готов' : 'запуск'}</span>
            </div>

            {error ? (
              <p className="error">{error}</p>
            ) : (
              <>
                <div className="evaluation">
                  <p className="label">Оценка позиции</p>
                  <p className="value">{evaluationText}</p>
                  <p className="depth">Глубина: {depth ?? '—'}</p>
                  {lastUpdated && <p className="timestamp">обновлено: {lastUpdated.toLocaleTimeString()}</p>}
                </div>
                <ul className="suggestions">
                  {suggestions.length === 0 && <li className="muted">Ждите анализа…</li>}
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <div className="suggestion-line">
                        <div>
                          <p className="move-san">{suggestion.san}</p>
                          <p className="line">{suggestion.pv}</p>
                        </div>
                        <span className="score">{suggestion.score}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <p className="eyebrow">История</p>
              <span className="muted small">{history.length} ходов</span>
            </div>
            <MoveList moves={history} />
          </div>
        </section>
      </main>
    </div>
  );
}

function determinePromotion(piece: string, targetSquare: string): 'q' | undefined {
  const isPawn = piece.toLowerCase().endsWith('p');
  const lastRank = targetSquare.endsWith('8') || targetSquare.endsWith('1');
  return isPawn && lastRank ? 'q' : undefined;
}

function isSquare(value: string): value is Arrow[0] {
  return /^[a-h][1-8]$/.test(value);
}

function requiresPromotion(piece: string, targetSquare: string) {
  const isPawn = piece.toLowerCase().endsWith('p');
  const promotionRank = piece.startsWith('w') ? '8' : '1';
  return isPawn && targetSquare.endsWith(promotionRank);
}

function mapPromotionPiece(piece: PromotionPieceOption) {
  const symbol = piece[1]?.toLowerCase();
  if (symbol === 'q' || symbol === 'r' || symbol === 'b' || symbol === 'n') {
    return symbol;
  }

  return 'q';
}

function extractGameId(rawLink: string) {
  const trimmed = rawLink.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/lichess\.org\/([A-Za-z0-9]{8,12})/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  const plainMatch = trimmed.match(/^([A-Za-z0-9]{8,12})$/i);
  return plainMatch ? plainMatch[1] : null;
}

