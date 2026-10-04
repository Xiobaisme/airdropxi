// lib/onchain.js
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_RE = /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
const ES = 'https://api.etherscan.io/v2/api';

// p: es = Etherscan V2 (atau api custom Etherscan-compatible), bs = Blockscout, sol = Helius, none = belum ada
// Tanda "?" = belum gue verifikasi, cek lewat action=ping (lihat catatan di bawah)
const CHAINS = {
  // ── L1 ──
  ethereum:  { g:'L1', name:'Ethereum',   p:'es', id:1,     sym:'ETH',  lbl:'https://eth.blockscout.com', ex:'https://etherscan.io' },
  bnb: { g:'L1', name:'BNB Chain', p:'nr', sym:'BNB', ex:'https://bscscan.com' },
  avalanche: { g:'L1', name:'Avalanche',  p:'es', api:'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api', sym:'AVAX', ex:'https://snowtrace.io' },
  sonic:     { g:'L1', name:'Sonic',      p:'es', id:146,   sym:'S',    ex:'https://sonicscan.org' },
  sei:       { g:'L1', name:'Sei EVM',    p:'es', id:1329,  sym:'SEI',  ex:'https://seiscan.io' },      // ?
  cronos:    { g:'L1', name:'Cronos',     p:'es', id:25,    sym:'CRO',  ex:'https://cronoscan.com' },
  gnosis:    { g:'L1', name:'Gnosis',     p:'es', id:100,   sym:'xDAI', lbl:'https://gnosis.blockscout.com', ex:'https://gnosisscan.io' },
  celo:      { g:'L1', name:'Celo',       p:'es', id:42220, sym:'CELO', ex:'https://celoscan.io' },
  kaia:      { g:'L1', name:'Kaia',       p:'es', id:8217,  sym:'KAIA', ex:'https://kaiascan.io' },     // ?
  // ── L2 ──
  arbitrum:  { g:'L2', name:'Arbitrum One', p:'es', id:42161, sym:'ETH', lbl:'https://arbitrum.blockscout.com', ex:'https://arbiscan.io' },
  base:      { g:'L2', name:'Base',       p:'bs', api:'https://base.blockscout.com',     sym:'ETH', ex:'https://base.blockscout.com' },
  op:        { g:'L2', name:'OP Mainnet', p:'bs', api:'https://optimism.blockscout.com', sym:'ETH', ex:'https://optimism.blockscout.com' },
  polygon:   { g:'L2', name:'Polygon PoS', p:'es', id:137,   sym:'POL', lbl:'https://polygon.blockscout.com', ex:'https://polygonscan.com' },
  zksync:    { g:'L2', name:'zkSync Era', p:'es', id:324,    sym:'ETH', lbl:'https://zksync.blockscout.com', ex:'https://era.zksync.network' },
  linea:     { g:'L2', name:'Linea',      p:'es', id:59144, sym:'ETH', ex:'https://lineascan.build' },
  scroll:    { g:'L2', name:'Scroll',     p:'es', id:534352, sym:'ETH', lbl:'https://scroll.blockscout.com', ex:'https://scrollscan.com' },
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
  robinhood: { g:'L2', name:'Robinhood Chain', p:'bs', api:'https://robinhoodchain.blockscout.com', sym:'ETH', ex:'https://robinhoodchain.blockscout.com' },
  // ── SOL ──
  solana:    { g:'SOL', name:'Solana',    p:'sol', sym:'SOL', ex:'https://solscan.io' },
  // ── BTC ──
  bitcoin:   { g:'BTC', name:'Bitcoin',   p:'btc', sym:'BTC', ex:'https://mempool.space' },
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

// ── Adapter: Etherscan V2 / Routescan (+ internal tx) ──
async function viaEs(ch, addr) {
  const custom = !!ch.api;
  const q = (action) => `${ch.api || ES}?${custom ? '' : `chainid=${ch.id}&`}module=account&action=${action}` +
   `&address=${addr}&page=1&offset=500&sort=desc${custom ? '' : '&apikey=' + (process.env.ETHERSCAN_API_KEY || '')}`;
  const [tx, tk, itx] = await Promise.all([
    jget(q('txlist')), jget(q('tokentx')), jget(q('txlistinternal')).catch(() => ({})),
  ]);
  if (tx.message === 'NOTOK') throw new Error(String(tx.result).slice(0, 120));
  const A = (d) => (Array.isArray(d.result) ? d.result : []);
  const native = (t) => ({ hash: t.hash, from: t.from, to: t.to, value: wei(t.value), sym: ch.sym, ts: Number(t.timeStamp) * 1000 });
  const rows = [
    ...A(tx).filter(t => t.isError !== '1').map(native),
    ...A(itx).filter(t => t.isError !== '1').map(native),
    ...A(tk).map(t => ({ hash: t.hash, from: t.from, to: t.to, value: wei(t.value, Number(t.tokenDecimal || 18)), sym: t.tokenSymbol || '?', ts: Number(t.timeStamp) * 1000 })),
  ];
  return { total: null, fetched: A(tx).length, rows };
}

// ── Adapter: Blockscout REST v2 (+ internal tx) ──
async function viaBs(ch, addr) {
  const b = ch.api;
  const [tx, tk, it, cnt] = await Promise.all([
    jget(`${b}/api/v2/addresses/${addr}/transactions`),
    jget(`${b}/api/v2/addresses/${addr}/token-transfers?type=ERC-20`),
    jget(`${b}/api/v2/addresses/${addr}/internal-transactions`).catch(() => ({ items: [] })),
    jget(`${b}/api/v2/addresses/${addr}/counters`).catch(() => null),
  ]);
  const native = (t, hash) => ({ hash, from: t.from?.hash, to: t.to?.hash, value: wei(t.value), sym: ch.sym, ts: Date.parse(t.timestamp) });
  const rows = [
    ...(tx.items || []).filter(t => t.status !== 'error').map(t => native(t, t.hash)),
    ...(it.items || []).filter(t => t.success !== false).map(t => native(t, t.transaction_hash || t.tx_hash)),
    ...(tk.items || []).map(t => ({
      hash: t.transaction_hash || t.tx_hash, from: t.from?.hash, to: t.to?.hash,
      value: wei(t.total?.value, Number(t.total?.decimals ?? t.token?.decimals ?? 18)),
      sym: t.token?.symbol || t.token?.name || '?', ts: Date.parse(t.timestamp) })),
  ];
  const total = cnt?.transactions_count != null ? Number(cnt.transactions_count) : null;
  return { total, fetched: (tx.items || []).length, rows };
}

// ── Adapter: Solana via Helius (bawa nama DEX dari field source) ──
async function viaSol(ch, addr) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('HELIUS_API_KEY belum di-set');
  const txs = await jget(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${key}&limit=100`, 12000);
  const rows = [];
  for (const t of Array.isArray(txs) ? txs : []) {
    const ts = (t.timestamp || 0) * 1000;
    const dex = t.type === 'SWAP' && t.source && t.source !== 'SYSTEM_PROGRAM' ? t.source : undefined;
    (t.nativeTransfers || []).forEach(n => n.amount > 0 && rows.push({
      hash: t.signature, from: n.fromUserAccount, to: n.toUserAccount, value: n.amount / 1e9, sym: 'SOL', ts, dex }));
    (t.tokenTransfers || []).forEach(n => rows.push({
      hash: t.signature, from: n.fromUserAccount, to: n.toUserAccount, value: Number(n.tokenAmount) || 0,
      sym: (n.mint || '?').slice(0, 4) + '…', ts, dex }));
  }
  return { total: null, fetched: Array.isArray(txs) ? txs.length : 0, rows };
}

// ── Adapter: NodeReal MegaNode (BNB Chain) via nr_getAssetTransfers ──
const hexNum = (v) => {
  if (v == null || v === '') return 0;
  try { return Number(BigInt(v)); } catch { return Number(v) || 0; }
};

async function nrCall(params) {
  const key = process.env.NODEREAL_API_KEY;
  if (!key) throw new Error('NODEREAL_API_KEY belum di-set');
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const r = await fetch(`https://bsc-mainnet.nodereal.io/v1/${key}`, {
      method: 'POST', signal: c.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'nr_getAssetTransfers', params: [params] }),
    });
    if (!r.ok) throw new Error('Provider HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(String(d.error.message || 'RPC error').slice(0, 120));
    return d.result?.transfers || [];
  } finally { clearTimeout(t); }
}

