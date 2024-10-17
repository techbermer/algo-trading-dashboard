const createCustomMinuteCandle = (candles) => {
  if (candles.length === 0) return null;

  return {
    time: candles[0].time,
    open: candles[0].open,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
    close: candles[candles.length - 1].close,
    volume: candles.reduce((sum, c) => sum + c.volume, 0),
  };
};

export const createCustomMinuteCandles = (data, selectedInterval) => {
  const result = [];

  for (let i = 0; i < data.length; i += selectedInterval) {
    if (i + (selectedInterval - 1) < data.length) {
      const customMinuteCandle = createCustomMinuteCandle(
        data.slice(i, i + selectedInterval)
      );
      result.push(customMinuteCandle);
    }
  }

  return result;
};
