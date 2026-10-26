// ─── PNL CALCULATOR ───
const PNL_FEE = { taker: 0.05, maker: 0.02 }; // % per sisi (default Binance Futures VIP0, ubah kalau beda)
const PNL_MMR = 0.005;                        // estimasi maintenance margin 0.5% (buat liq price)
let _pnlPrices = {};                          // { BTC: 80207.83, ETH: ... }
let _pnlTimer = null;
let _pnlListed = false;

const pnlEl = id => document.getElementById(id);
const pnlNum = id => {
    const v = parseFloat(String(pnlEl(id).value).replace(/,/g, ''));
    return isFinite(v) ? v : 0;
};
const pnlCoin = () => pnlEl('pnl-coin').value.trim().toUpperCase().replace(/USDT$/, '');
const pnlMoney = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// no-op supaya kalau masih ada pemanggilan buildCalcGrid() di kode lain tidak error (boleh dihapus)
function buildCalcGrid() {}

// ambil semua harga futures USDT sekali panggil (Binance Futures, sumber sama dengan chart BTCUSDT.P)
async function pnlLoadPrices() {
    try {
        const r = await fetch('https://fapi.binance.com/fapi/v1/ticker/price');
        const j = await r.json();
        const map = {};
        j.forEach(t => { if (t.symbol.endsWith('USDT')) map[t.symbol.slice(0, -4)] = parseFloat(t.price); });
        _pnlPrices = map;
        return true;
    } catch (e) { return false; }
}

async function pnlRefresh() {
    const live = pnlEl('pnl-live');
    const ok = await pnlLoadPrices();
    if (!ok) { live.textContent = 'offline'; return; }
    if (!_pnlListed) {
        pnlEl('pnl-coins').innerHTML = Object.keys(_pnlPrices).sort().map(c => `<option value="${c}">`).join('');
        _pnlListed = true;
    }
    const p = _pnlPrices[pnlCoin()];
    live.textContent = p ? 'Live $' + p : 'coin tidak ada';
    // isi otomatis buy & sell hanya kalau masih kosong (pertama kali buka)
    if (p && !pnlEl('pnl-buy').value && !pnlEl('pnl-sell').value) {
        pnlEl('pnl-buy').value = p;
        pnlEl('pnl-sell').value = p;
    }
    pnlCalc();
}

// dipanggil saat ketik/pilih coin: kalau coin valid, buy & sell di-reset ke harga live
function pnlCoinInput() {
    const p = _pnlPrices[pnlCoin()];
    if (p) {
        pnlEl('pnl-buy').value = p;
        pnlEl('pnl-sell').value = p;
        pnlEl('pnl-live').textContent = 'Live $' + p;
    }
    pnlCalc();
}

// tombol "Live" di samping Buy/Sell price
function pnlUseLive(id) {
    const p = _pnlPrices[pnlCoin()];
    if (p) { pnlEl(id).value = p; pnlCalc(); }
}

function pnlFeeMode() {
    const manual = pnlEl('pnl-feemode').value === 'manual';
    pnlEl('pnl-feein').disabled = !manual;
    pnlEl('pnl-feeout').disabled = !manual;
    pnlCalc();
}

function pnlCalc() {
    const margin = pnlNum('pnl-margin');
    const lev = Math.max(1, pnlNum('pnl-lev') || 1);
    const buy = pnlNum('pnl-buy');
    const sell = pnlNum('pnl-sell');
    const other = pnlNum('pnl-other');                       // funding / biaya lain ($)
    const dir = pnlEl('pnl-dir').value === 'short' ? -1 : 1;
    const mode = pnlEl('pnl-feemode').value;                 // taker | maker | manual

    const size = margin * lev;                               // position size
    const qty = buy > 0 ? size / buy : 0;

    let feeIn, feeOut;
    if (mode === 'manual') {
        feeIn = pnlNum('pnl-feein');
        feeOut = pnlNum('pnl-feeout');
    } else {
        const rate = PNL_FEE[mode] / 100;
        feeIn = size * rate;
        feeOut = qty * sell * rate;
        pnlEl('pnl-feein').value = feeIn ? +feeIn.toFixed(4) : '';
        pnlEl('pnl-feeout').value = feeOut ? +feeOut.toFixed(4) : '';
    }

    const gross = qty * (sell - buy) * dir;
    const liq = buy > 0 ? (dir === 1 ? buy * (1 - 1 / lev + PNL_MMR) : buy * (1 + 1 / lev - PNL_MMR)) : 0;
    const hitLiq = margin > 0 && buy > 0 && (dir === 1 ? sell <= liq : sell >= liq);

    const totalIn = margin + feeIn + other;
    let totalOut = hitLiq ? 0 : Math.max(0, margin + gross - feeOut);
    const net = margin > 0 ? totalOut - totalIn : 0;
    const roe = margin > 0 ? (net / margin) * 100 : 0;

    const res = pnlEl('pnl-res');
    res.textContent = (net > 0 ? '+' : '') + pnlMoney(net);
    res.className = 'pnl-big ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '');
    pnlEl('pnl-roe').textContent = (roe > 0 ? '+' : '') + roe.toFixed(2) + '%';
    pnlEl('pnl-roe').className = 'pnl-roe ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '');
    pnlEl('pnl-totin').textContent = pnlMoney(margin > 0 ? totalIn : 0);
    pnlEl('pnl-totout').textContent = pnlMoney(margin > 0 ? totalOut : 0);
    pnlEl('pnl-size').textContent = pnlMoney(size);
    pnlEl('pnl-totfee').textContent = pnlMoney(feeIn + feeOut + other);
    pnlEl('pnl-liq').textContent = liq > 0 ? '$' + liq.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '-';
    pnlEl('pnl-warn').style.display = hitLiq ? 'block' : 'none';
}

function toggleCalc() {
    const panel = document.getElementById('calc-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) {
        clearInterval(_pnlTimer);
        _pnlTimer = null;
    } else {
        pnlRefresh();
        _pnlTimer = setInterval(pnlRefresh, 5000); // update harga live tiap 5 detik selama popup terbuka
    }
}