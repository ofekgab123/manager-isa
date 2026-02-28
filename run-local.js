import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import app from './server/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static files - only when running locally (Vercel serves public/ from CDN)
if (process.env.VERCEL !== '1') {
  const distPath = path.join(__dirname, 'public');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Manager ISA running at http://localhost:${PORT}`);
  });
}

export default app;
