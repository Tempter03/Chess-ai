declare module 'stockfish.wasm' {
  export type StockfishInstance = {
    postMessage(message: string): void;
    addMessageListener(listener: (line: string) => void): void;
    removeMessageListener(listener: (line: string) => void): void;
    terminate(): void;
  };

  export default function Stockfish(moduleOverrides?: Record<string, unknown>): Promise<StockfishInstance>;
}


