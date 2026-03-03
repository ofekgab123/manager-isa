/**
 * Storage adapter: file system (local) or Upstash Redis (Vercel)
 * Uses Redis when UPSTASH_REDIS_REST_URL is set
 */
const KEY = 'manager-isa:orders';
const AFFILIATES_KEY = 'manager-isa:affiliates';

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return Redis.fromEnv();
}

export async function readOrders() {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = await getRedis();
    const data = await redis.get(KEY);
    return Array.isArray(data) ? data : [];
  }
  // Local dev: use file system
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(__dirname, 'data', 'orders.json');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function writeOrders(orders) {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = await getRedis();
    await redis.set(KEY, orders);
    return;
  }
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(__dirname, 'data', 'orders.json');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(orders, null, 2), 'utf-8');
}

export async function readAffiliates() {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = await getRedis();
    const data = await redis.get(AFFILIATES_KEY);
    return Array.isArray(data) ? data : [];
  }
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(__dirname, 'data', 'affiliates.json');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function writeAffiliates(affiliates) {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = await getRedis();
    await redis.set(AFFILIATES_KEY, affiliates);
    return;
  }
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(__dirname, 'data', 'affiliates.json');
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(affiliates, null, 2), 'utf-8');
}
