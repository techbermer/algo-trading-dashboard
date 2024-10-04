import { RSI } from "technicalindicators";

export const calculateRSI = (data) => {
  const closePrices = data.map((candle) => candle.close);
  const rsiPeriod = 14;
  const rsiValues = RSI.calculate({
    values: closePrices,
    period: rsiPeriod,
  });

  return rsiValues.map((value, index) => ({
    time: data[index + rsiPeriod - 1].time,
    value: value,
  }));
};

export const updateRSI = ({ updatedCandle, candlestickSeries, rsiSeries }) => {
  const currentData = candlestickSeries.current.data();
  const updatedData = [...currentData, updatedCandle];
  const closePrices = updatedData.map((candle) => candle.close);

  const rsiPeriod = 14;
  const rsiValues = RSI.calculate({
    values: closePrices,
    period: rsiPeriod,
  });

  const latestRSI = rsiValues[rsiValues.length - 1];

  if (latestRSI) {
    rsiSeries.current.update({
      time: updatedCandle.time,
      value: latestRSI,
    });
  }
};
