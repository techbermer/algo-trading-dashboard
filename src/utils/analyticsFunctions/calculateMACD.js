import { MACD } from "technicalindicators";

export const calculateMACD = (data) => {
  const closePrices = data.map((candle) => candle.close);
  const macdInput = {
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  };
  const macd = MACD.calculate(macdInput);

  return macd.map((value, index) => {
    const histogram = value.MACD - value.signal;
    const prevHistogram =
      index > 0 ? macd[index - 1].MACD - macd[index - 1].signal : 0;

    let color;
    if (histogram >= 0) {
      color = histogram > prevHistogram ? "#41A69A" : "#B7DFDB";
    } else {
      color = histogram > prevHistogram ? "#FBCDD2" : "#F5504E";
    }

    return {
      time: data[index + 25].time,
      value: histogram,
      color: color,
    };
  });
};

export const updateMACD = ({
  updatedCandle,
  candlestickSeries,
  macdSeries,
}) => {
  const currentData = candlestickSeries.current.data();

  const updatedData = [...currentData, updatedCandle];

  const closePrices = updatedData.map((candle) => candle.close);

  const macdInput = {
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  };

  const macdResult = MACD.calculate(macdInput);
  const latestMACD = macdResult[macdResult.length - 1];

  if (latestMACD) {
    const macdHistogram = {
      time: updatedCandle.time,
      value: latestMACD.MACD - latestMACD.signal,
      color: latestMACD.MACD >= latestMACD.signal ? "#26a69a" : "#ef5350",
    };

    macdSeries.current.update(macdHistogram);
  }
};
