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
  return Object.entries(CHAINS).map(([key, c]) => ({
    key, name: c.name, g: c.g, sym: c.sym, off: c.p === 'none',
    live: ['es', 'bs', 'nr', 'sol', 'btc'].includes(c.p),
  }));
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

// ═══════════════ LIVE TRANSFERS ═══════════════
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const TRANSFER_T = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const BT = { ethereum: 12, bnb: 0.5, arbitrum: 0.25, avalanche: 2, base: 2, op: 2, polygon: 2 }; // detik/block, default 2

// Stablecoin per chain: [simbol, alamat kontrak, desimal]. Ditulis dari ingatan, cocokkan di explorer dulu.
// Chain yang tidak ada di sini cuma dipantau transfer native-nya.
const STABLES = {
  ethereum:  [['USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 6], ['USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6]],
  bnb:       [['USDT', '0x55d398326f99059ff775485246999027b3197955', 18], ['USDC', '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 18]],
  arbitrum:  [['USDT', '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 6], ['USDC', '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 6]],
  base:      [['USDC', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 6]],
  op:        [['USDT', '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', 6], ['USDC', '0x0b2c639c533813f4aa9d7837caf62653d097ff85', 6]],
  polygon:   [['USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 6], ['USDC', '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 6]],
  avalanche: [['USDT', '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', 6], ['USDC', '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', 6]],
};

// Solana: wallet yang dipantau (isi sendiri, cek dulu di Solscan)
const WATCH = { solana: [
  ['5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'Binance'],
  ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'Binance 2'],
] };
const SOL_MINTS = { EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC', Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT' };

// Kalau slug salah, chain itu cuma jalan native + stablecoin (tidak error).
const LLAMA = {
  ethereum: 'ethereum', bnb: 'bsc', avalanche: 'avax', sonic: 'sonic', sei: 'sei',   // sei ?
  cronos: 'cronos', gnosis: 'xdai', celo: 'celo', kaia: 'klaytn',                     // kaia ?
  arbitrum: 'arbitrum', base: 'base', op: 'optimism', polygon: 'polygon', zksync: 'era',
  linea: 'linea', scroll: 'scroll', mantle: 'mantle', unichain: 'unichain', ink: 'ink', // unichain, ink ?
  zora: 'zora', worldchain: 'wc', soneium: 'soneium', taiko: 'taiko', blast: 'blast',   // worldchain, soneium ?
  zircuit: 'zircuit', manta: 'manta', mode: 'mode', metis: 'metis', fraxtal: 'fraxtal', // zircuit ?
  solana: 'solana',
  // robinhood: belum ada
};
 
// Berapa block terakhir yang discan per siklus (semua log Transfer, jadi berat).
// Makin sibuk chain-nya makin kecil. Angka ini kena min(need, ...) dari gap.
const LOG_BLOCKS = { default: 15, ethereum: 5, bnb: 20, arbitrum: 12, polygon: 10, avalanche: 10, base: 12 };
const MAX_LOOKUP = 120;                       // maks token baru yang dicek harga per siklus
const TOK = new Map();                        // cache harga token (di memori server)
const TOK_OK = 10 * 60e3, TOK_NO = 30 * 60e3; // priced 10 mnt, tanpa harga 30 mnt
 
async function priceTokens(key, addrs) {
  const slug = LLAMA[key], isSol = key === 'solana';
  const norm = (a) => (isSol ? String(a) : String(a).toLowerCase());
  const out = {}, todo = [], now = Date.now();
  if (TOK.size > 20000) TOK.clear();
  for (const a of addrs) {
    const hit = TOK.get(key + ':' + a);
    if (hit && now - hit.t < (hit.none ? TOK_NO : TOK_OK)) { if (!hit.none) out[a] = hit; continue; }
    todo.push(a);
  }
  if (!slug || !todo.length) return out;
 
  const batches = [];
  const list = todo.slice(0, MAX_LOOKUP);
  for (let i = 0; i < list.length; i += 40) batches.push(list.slice(i, i + 40));
  await Promise.all(batches.map(async (b) => {
    try {
      const d = await jget(`https://coins.llama.fi/prices/current/${b.map(a => `${slug}:${a}`).join(',')}`, 9000);
      const got = {};
      for (const [k, v] of Object.entries(d.coins || {})) got[norm(k.slice(k.indexOf(':') + 1))] = v;
      for (const a of b) {
        const v = got[norm(a)];
        const ok = v && v.price > 0 && (isSol || v.decimals != null);
        const e = ok ? { sym: String(v.symbol || '?').slice(0, 12), dec: Number(v.decimals ?? 0), price: v.price, t: now } : { none: true, t: now };
        TOK.set(key + ':' + a, e);
        if (ok) out[a] = e;
      }
    } catch { /* gagal sementara: jangan di-cache, coba lagi siklus berikutnya */ }
  }));
  return out;
}
 
// Ambil semua log Transfer dalam rentang block, tanpa filter address
async function scanLogs(r, isEs, from, to) {
  if (isEs) {                                  // Etherscan/Routescan: paginasi 1000/halaman, maks 4 halaman
    const all = [];
    for (let p = 1; p <= 4; p++) {
      await sleep(340);
      const part = await r.logs(from, to, undefined, p);
      all.push(...part);
      if (part.length < 1000) break;
    }
    return all;
  }
  const rng = [];                              // Blockscout / NodeReal: pecah per 5 block biar gak kena limit
  for (let s = from; s <= to; s += 5) rng.push([s, Math.min(s + 4, to)]);
  const res = await Promise.allSettled(rng.map(([a, b]) => r.logs(a, b)));
  const logs = []; let err;
  res.forEach(x => (x.status === 'fulfilled' ? logs.push(...x.value) : (err = err || x.reason.message)));
  if (!logs.length && err) throw new Error(err);
  return logs;
}

// ── transport JSON-RPC (NodeReal & Blockscout) ──
function jrpcOf(url) {
  const call = async (method, params) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 10000);
    try {
      const r = await fetch(url, { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      if (!r.ok) throw new Error('Provider HTTP ' + r.status);
      const d = await r.json();
      if (d.error) throw new Error(String(d.error.message || 'RPC error').slice(0, 120));
      return d.result;
    } finally { clearTimeout(t); }
  };
  const h = (n) => '0x' + n.toString(16);
  return {
    head: async () => hexNum(await call('eth_blockNumber', [])),
    block: (n) => call('eth_getBlockByNumber', [h(n), true]),
    logs: (f, t, a) => call('eth_getLogs', [{ fromBlock: h(f), toBlock: h(t), address: a, topics: [TRANSFER_T] }]),
  };
}

function rpcOf(ch) {
  if (ch.p === 'nr') {
    const key = process.env.NODEREAL_API_KEY;
    if (!key) throw new Error('NODEREAL_API_KEY belum di-set');
    return jrpcOf(`https://bsc-mainnet.nodereal.io/v1/${key}`);
  }
  if (ch.p === 'bs') return jrpcOf(`${ch.api}/api/eth-rpc`);
  // Etherscan V2 / Routescan: modul proxy + logs
  const custom = !!ch.api;
  const call = async (params, n = 0) => {
    const u = `${ch.api || ES}?${custom ? '' : `chainid=${ch.id}&apikey=${process.env.ETHERSCAN_API_KEY || ''}&`}${new URLSearchParams(params)}`;
    const d = await jget(u);
    const msg = d.error?.message || (d.message === 'NOTOK' ? String(d.result) : '');
    if (msg) {
      if (/rate limit/i.test(msg) && n < 2) { await sleep(1100); return call(params, n + 1); }
      throw new Error(msg.slice(0, 120));
    }
    return d;
  };
  return {
    head: async () => hexNum((await call({ module: 'proxy', action: 'eth_blockNumber' })).result),
    block: async (n) => (await call({ module: 'proxy', action: 'eth_getBlockByNumber', tag: '0x' + n.toString(16), boolean: 'true' })).result,
    logs: async (f, t, a, page = 1) => {
      const p = { module: 'logs', action: 'getLogs', fromBlock: f, toBlock: t, topic0: TRANSFER_T, page, offset: 1000 };
      if (a) p.address = a;
      const d = await call(p);
      return Array.isArray(d.result) ? d.result : [];
    },
  };
}
// ── EVM (es / bs / nr) ──
async function liveEvm(key, ch, o) {
  const r = rpcOf(ch), isEs = ch.p === 'es';
  const head = await r.head();
  const need = Math.ceil(o.gap / (BT[key] || 2));
  const items = [], tsOf = {}, errs = [];
 
  // native: scan maksimal 5 block terakhir (butuh harga koin dari client)
  if (o.price > 0) {
    const minN = o.min / o.price, nums = [];
    for (let n = head - Math.min(need, 5) + 1; n <= head; n++) nums.push(n);
    let blocks;
    if (isEs) { blocks = []; for (const n of nums) { blocks.push(await r.block(n).catch(e => { errs.push(e.message); return null; })); await sleep(340); } }
    else blocks = await Promise.all(nums.map(n => r.block(n).catch(e => { errs.push(e.message); return null; })));
    for (const b of blocks) {
      if (!b || !b.transactions) continue;
      const ts = hexNum(b.timestamp) * 1000; tsOf[hexNum(b.number)] = ts;
      for (const t of b.transactions) {
        if (!t.to || !t.value || t.value === '0x0') continue;
        const amount = Number(BigInt(t.value)) / 1e18;
        if (amount < minN) continue;
        items.push({ id: t.hash, hash: t.hash, ts, chain: key, from: t.from.toLowerCase(), to: t.to.toLowerCase(),
          amount, sym: ch.sym, usd: amount * o.price, url: ch.ex + '/tx/' + t.hash });
      }
    }
  }
 
  // token: SEMUA ERC-20, harga dari DefiLlama (stablecoin di STABLES dianggap $1 tanpa lookup)
  const stab = {};
  (STABLES[key] || []).forEach(([sym, a, dec]) => { stab[a] = { sym, dec, price: 1 }; });
  const span = Math.min(need, LOG_BLOCKS[key] || LOG_BLOCKS.default);
  let logs = [];
  try { logs = await scanLogs(r, isEs, head - span + 1, head); } catch (e) { errs.push(e.message); }
 
  const cand = [], maxRaw = new Map();
  for (const l of logs) {
    if (!l.topics || l.topics.length !== 3 || !l.data || l.data === '0x') continue;   // 3 topic = ERC-20 (NFT = 4)
    let v; try { v = BigInt(l.data); } catch { continue; }
    if (v === 0n) continue;
    const tk = String(l.address || '').toLowerCase();
    if (!tk) continue;
    cand.push({ l, tk, v });
    if (!stab[tk] && (!maxRaw.has(tk) || v > maxRaw.get(tk))) maxRaw.set(tk, v);
  }
  // token baru dicek harga mulai dari yang nominal mentahnya paling besar
  const unk = [...maxRaw].sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)).map(x => x[0]);
  const px = { ...stab, ...(await priceTokens(key, unk).catch(() => ({}))) };
 
  for (const { l, tk, v } of cand) {
    const t = px[tk];
    if (!t) continue;                                   // gak ada harga = skip (spam/scam token)
    const amount = Number(v) / 10 ** t.dec, usd = amount * t.price;
    if (!(usd >= o.min) || usd > 5e10) continue;        // buang di bawah threshold & harga ngaco
    const ts = tsOf[hexNum(l.blockNumber)] || (l.timeStamp ? hexNum(l.timeStamp) * 1000 : Date.now());
    items.push({ id: l.transactionHash + ':' + hexNum(l.logIndex), hash: l.transactionHash, ts, chain: key,
      from: '0x' + l.topics[1].slice(26), to: '0x' + l.topics[2].slice(26), amount, sym: t.sym, usd, token: tk,
      url: ch.ex + '/tx/' + l.transactionHash });
  }
  if (!items.length && errs.length) throw new Error(errs[0]);
  return { items };
}

