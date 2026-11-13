import app from './server.ts';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);
app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
