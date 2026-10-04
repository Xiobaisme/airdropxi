// lib/onchain.js
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ES = 'https://api.etherscan.io/v2/api';

// p: es = Etherscan V2 (atau api custom Etherscan-compatible), bs = Blockscout, sol = Helius, none = belum ada
// Tanda "?" = belum gue verifikasi, cek lewat action=ping (lihat catatan di bawah)
const CHAINS = {
  // ── L1 ──
  ethereum:  { g:'L1', name:'Ethereum',   p:'es', id:1,     sym:'ETH',  ex:'https://etherscan.io' },
  bnb:       { g:'L1', name:'BNB Chain',  p:'none', sym:'BNB', ex:'https://bscscan.com' },
  avalanche: { g:'L1', name:'Avalanche',  p:'es', api:'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api', sym:'AVAX', ex:'https://snowtrace.io' },
  sonic:     { g:'L1', name:'Sonic',      p:'es', id:146,   sym:'S',    ex:'https://sonicscan.org' },
  sei:       { g:'L1', name:'Sei EVM',    p:'es', id:1329,  sym:'SEI',  ex:'https://seiscan.io' },      // ?
  cronos:    { g:'L1', name:'Cronos',     p:'es', id:25,    sym:'CRO',  ex:'https://cronoscan.com' },
  gnosis:    { g:'L1', name:'Gnosis',     p:'es', id:100,   sym:'xDAI', ex:'https://gnosisscan.io' },
  celo:      { g:'L1', name:'Celo',       p:'es', id:42220, sym:'CELO', ex:'https://celoscan.io' },
  kaia:      { g:'L1', name:'Kaia',       p:'es', id:8217,  sym:'KAIA', ex:'https://kaiascan.io' },     // ?
  // ── L2 ──
  arbitrum:  { g:'L2', name:'Arbitrum One', p:'es', id:42161, sym:'ETH', ex:'https://arbiscan.io' },
  base:      { g:'L2', name:'Base',       p:'bs', api:'https://base.blockscout.com',     sym:'ETH', ex:'https://base.blockscout.com' },
  op:        { g:'L2', name:'OP Mainnet', p:'bs', api:'https://optimism.blockscout.com', sym:'ETH', ex:'https://optimism.blockscout.com' },
  polygon:   { g:'L2', name:'Polygon PoS', p:'es', id:137,   sym:'POL', ex:'https://polygonscan.com' },
  zksync:    { g:'L2', name:'zkSync Era', p:'es', id:324,    sym:'ETH', ex:'https://era.zksync.network' },
  linea:     { g:'L2', name:'Linea',      p:'es', id:59144, sym:'ETH', ex:'https://lineascan.build' },
  scroll:    { g:'L2', name:'Scroll',     p:'es', id:534352, sym:'ETH', ex:'https://scrollscan.com' },
  mantle:    { g:'L2', name:'Mantle',     p:'es', id:5000,  sym:'MNT', ex:'https://mantlescan.xyz' },
  unichain:  { g:'L2', name:'Unichain',   p:'es', id:130,   sym:'ETH', ex:'https://uniscan.xyz' },
  ink:       { g:'L2', name:'Ink',        p:'bs', api:'https://explorer.inkonchain.com', sym:'ETH', ex:'https://explorer.inkonchain.com' },
  zora:      { g:'L2', name:'Zora',       p:'bs', api:'https://explorer.zora.energy',    sym:'ETH', ex:'https://explorer.zora.energy' },
  worldchain:{ g:'L2', name:'World Chain', p:'es', id:480,   sym:'ETH', ex:'https://worldscan.org' },
  soneium:   { g:'L2', name:'Soneium',    p:'bs', api:'https://soneium.blockscout.com',  sym:'ETH', ex:'https://soneium.blockscout.com' },
  taiko:     { g:'L2', name:'Taiko',      p:'es', id:167000, sym:'ETH', ex:'https://taikoscan.io' },
  blast:     { g:'L2', name:'Blast',      p:'es', id:81457, sym:'ETH', ex:'https://blastscan.io' },
  zircuit:   { g:'L2', name:'Zircuit',    p:'bs', api:'https://explorer.zircuit.com',    sym:'ETH', ex:'https://explorer.zircuit.com' }, // ?
  manta:     { g:'L2', name:'Manta Pacific', p:'bs', api:'https://pacific-explorer.manta.network', sym:'ETH', ex:'https://pacific-explorer.manta.network' },
  mode:      { g:'L2', name:'Mode',       p:'bs', api:'https://explorer.mode.network',   sym:'ETH', ex:'https://explorer.mode.network' },
  metis:     { g:'L2', name:'Metis',      p:'bs', api:'https://andromeda-explorer.metis.io', sym:'METIS', ex:'https://andromeda-explorer.metis.io' },
  fraxtal:   { g:'L2', name:'Fraxtal',    p:'es', id:252,   sym:'frxETH', ex:'https://fraxscan.com' },
  robinhood: { g:'L2', name:'Robinhood Chain', p:'none', sym:'ETH', ex:'' },
  // ── SOL ──
  solana:    { g:'SOL', name:'Solana',    p:'sol', sym:'SOL', ex:'https://solscan.io' },
};

