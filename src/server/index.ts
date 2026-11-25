import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dispatchesRouter from './routes/dispatches';
import sheltersRouter from './routes/shelters';
import teamsRouter from './routes/teams';
import { store } from './store/jsonStore';
import { sendError, sendSuccess } from './utils/response';

const app: Express = express();
const PORT = Number(process.env.PORT) || 3000;
const isCompiled = __filename.endsWith('.js');

app.use(cors());
app.use(express.json());

app.use((err: Error & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    sendError(res, 400, 'Invalid JSON payload');
    return;
  }
  next(err);
});

app.get('/api/health', (_req: Request, res: Response) => {
  const totalOccupancy = store.shelters.reduce((sum, s) => sum + s.current_occupancy, 0);
  const totalCapacity = store.shelters.reduce((sum, s) => sum + s.max_capacity, 0);
  const activeDispatches = store.emergency_dispatches.filter((d) => d.status === 'Active').length;
  const standbyTeams = store.response_teams.filter((t) => t.status === 'Standby').length;

  sendSuccess(res, 200, 'Rescify API is running', {
    status: 'ok',
    storage: 'in-memory-json',
    counts: {
      shelters: store.shelters.length,
      total_occupancy: totalOccupancy,
      total_capacity: totalCapacity,
      response_teams: store.response_teams.length,
      standby_teams: standbyTeams,
      dispatches: store.emergency_dispatches.length,
      active_dispatches: activeDispatches,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/shelters', sheltersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/dispatches', dispatchesRouter);

app.use('/api/*', (_req: Request, res: Response) => {
  sendError(res, 404, 'API endpoint not found');
});

async function setupFrontend(expressApp: Express): Promise<void> {
  if (!isCompiled && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    expressApp.use(vite.middlewares);
    return;
  }

  const clientDistDir = path.resolve(__dirname, '../../dist/public');

  if (fs.existsSync(clientDistDir)) {
    expressApp.use(express.static(clientDistDir));
    expressApp.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }
}

export const ready = setupFrontend(app);

if (require.main === module) {
  ready.then(() => {
    app.listen(PORT, () => {
      console.log(`Rescify Command Center running on http://localhost:${PORT}`);
    });
  });
}

export default app;
