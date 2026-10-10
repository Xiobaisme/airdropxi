// ─── CALCULATOR ───
        const CALC_KEYS = ['C', '←', '%', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='];
        let _calcExpr = '';

        function buildCalcGrid() {
            const grid = document.getElementById('calc-grid');
            if (!grid) return;
            grid.innerHTML = CALC_KEYS.map(k => {
                const isOp = '/*-+='.includes(k);
                const isZero = k === '0';
                return `<button class="calc-key ${isOp?'op':''} ${isZero?'zero':''}" onclick="calcPress('${k==='←'?'back':k}')">${k}</button>`;
            }).join('');
        }

        function calcPress(key) {
            const disp = document.getElementById('calc-display');
            if (!disp) return;
            if (key === 'C') { _calcExpr = '';
                disp.value = '0'; return; }
            if (key === 'back') { _calcExpr = _calcExpr.slice(0, -1);
                disp.value = _calcExpr || '0'; return; }
            if (key === '=') {
                try {
                    if (!/^[0-9+\-*/.%\s]+$/.test(_calcExpr)) throw new Error();
                    const result = Function(`"use strict"; return (${_calcExpr})`)();
                    disp.value = String(result);
                    _calcExpr = String(result);
                } catch (e) { disp.value = 'Error';
                    _calcExpr = ''; }
                return;
            }
            _calcExpr += key;
            disp.value = _calcExpr;
        }

        function toggleCalc() {
            const panel = document.getElementById('calc-panel');
            if (!panel) return;
            panel.classList.toggle('hidden');
        }
