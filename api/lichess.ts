import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const gameId = typeof req.query.game === 'string' ? req.query.game : undefined;
  if (!gameId) {
    res.status(400).json({ error: 'Query parameter "game" is required.' });
    return;
  }

  try {
    const targetUrl = `https://lichess.org/game/export/${encodeURIComponent(gameId)}?moves=1&clocks=0&tags=0&evals=0&opening=0`;
    const response = await fetch(targetUrl, {
      headers: { Accept: 'application/x-chess-pgn' },
      cache: 'no-store',
    });

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch game from Lichess.' });
      return;
    }

    const body = await response.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(body);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Unexpected proxy error.' });
  }
}