// ── Solana: pantau wallet di WATCH via Helius ──
async function liveSol(key, ch, o) {
  const k = process.env.HELIUS_API_KEY;
  if (!k) throw new Error('HELIUS_API_KEY belum di-set');
  const watch = WATCH[key] || [], labels = {};
  watch.forEach(([a, l]) => { labels[a] = { label: l, type: 'cex' }; });
  const res = await Promise.allSettled(watch.map(([a]) =>
    jget(`https://api.helius.xyz/v0/addresses/${a}/transactions?api-key=${k}&limit=20`, 12000)));
  const items = [], seen = new Set(), toks = []; let err;
  const add = (it) => { if (!seen.has(it.id)) { seen.add(it.id); items.push(it); } };
  res.forEach(r => {
    if (r.status !== 'fulfilled') { err = err || r.reason.message; return; }
    for (const t of Array.isArray(r.value) ? r.value : []) {
      const ts = (t.timestamp || 0) * 1000, base = { hash: t.signature, ts, chain: key, url: ch.ex + '/tx/' + t.signature };
      (t.nativeTransfers || []).forEach((n, i) => {
        const amount = n.amount / 1e9;
        if (o.price > 0 && amount * o.price >= o.min) add({ ...base, id: `${t.signature}:n${i}`, from: n.fromUserAccount, to: n.toUserAccount, amount, sym: 'SOL', usd: amount * o.price });
      });
      (t.tokenTransfers || []).forEach((n, i) => { if (n.mint) toks.push({ base, sig: t.signature, n, i }); });
    }
  });
 
  // semua token SPL: harga dari DefiLlama (USDC/USDT di SOL_MINTS langsung $1)
  const mints = [...new Set(toks.map(x => x.n.mint))].filter(m => !SOL_MINTS[m]).slice(0, MAX_LOOKUP);
  const px = mints.length ? await priceTokens('solana', mints).catch(() => ({})) : {};
  for (const { base, sig, n, i } of toks) {
    const amount = Number(n.tokenAmount) || 0;
    const p = SOL_MINTS[n.mint] ? { sym: SOL_MINTS[n.mint], price: 1 } : px[n.mint];
    if (!p) continue;
    const usd = amount * p.price;
    if (usd >= o.min && usd < 5e10) add({ ...base, id: `${sig}:t${i}`, from: n.fromUserAccount, to: n.toUserAccount, amount, sym: p.sym, usd, token: n.mint });
  }
  if (!items.length && err) throw new Error(err);
  return { items, labels };
}
// ── Bitcoin: Blockchair cari tx besar, mempool.space ambil alamat ──
const btcCache = new Map();
async function liveBtc(key, ch, o) {
  if (!(o.price > 0)) return { items: [] };
  const minSat = Math.floor((o.min / o.price) * 1e8);
  const ck = String(Math.round(minSat / 1e7));
  const hit = btcCache.get(ck);
  if (hit && Date.now() - hit.t < 90000) return { items: hit.items };

  const list = await jget(`https://api.blockchair.com/bitcoin/transactions?q=output_total(${minSat}..)&s=time(desc)&limit=8`, 12000);
  const items = [];
  for (const r of (list.data || []).slice(0, 6)) {
    const t = await jget(`https://mempool.space/api/tx/${r.hash}`).catch(() => null);
    if (!t || t.vin?.[0]?.is_coinbase) continue;
    const ins = (t.vin || []).filter(v => v.prevout?.scriptpubkey_address);
    const inSet = new Set(ins.map(v => v.prevout.scriptpubkey_address));
    const all = (t.vout || []).filter(x => x.scriptpubkey_address);
    const outs = all.filter(x => !inSet.has(x.scriptpubkey_address));   // buang change ke diri sendiri
    const use = outs.length ? outs : all;
    const moved = use.reduce((s, x) => s + x.value, 0);
    if (!moved || !ins.length) continue;
    const from = ins.reduce((a, b) => (b.prevout.value > a.prevout.value ? b : a)).prevout.scriptpubkey_address;
    const to = use.reduce((a, b) => (b.value > a.value ? b : a)).scriptpubkey_address;
    items.push({ id: r.hash, hash: r.hash, ts: Date.parse(String(r.time).replace(' ', 'T') + 'Z') || Date.now(),
      chain: key, from, to, amount: moved / 1e8, sym: 'BTC', url: ch.ex + '/tx/' + r.hash });
  }
  btcCache.set(ck, { t: Date.now(), items });
  return { items };
}

async function live(key, o) {
  const ch = CHAINS[key];
  if (!ch || ch.p === 'none') throw new Error('Chain tidak didukung live feed');
  const out = ch.p === 'sol' ? await liveSol(key, ch, o) : ch.p === 'btc' ? await liveBtc(key, ch, o) : await liveEvm(key, ch, o);
  const labels = { ...(out.labels || {}) };
  out.items.forEach(it => [it.from, it.to].forEach(a => { if (KNOWN[a]) labels[a] = KNOWN[a]; }));
  return { chain: key, items: out.items.sort((a, b) => b.ts - a.ts), labels };
}

module.exports = { lookup, labels, listChains, pingAll, live };
