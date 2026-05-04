import app, { runStartupLionWheelSync } from './app.js';
import { initDb } from './db.js';

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3002;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Manager ISA API running at http://localhost:${PORT}`);
      void runStartupLionWheelSync();
    });
  }).catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

export default app;