// Label kontrak yang dikenal. Ini STARTER, tambah sendiri (bridge, CEX hot wallet, dll)
const KNOWN = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { label:'Uniswap V2 Router', type:'dex' },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { label:'Uniswap V3 Router', type:'dex' },
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { label:'Uniswap Universal Router', type:'dex' },
  '0x1111111254eeb25477b68fb85ed929f73a960582': { label:'1inch V5 Router', type:'dex' },
  '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': { label:'Tornado Cash 0.1 ETH', type:'mixer' },
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { label:'Tornado Cash 1 ETH',   type:'mixer' },
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { label:'Tornado Cash 10 ETH',  type:'mixer' },
  '0xa160cdab225685da1d56aa342ad8841c3b53f291': { label:'Tornado Cash 100 ETH', type:'mixer' },
};

async function jget(url, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Provider HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const wei = (v, dec = 18) => Number(v || 0) / 10 ** dec;

// ── Adapter: Etherscan V2 / Routescan (module=account) ──
async function viaEs(ch, addr) {
  const custom = !!ch.api;
  const q = (action) => `${ch.api || ES}?${custom ? '' : `chainid=${ch.id}&`}module=account&action=${action}` +
    `&address=${addr}&page=1&offset=100&sort=desc${custom ? '' : '&apikey=' + (process.env.ETHERSCAN_API_KEY || '')}`;
  const [tx, tk] = await Promise.all([jget(q('txlist')), jget(q('tokentx'))]);
  if (tx.message === 'NOTOK') throw new Error(String(tx.result).slice(0, 120));
  const A = (d) => (Array.isArray(d.result) ? d.result : []);
  const rows = [
    ...A(tx).filter(t => t.isError !== '1').map(t => ({ hash: t.hash, from: t.from, to: t.to, value: wei(t.value), sym: ch.sym, ts: Number(t.timeStamp) * 1000 })),
    ...A(tk).map(t => ({ hash: t.hash, from: t.from, to: t.to, value: wei(t.value, Number(t.tokenDecimal || 18)), sym: t.tokenSymbol || '?', ts: Number(t.timeStamp) * 1000 })),
  ];
  return { total: null, fetched: A(tx).length, rows };
}

// ── Adapter: Blockscout REST v2 (tanpa key) ──
async function viaBs(ch, addr) {
  const b = ch.api;
  const [tx, tk, cnt] = await Promise.all([
    jget(`${b}/api/v2/addresses/${addr}/transactions`),
    jget(`${b}/api/v2/addresses/${addr}/token-transfers?type=ERC-20`),
    jget(`${b}/api/v2/addresses/${addr}/counters`).catch(() => null),
  ]);
  const rows = [
    ...(tx.items || []).filter(t => t.status !== 'error').map(t => ({
      hash: t.hash, from: t.from?.hash, to: t.to?.hash, value: wei(t.value), sym: ch.sym, ts: Date.parse(t.timestamp) })),
    ...(tk.items || []).map(t => ({
      hash: t.transaction_hash || t.tx_hash, from: t.from?.hash, to: t.to?.hash,
      value: wei(t.total?.value, Number(t.total?.decimals ?? t.token?.decimals ?? 18)),
      sym: t.token?.symbol || t.token?.name || '?', ts: Date.parse(t.timestamp) })),
  ];
  const total = cnt?.transactions_count != null ? Number(cnt.transactions_count) : null;
  return { total, fetched: (tx.items || []).length, rows };
}

// ── Adapter: Solana via Helius (enhanced transactions) ──
async function viaSol(ch, addr) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY belum di-set');
  const txs = await jget(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${key}&limit=100`, 12000);
  const rows = [];
  for (const t of Array.isArray(txs) ? txs : []) {
    const ts = (t.timestamp || 0) * 1000;
    (t.nativeTransfers || []).forEach(n => n.amount > 0 && rows.push({
      hash: t.signature, from: n.fromUserAccount, to: n.toUserAccount, value: n.amount / 1e9, sym: 'SOL', ts }));
    (t.tokenTransfers || []).forEach(n => rows.push({
      hash: t.signature, from: n.fromUserAccount, to: n.toUserAccount, value: Number(n.tokenAmount) || 0,
      sym: (n.mint || '?').slice(0, 4) + '…', ts }));
  }
  return { total: null, fetched: Array.isArray(txs) ? txs.length : 0, rows };
}

const ADAPTERS = { es: viaEs, bs: viaBs, sol: viaSol };

function build(ch, key, address, raw) {
  const isEvm = ch.p !== 'sol';
  const norm = (a) => (isEvm ? String(a || '').toLowerCase() : String(a || ''));
  const me = norm(address);
  const rows = raw.rows
    .map(r => ({ ...r, from: norm(r.from), to: norm(r.to) }))
    .filter(r => r.value > 0 && r.from && r.to && r.from !== r.to && (r.from === me || r.to === me))
    .sort((a, b) => b.ts - a.ts);

  const map = new Map();
  for (const r of rows) {
    const k = `${r.from}|${r.to}|${r.sym}`;
    const e = map.get(k) || { from: r.from, to: r.to, sym: r.sym, amount: 0, count: 0, last_ts: 0, hashes: [] };
    e.amount += r.value; e.count++; e.last_ts = Math.max(e.last_ts, r.ts);
    if (e.hashes.length < 3 && !e.hashes.includes(r.hash)) e.hashes.push(r.hash);
    map.set(k, e);
  }
  const edges = [...map.values()];
  const labels = {};
  edges.forEach(e => [e.from, e.to].forEach(a => { if (KNOWN[a]) labels[a] = KNOWN[a]; }));

  return {
    chain: key, name: ch.name, address: me,
    total_tx: raw.total, fetched: raw.fetched,
    edges, labels, txs: rows.slice(0, 100),
    explorer: { addr: ch.ex + (isEvm ? '/address/' : '/account/'), tx: ch.ex + '/tx/' },
  };
}

async function lookup(key, address) {
  const ch = CHAINS[key];
  if (!ch) throw new Error('Chain tidak dikenal');
  if (ch.p === 'none') throw new Error(`${ch.name}: belum ada provider gratis yang dipasang`);
  const ok = ch.p === 'sol' ? SOL_RE.test(address) : EVM_RE.test(address);
  if (!ok) throw new Error('Format alamat tidak cocok dengan chain ini');
  return build(ch, key, address, await ADAPTERS[ch.p](ch, address));
}

function listChains() {
  return Object.entries(CHAINS).map(([key, c]) => ({ key, name: c.name, g: c.g, off: c.p === 'none' }));
}

// Tes semua chain pakai dead address, buat tau mana yang gagal / paid-only
async function pingAll() {
  const out = {};
  const keys = Object.keys(CHAINS).filter(k => CHAINS[k].p !== 'sol' && CHAINS[k].p !== 'none');
  for (let i = 0; i < keys.length; i += 3) {
    await Promise.all(keys.slice(i, i + 3).map(async k => {
      try { const d = await lookup(k, '0x000000000000000000000000000000000000dEaD'); out[k] = `ok (${d.edges.length} edges)`; }
      catch (e) { out[k] = 'GAGAL: ' + e.message; }
    }));
    await new Promise(r => setTimeout(r, 400)); // jaga limit 3 req/detik Etherscan
  }
  return out;
}

module.exports = { lookup, listChains, pingAll };
