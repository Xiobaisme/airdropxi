const KEY = 'airdrops:data';

async function loadAirdrops(redis) {
  try {
    const v = await redis.get(KEY);
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    if (Array.isArray(arr)) return arr;
  } catch (e) { console.warn('[airdrops] redis gagal, pakai JSON:', e.message); }
  return require('../data/airdrops.json');
}

async function saveAirdrops(redis, list) {
  await redis.set(KEY, JSON.stringify(list));
}

module.exports = { loadAirdrops, saveAirdrops };