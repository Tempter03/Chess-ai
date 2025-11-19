import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { StockfishInstance } from '../stockfish-wasm';
import { loadStockfishFactory } from '../utils/loadStockfish.ts';

export type Suggestion = {
  id: number;
  multipv: number;
  san: string;
  pv: string;
  uci: string;
  score: string;
};

type EngineState = {
  suggestions: Suggestion[];
  depth: number | null;
  lastUpdated: Date | null;
  error: string | null;
  isReady: boolean;
};

const initialState: EngineState = {
  suggestions: [],
  depth: null,
  lastUpdated: null,
  error: null,
  isReady: false,
};

export function useStockfishEngine() {
  const [state, setState] = useState<EngineState>(initialState);
  const engineRef = useRef<StockfishInstance | null>(null);
  const pendingFenRef = useRef<string | null>(null);
  const fenRef = useRef<string>('');
  const listenerRef = useRef<((line: string) => void) | null>(null);
  const disposedRef = useRef(false);
  const analysisCacheRef = useRef<Map<number, Suggestion>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const initEngine = async () => {
      try {
        const createEngine = await loadStockfishFactory();
        const engine = await createEngine();
        if (cancelled) return;

        engineRef.current = engine;
        listenerRef.current = (line: string) => handleEngineMessage(line);
        engine.addMessageListener(listenerRef.current);
        engine.postMessage('uci');
        engine.postMessage('setoption name Threads value 2');
        engine.postMessage('setoption name MultiPV value 3');
        engine.postMessage('setoption name Skill Level value 20');
        engine.postMessage('isready');
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: 'Не удалось запустить движок Stockfish. Обновите браузер и попробуйте снова.',
        }));
      }
    };

    initEngine();

    return () => {
      cancelled = true;
      disposedRef.current = true;
      if (listenerRef.current && engineRef.current) {
        engineRef.current.removeMessageListener(listenerRef.current);
      }
      engineRef.current?.terminate();
    };
  }, []);

  const handleEngineMessage = useCallback(
    (line: string) => {
      if (disposedRef.current) return;
      if (line.includes('Nodes searched')) return;

      if (line === 'readyok') {
        setState((prev) => ({ ...prev, isReady: true }));
        if (pendingFenRef.current) {
          analyzeFen(pendingFenRef.current);
          pendingFenRef.current = null;
        }
        return;
      }

      if (line.startsWith('bestmove')) {
        return;
      }

      if (!line.startsWith('info') || !line.includes(' pv ')) return;

      const parsed = parseInfoLine(line);
      if (!parsed) return;
      const { multipv, depth, score, pv, uci } = parsed;

      const san = convertUciToSan(fenRef.current, uci);
      const pvSan = convertPvToSan(fenRef.current, pv);

      analysisCacheRef.current.set(multipv, {
        id: multipv,
        multipv,
        san,
        score,
        pv: pvSan,
        uci,
      });

      const suggestions = Array.from(analysisCacheRef.current.values()).sort((a, b) => a.multipv - b.multipv);

      setState((prev) => ({
        ...prev,
        suggestions,
        depth,
        lastUpdated: new Date(),
      }));
    },
    [],
  );

  const analyzeFen = useCallback(
    (fen: string) => {
      if (!engineRef.current) {
        pendingFenRef.current = fen;
        return;
      }

      fenRef.current = fen;
      analysisCacheRef.current.clear();
      engineRef.current.postMessage('stop');
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage('go depth 16');
    },
    [],
  );

  const analyze = useCallback(
    (fen: string) => {
      if (state.error) return;
      analyzeFen(fen);
    },
    [analyzeFen, state.error],
  );

  return useMemo(
    () => ({
      analyze,
      suggestions: state.suggestions,
      depth: state.depth,
      isReady: state.isReady,
      error: state.error,
      lastUpdated: state.lastUpdated,
    }),
    [analyze, state],
  );
}

function parseInfoLine(line: string) {
  const tokens = line.trim().split(/\s+/);
  const multipvIndex = tokens.indexOf('multipv');
  const depthIndex = tokens.indexOf('depth');
  const scoreIndex = tokens.indexOf('score');
  const pvIndex = tokens.indexOf('pv');

  if (pvIndex === -1 || scoreIndex === -1 || multipvIndex === -1) {
    return null;
  }

  const scoreType = tokens[scoreIndex + 1];
  const scoreRaw = Number(tokens[scoreIndex + 2]);
  const multipv = Number(tokens[multipvIndex + 1]);
  const depth = depthIndex !== -1 ? Number(tokens[depthIndex + 1]) : null;
  const pv = tokens.slice(pvIndex + 1);
  const uci = pv[0];

  return {
    multipv,
    depth,
    score: formatScore(scoreType, scoreRaw),
    pv,
    uci,
  };
}

function formatScore(type: string, raw: number) {
  if (type === 'mate') {
    const sign = raw > 0 ? '+' : '-';
    return `${sign}#${Math.abs(raw)}`;
  }

  const value = raw / 100;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function convertUciToSan(fen: string, uci: string) {
  if (!uci) return '';
  const chess = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? (uci.slice(4) as 'q' | 'r' | 'b' | 'n') : undefined;
  const move = chess.move({ from, to, promotion });
  return move?.san ?? uci;
}

function convertPvToSan(fen: string, pvMoves: string[]) {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];

  pvMoves.forEach((uci) => {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? (uci.slice(4) as 'q' | 'r' | 'b' | 'n') : undefined;
    const move = chess.move({ from, to, promotion });
    if (move) {
      sanMoves.push(move.san);
    }
  });

  return sanMoves.slice(0, 4).join(' ');
}

