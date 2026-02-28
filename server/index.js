import app from './app.js';

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Manager ISA API running at http://localhost:${PORT}`);
  });
}

export default app;
