import app from './app.js';
import { initDb } from './db.js';
import { processDueCapiOutbox } from './capiOutbox.js';

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3002;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Manager ISA API running at http://localhost:${PORT}`);
    });
    setInterval(() => {
      processDueCapiOutbox().catch((err) => console.error('[capi]', err?.message || err));
    }, 60_000);
  }).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

export default app;