async function viaNr(ch, addr) {
  const base = { category: ['external', 'internal', '20'], withMetadata: true, excludeZeroValue: true, pageSize: 100, order: 'desc' };
  // kalau parameter "order" ditolak provider, ulangi tanpa order
  const call = (extra) => nrCall({ ...base, ...extra }).catch((e) => {
  if (!/belum di-set|HTTP/.test(e.message)) { const { order, ...rest } = base; return nrCall({ ...rest, ...extra }); }
    throw e;
  });
  const [outs, ins] = await Promise.all([call({ fromAddress: addr }), call({ toAddress: addr })]);

  const tsOf = (t) => {
    const raw = t.blockTimeStamp ?? t.blockTimestamp ?? t.metadata?.blockTimestamp;
    if (typeof raw === 'string' && raw.includes('-')) return Date.parse(raw);
    const s = hexNum(raw);
    return s < 1e12 ? s * 1000 : s;
  };

  const seen = new Set(), rows = [];
  for (const t of [...outs, ...ins]) {
    const k = `${t.hash}|${t.from}|${t.to}|${t.asset}|${t.value}|${t.category}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const dec = t.decimal != null && t.decimal !== '' ? hexNum(t.decimal) : 18;
    const value = typeof t.value === 'string' && t.value.includes('.') ? Number(t.value) : hexNum(t.value) / 10 ** dec;
    const native = t.category === 'external' || t.category === 'internal';
    rows.push({ hash: t.hash, from: t.from, to: t.to, value, sym: t.asset || (native ? ch.sym : '?'), ts: tsOf(t) });
  }
  return { total: null, fetched: outs.length + ins.length, rows };
}

// ── Adapter: Bitcoin via mempool.space (Esplora API, tanpa key) ──
async function viaBtc(ch, addr) {
  const B = 'https://mempool.space/api';
  const [info, first] = await Promise.all([
    jget(`${B}/address/${addr}`).catch(() => null),
    jget(`${B}/address/${addr}/txs`),
  ]);
  let txs = Array.isArray(first) ? first : [];
  // halaman berikutnya (25 tx confirmed/halaman), maksimal 3 halaman tambahan
  for (let i = 0; i < 3 && txs.length < 100; i++) {
    const last = [...txs].reverse().find(t => t.status?.confirmed);
    if (!last) break;
    const more = await jget(`${B}/address/${addr}/txs/chain/${last.txid}`).catch(() => []);
    if (!Array.isArray(more) || !more.length) break;
    txs = txs.concat(more);
    if (more.length < 25) break;
  }

  const rows = [];
  for (const t of txs) {
    const ts = (t.status?.block_time || Math.floor(Date.now() / 1000)) * 1000;
    const ins = (t.vin || []).filter(v => v.prevout?.scriptpubkey_address);
    const outs = (t.vout || []).filter(o => o.scriptpubkey_address);
    if (ins.some(v => v.prevout.scriptpubkey_address === addr)) {
      // wallet ini pengirim: setiap output ke alamat lain = transfer keluar (change ke diri sendiri dibuang)
      outs.forEach(o => o.scriptpubkey_address !== addr && o.value > 0 && rows.push({
        hash: t.txid, from: addr, to: o.scriptpubkey_address, value: o.value / 1e8, sym: 'BTC', ts }));
    } else {
      // wallet ini penerima: bagi jumlah masuk ke tiap pengirim sesuai porsi input-nya
      const got = outs.filter(o => o.scriptpubkey_address === addr).reduce((s, o) => s + o.value, 0);
      if (!got) continue;
      const by = new Map();
      ins.forEach(v => by.set(v.prevout.scriptpubkey_address, (by.get(v.prevout.scriptpubkey_address) || 0) + v.prevout.value));
      const tot = [...by.values()].reduce((a, b) => a + b, 0) || 1;
      by.forEach((v, a) => rows.push({ hash: t.txid, from: a, to: addr, value: (got * v / tot) / 1e8, sym: 'BTC', ts }));
    }
  }
  const total = info?.chain_stats ? info.chain_stats.tx_count + (info.mempool_stats?.tx_count || 0) : null;
  return { total, fetched: txs.length, rows };
}

const ADAPTERS = { es: viaEs, bs: viaBs, sol: viaSol, nr: viaNr, btc: viaBtc };
const sumBy = (rows) => {
  const m = new Map();
  rows.forEach(r => m.set(r.sym, (m.get(r.sym) || 0) + r.value));
  return [...m].map(([sym, amount]) => ({ sym, amount }));
};
const topOf = (arr) => arr.reduce((a, b) => (b.amount > a.amount ? b : a));
const niceDex = (s) => s.charAt(0) + s.slice(1).toLowerCase();

function build(ch, key, address, raw) {
    const isEvm = ch.p !== 'sol' && ch.p !== 'btc';
  const norm = (a) => (isEvm ? String(a || '').toLowerCase() : String(a || ''));
  const me = norm(address);
  const rows = raw.rows
    .map(r => ({ ...r, from: norm(r.from), to: norm(r.to) }))
    .filter(r => r.value > 0 && r.from && r.to && r.from !== r.to && (r.from === me || r.to === me))
    .sort((a, b) => b.ts - a.ts);

  // ── Deteksi swap: dalam 1 tx, wallet kirim token A DAN terima token B ──
  const byHash = new Map();
  for (const r of rows) { if (!byHash.has(r.hash)) byHash.set(r.hash, []); byHash.get(r.hash).push(r); }

  const swapHashes = new Set(), swapMap = new Map(), swapTxs = [], labels = {};
  for (const [hash, list] of byHash) {
    const outs = list.filter(r => r.from === me), ins = list.filter(r => r.to === me);
    if (!outs.length || !ins.length) continue;
    const sold = topOf(sumBy(outs)), bought = topOf(sumBy(ins));
    if (sold.sym === bought.sym) continue;
    const via = outs.find(r => r.sym === sold.sym).to;
    const dex = list.find(r => r.dex)?.dex;
    const wrap = ('W' + sold.sym === bought.sym) || ('W' + bought.sym === sold.sym);
    const ts = list[0].ts;

    swapHashes.add(hash);
    swapTxs.push({ hash, from: me, to: via, kind: 'swap', wrap, sold, bought, sym: sold.sym, value: sold.amount, ts });

    const k = `${via}|${sold.sym}|${bought.sym}`;
    const e = swapMap.get(k) || { from: me, to: via, kind: 'swap', wrap, sym: `${sold.sym}>${bought.sym}`,
      sold: { sym: sold.sym, amount: 0 }, bought: { sym: bought.sym, amount: 0 }, amount: 0, count: 0, last_ts: 0, hashes: [] };
    e.sold.amount += sold.amount; e.bought.amount += bought.amount; e.amount = e.sold.amount;
    e.count++; e.last_ts = Math.max(e.last_ts, ts);
    if (e.hashes.length < 3) e.hashes.push(hash);
    swapMap.set(k, e);

    if (!KNOWN[via]) labels[via] = dex ? { label: niceDex(dex), type: 'dex' }
      : { label: wrap ? 'Wrap/Unwrap' : 'DEX Swap', type: 'dex', auto: true };
  }

  // ── Transfer biasa (leg swap dibuang supaya diagram tidak ramai) ──
  const normal = rows.filter(r => !swapHashes.has(r.hash));
  const map = new Map();
  for (const r of normal) {
    const k = `${r.from}|${r.to}|${r.sym}`;
    const e = map.get(k) || { from: r.from, to: r.to, sym: r.sym, amount: 0, count: 0, last_ts: 0, hashes: [] };
    e.amount += r.value; e.count++; e.last_ts = Math.max(e.last_ts, r.ts);
    if (e.hashes.length < 3 && !e.hashes.includes(r.hash)) e.hashes.push(r.hash);
    map.set(k, e);
  }
  const edges = [...swapMap.values(), ...map.values()];
  edges.forEach(e => [e.from, e.to].forEach(a => { if (KNOWN[a]) labels[a] = KNOWN[a]; }));

  return {
    chain: key, name: ch.name, address: me,
    total_tx: raw.total, fetched: raw.fetched, swap_count: swapTxs.length,
    edges, labels,
        txs: [...swapTxs, ...normal].sort((a, b) => b.ts - a.ts).slice(0, 500),
     explorer: { addr: ch.ex + (ch.p === 'sol' ? '/account/' : '/address/'), tx: ch.ex + '/tx/' },
  };
}

async function lookup(key, address) {
  const ch = CHAINS[key];
  if (!ch) throw new Error('Chain tidak dikenal');
  if (ch.p === 'none') throw new Error(`${ch.name}: belum ada provider gratis yang dipasang`);
    if (ch.p === 'btc' && /^bc1/i.test(address)) address = address.toLowerCase();
  const ok = ch.p === 'sol' ? SOL_RE.test(address) : ch.p === 'btc' ? BTC_RE.test(address) : EVM_RE.test(address);
  if (!ok) throw new Error('Format alamat tidak cocok dengan chain ini');
  return build(ch, key, address, await ADAPTERS[ch.p](ch, address));
}

function listChains() {
  return Object.entries(CHAINS).map(([key, c]) => ({ key, name: c.name, g: c.g, off: c.p === 'none' }));
}

// ── Nama alamat (ENS / tag publik / nama kontrak verified) ──
const guessType = (s) => {
  if (/tornado|mixer/i.test(s)) return 'mixer';
  if (/bridge|wormhole|layerzero|stargate|across|synapse/i.test(s)) return 'bridge';
  if (/router|swap|uniswap|sushi|pancake|1inch|curve|balancer|aggregator|exchange proxy|cowswap|paraswap|kyber|dex/i.test(s)) return 'dex';
  return undefined;
};

async function labelOne(ch, addr) {
  let failed = false;
  const base = ch.lbl || (ch.p === 'bs' ? ch.api : null);
  if (base) {
    try {
      const d = await jget(`${base}/api/v2/addresses/${addr}`, 6000);
      const tag = d.metadata?.tags?.[0]?.name || d.public_tags?.[0]?.display_name || d.public_tags?.[0]?.label || null;
      const ens = d.ens_domain_name || null, contract = d.name || null;
      const label = ens && tag ? `${ens} (${tag})` : (tag || ens || contract);
      if (label) return { label, type: guessType(`${tag || ''} ${contract || ''} ${ens || ''}`) };
    } catch (e) { if (!/404/.test(e.message)) failed = true; }
  }
  if (ch.p === 'es' && ch.id && !ch.api && process.env.ETHERSCAN_API_KEY) {
    try {
      const d = await jget(`${ES}?chainid=${ch.id}&module=contract&action=getsourcecode&address=${addr}&apikey=${process.env.ETHERSCAN_API_KEY}`, 6000);
      if (d.message === 'NOTOK') failed = true;
      const name = Array.isArray(d.result) ? d.result[0]?.ContractName : '';
      if (name) return { label: name, type: guessType(name) };
    } catch { failed = true; }
  }
  return failed ? null : { none: true };   // null = gagal sementara, jangan di-cache
}

async function labels(key, addrs, cache) {
  const ch = CHAINS[key];
    if (!ch || ch.p === 'none' || ch.p === 'sol' || ch.p === 'btc') return {};
  const todo = [...new Set(addrs.map(a => String(a).trim().toLowerCase()).filter(a => EVM_RE.test(a)))].slice(0, 20);
  const out = {};
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < todo.length) {
      const a = todo[i++], ck = `onchain:label:${key}:${a}`;
      let v = await cache.get(ck).catch(() => null);
      if (!v) {
        v = KNOWN[a] ? { label: KNOWN[a].label, type: KNOWN[a].type } : await labelOne(ch, a);
        if (v) await cache.set(ck, v).catch(() => {});
      }
      if (v && !v.none) out[a] = v;
    }
  }));
  return out;
}

// Tes semua chain pakai dead address, buat tau mana yang gagal / paid-only
async function pingAll() {
  const out = {};
    const keys = Object.keys(CHAINS).filter(k => !['sol', 'none', 'btc'].includes(CHAINS[k].p));
  for (let i = 0; i < keys.length; i += 3) {
    await Promise.all(keys.slice(i, i + 3).map(async k => {
      try { const d = await lookup(k, '0x000000000000000000000000000000000000dEaD'); out[k] = `ok (${d.edges.length} edges)`; }
      catch (e) { out[k] = 'GAGAL: ' + e.message; }
    }));
    await new Promise(r => setTimeout(r, 400)); // jaga limit 3 req/detik Etherscan
  }
  return out;
}

module.exports = { lookup, labels, listChains, pingAll };
