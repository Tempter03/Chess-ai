export type StockfishInstance = {
  postMessage(message: string): void;
  addMessageListener(listener: (line: string) => void): void;
  removeMessageListener(listener: (line: string) => void): void;
  terminate(): void;
};

export type StockfishFactory = () => Promise<StockfishInstance>;

declare global {
  interface Window {
    Stockfish?: StockfishFactory;
  }
}


