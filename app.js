let chart, priceSeries, smaSeries = {};
let allData = null;
let compareData = null;
let compareSeries = null;
let currentRange = '20Y';
let currentScale = 'log';

const SMA_COLORS = { 50: '#f59e0b', 100: '#10b981', 200: '#ef4444', 250: '#8b5cf6', 300: '#06b6d4' };

async function init() {
  const manifest = await fetch('data/manifest.json').then(r => r.json());

  const sel = document.getElementById('ticker-select');
  const cmp = document.getElementById('compare-select');

  manifest.tickers.forEach(t => {
    const o = document.createElement('option');
    o.value = t.file;
    o.textContent = t.label;
    sel.appendChild(o);
    const o2 = o.cloneNode(true);
    cmp.appendChild(o2);
  });

  buildChart();

  sel.addEventListener('change', e => loadTicker(e.target.value));
  cmp.addEventListener('change', e => loadCompare(e.target.value));

  document.querySelectorAll('[data-range]').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      render();
    })
  );

  document.querySelectorAll('[data-sma]').forEach(cb =>
    cb.addEventListener('change', render)
  );

  document.querySelectorAll('[data-scale]').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-scale]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScale = btn.dataset.scale;
      render();
    })
  );

  if (manifest.tickers.length) loadTicker(manifest.tickers[0].file);
}

function buildChart() {
  const el = document.getElementById('chart');
  chart = LightweightCharts.createChart(el, {
    autoSize: true,
    layout: { background: { color: '#fff' }, textColor: '#374151' },
    grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
    rightPriceScale: {
      mode: LightweightCharts.PriceScaleMode.Logarithmic,
      borderColor: '#e5e7eb',
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: { borderColor: '#e5e7eb', minBarSpacing: 0.1 },
  });

  priceSeries = chart.addAreaSeries({
    lineColor: '#2563eb',
    topColor: 'rgba(37,99,235,0.1)',
    bottomColor: 'rgba(37,99,235,0)',
    lineWidth: 2,
    priceLineVisible: false,
  });
}

async function loadTicker(file) {
  setStatus('Loading…');
  try {
    const res = await fetch(`data/${file}.json`);
    if (!res.ok) throw new Error();
    allData = await res.json();
    setStatus('');
    render();
  } catch {
    setStatus('No data yet — trigger the GitHub Action first (see setup instructions).');
  }
}

async function loadCompare(file) {
  if (!file) { compareData = null; render(); return; }
  try {
    const res = await fetch(`data/${file}.json`);
    if (!res.ok) throw new Error();
    compareData = await res.json();
  } catch {
    compareData = null;
  }
  render();
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

function sliceByRange(dates, values, range) {
  if (range === 'MAX') return { dates, values };
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - parseInt(range));
  const cutStr = cutoff.toISOString().slice(0, 10);
  const i = dates.findIndex(d => d >= cutStr);
  return i === -1 ? { dates, values } : { dates: dates.slice(i), values: values.slice(i) };
}

function calcSMA(closes, period) {
  const out = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0, ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (closes[j] == null) { ok = false; break; }
      sum += closes[j];
    }
    if (ok) out[i] = sum / period;
  }
  return out;
}

function toPoints(dates, values) {
  return dates
    .map((d, i) => ({ time: d, value: values[i] }))
    .filter(p => p.value != null && isFinite(p.value));
}

function updatePctLabel(closes, dates) {
  const first = closes.find(c => c != null);
  const last = [...closes].reverse().find(c => c != null);
  if (first == null || last == null) return;
  const pct = (last / first - 1) * 100;
  const years = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
  const sign = pct >= 0 ? '+' : '';
  const el = document.getElementById('pct-label');
  el.textContent = `${sign}${pct.toFixed(1)}%   ${sign}${cagr.toFixed(1)}% p.a.`;
  el.style.color = pct >= 0 ? '#16a34a' : '#dc2626';
}

function display(values, base) {
  if (currentScale === 'pct') return values.map(v => v != null ? (v / base - 1) * 100 : null);
  if (compareData) return values.map(v => v != null ? (v / base) * 100 : null);
  return values;
}

function render() {
  if (!allData) return;

  const { dates, values: closes } = sliceByRange(allData.dates, allData.closes, currentRange);
  const base = closes.find(c => c != null);

  chart.applyOptions({
    rightPriceScale: {
      mode: currentScale === 'log'
        ? LightweightCharts.PriceScaleMode.Logarithmic
        : LightweightCharts.PriceScaleMode.Normal,
    },
  });

  priceSeries.setData(toPoints(dates, display(closes, base)));
  updatePctLabel(closes, dates);

  if (compareSeries) { chart.removeSeries(compareSeries); compareSeries = null; }

  if (compareData) {
    const { dates: cd, values: cc } = sliceByRange(compareData.dates, compareData.closes, currentRange);
    const cbase = cc.find(c => c != null);
    compareSeries = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    compareSeries.setData(toPoints(cd, display(cc, cbase)));
  }

  Object.values(smaSeries).forEach(s => chart.removeSeries(s));
  smaSeries = {};

  document.querySelectorAll('[data-sma]:checked').forEach(cb => {
    const period = parseInt(cb.dataset.sma);
    const fullSMA = calcSMA(allData.closes, period);
    const { values: smaSlice } = sliceByRange(allData.dates, fullSMA, currentRange);
    const s = chart.addLineSeries({
      color: SMA_COLORS[period] ?? '#9ca3af',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    s.setData(toPoints(dates, display(smaSlice, base)));
    smaSeries[period] = s;
  });

  chart.timeScale().setVisibleRange({ from: dates[0], to: dates[dates.length - 1] });
}

init();
