import { CandlestickView } from './ui/candlestickView';
import { MINUTE_MS, type Candle } from './core/types';

function syntheticCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 30000;
  const start = Date.now() - n * MINUTE_MS;
  for (let i = 0; i < n; i++) {
    const open = price;
    const drift = (Math.random() - 0.5) * 40;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    out.push({
      timestamp: start + i * MINUTE_MS,
      open,
      high,
      low,
      close,
      volume: Math.random() * 10,
      sourceSymbol: 'DEMO',
      sourceName: 'Synthetic',
    });
    price = close;
  }
  return out;
}

const app = document.getElementById('app')!;
app.style.height = '100vh';
app.style.margin = '0';
const view = new CandlestickView(app);
view.setCandles(syntheticCandles(200));
