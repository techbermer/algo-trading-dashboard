import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createChart, CrosshairMode } from "lightweight-charts";
import BackArrow from "../assets/icons/BackArrow.png";
import { MARKET_OPTIONS } from "../constants/markets";
import {
  CANDLESTICK_SERIES_CONFIG,
  MACD_SERIES_CONFIG,
  RSI_SERIES_CONFIG,
  SUPERTREND_UPPERBAND_CONFIG,
  SUPERTREND_LOWERBAND_CONFIG,
} from "../constants/chartConfigs";
import { commonChartOptions } from "../constants/commonChartOptions";
import { CurrentCandleData } from "../components/CurrentCandleData";
import { getCandleRemainingTime } from "../utils/helpers/getCandleRemainingTime";
import { getUrl } from "../utils/webSocket/webSocketUrl";
import {
  calculateRSI,
  updateRSI,
} from "../utils/analyticsFunctions/calculateRSI";
import {
  calculateMACD,
  updateMACD,
} from "../utils/analyticsFunctions/calculateMACD";
import {
  decodeProfobuf,
  blobToArrayBuffer,
} from "../utils/protoBufferProcessor/protoBufferProcessors";
import "../stylings/Market.css";
import proto from "../../src/prot/MarketDataFeed.proto";
import { Buffer } from "buffer";
const protobuf = require("protobufjs");

let protobufRoot = null;
const initProtobuf = async () => {
  protobufRoot = await protobuf.load(proto);
};

const Market = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = location.state || {};
  const websocket = useRef(null);
  const resizeObserver = useRef(null);

  const macdChart = useRef(null);
  const macdSeries = useRef(null);
  const macdResizeObserver = useRef(null);
  const macdChartContainerRef = useRef(null);

  const candlestickChart = useRef(null);
  const candlestickSeries = useRef(null);
  const candlestickResizeObserver = useRef(null);
  const candlestickChartContainerRef = useRef(null);

  const upperBandSeries = useRef(null);
  const lowerBandSeries = useRef(null);

  const rsiChart = useRef(null);
  const rsiSeries = useRef(null);
  const rsiResizeObserver = useRef(null);
  const rsiChartContainerRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [shouldReload, setShouldReload] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const [currentCandle, setCurrentCandle] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState("Markets");
  const [current3MinCandle, setCurrent3MinCandle] = useState(null);
  const [lastProcessedMinute, setLastProcessedMinute] = useState(null);
  const [instrumentKey, setInstrumentKey] = useState(
    location.state.instrumentKey
  );

  const interval = "1minute";
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  useEffect(() => {
    initProtobuf();
  }, []);

  useEffect(() => {
    const clearInterval = getCandleRemainingTime(setRemainingTime);

    return clearInterval;
  }, []);

  const calculateATR = (data, period = 10) => {
    const trueRanges = [];
    const atrs = [];

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        trueRanges.push(data[i].high - data[i].low);
      } else {
        const tr = Math.max(
          data[i].high - data[i].low,
          Math.abs(data[i].high - data[i - 1].close),
          Math.abs(data[i].low - data[i - 1].close)
        );
        trueRanges.push(tr);
      }

      if (i < period) {
        atrs.push(null);
        continue;
      }

      if (i === period) {
        atrs.push(
          trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) /
            period
        );
      } else {
        atrs.push((atrs[i - 1] * (period - 1) + trueRanges[i]) / period);
      }
    }

    return atrs;
  };

  useEffect(() => {
    initializeCharts();

    return () => {
      if (candlestickResizeObserver.current) {
        candlestickResizeObserver.current.unobserve(
          candlestickChartContainerRef.current
        );
      }
      if (macdResizeObserver.current) {
        macdResizeObserver.current.unobserve(macdChartContainerRef.current);
      }
      if (rsiResizeObserver.current) {
        rsiResizeObserver.current.unobserve(rsiChartContainerRef.current);
      }

      candlestickChart.current?.remove();
      macdChart.current?.remove();
      rsiChart.current?.remove();
      websocket.current?.close();
    };
  }, [token]);

  const initializeCharts = async () => {
    if (
      !candlestickChartContainerRef.current ||
      !macdChartContainerRef.current ||
      !rsiChartContainerRef.current ||
      !token
    )
      return;

    candlestickChart.current = createChart(
      candlestickChartContainerRef.current,
      {
        ...commonChartOptions,
        width: candlestickChartContainerRef.current.clientWidth,
        height: window.innerHeight * 0.55,
        crosshair: {
          mode: CrosshairMode.Normal,
        },
      }
    );

    candlestickSeries.current = candlestickChart.current.addCandlestickSeries({
      ...CANDLESTICK_SERIES_CONFIG,
    });

    macdChart.current = createChart(macdChartContainerRef.current, {
      ...commonChartOptions,
      width: macdChartContainerRef.current.clientWidth,
      height: window.innerHeight * 0.25,
    });

    macdSeries.current = macdChart.current.addHistogramSeries({
      ...MACD_SERIES_CONFIG,
    });

    rsiChart.current = createChart(rsiChartContainerRef.current, {
      ...commonChartOptions,
      width: rsiChartContainerRef.current.clientWidth,
      height: window.innerHeight * 0.20325,
    });

    rsiSeries.current = rsiChart.current.addLineSeries({
      ...RSI_SERIES_CONFIG,
    });

    try {
      const initialData = await fetchIntradayCandleData();

      if (!initialData || initialData.length === 0) {
        console.error("No initial data received");
        return;
      }

      const sortedData = initialData.sort((a, b) => a.time - b.time);
      const lastCandle = sortedData[sortedData.length - 1];
      setCurrentCandle({
        O: lastCandle.open,
        H: lastCandle.high,
        L: lastCandle.low,
        C: lastCandle.close,
      });

      candlestickSeries.current.setData(sortedData);
      macdSeries.current.setData(calculateMACD(sortedData));
      rsiSeries.current.setData(calculateRSI(sortedData));

      const superTrendResult = calculateSuperTrend(sortedData);

      upperBandSeries.current = candlestickChart.current.addLineSeries({
        ...SUPERTREND_UPPERBAND_CONFIG,
      });

      lowerBandSeries.current = candlestickChart.current.addLineSeries({
        ...SUPERTREND_LOWERBAND_CONFIG,
      });

      const validUpperBandData = superTrendResult
        .filter((item) => item.upper !== null && item.trend === "down")
        .map((item) => ({ time: item.time, value: item.upper }));

      const validLowerBandData = superTrendResult
        .filter((item) => item.lower !== null && item.trend === "up")
        .map((item) => ({ time: item.time, value: item.lower }));

      if (validUpperBandData.length > 0) {
        upperBandSeries.current.setData(validUpperBandData);
        upperBandSeries.current.applyOptions({ visible: true });
      } else {
        upperBandSeries.current.applyOptions({ visible: false });
      }

      if (validLowerBandData.length > 0) {
        lowerBandSeries.current.setData(validLowerBandData);
        lowerBandSeries.current.applyOptions({ visible: true });
      } else {
        lowerBandSeries.current.applyOptions({ visible: false });
      }

      const syncTimeRange = (sourceChart) => {
        if (!sourceChart || !sourceChart.timeScale()) {
          console.warn("Source chart or its time scale is not available");
          return;
        }

        let visibleRange;
        try {
          visibleRange = sourceChart.timeScale().getVisibleRange();
        } catch (error) {
          console.warn("Error getting visible range:", error);
          return;
        }

        if (!visibleRange) {
          console.warn("Visible range is not available");
          return;
        }

        const charts = [
          candlestickChart.current,
          macdChart.current,
          rsiChart.current,
        ];

        charts.forEach((chart) => {
          if (chart && chart.timeScale()) {
            try {
              if (chart.timeScale().getVisibleLogicalRange()) {
                chart.timeScale().setVisibleRange(visibleRange);
              } else {
                console.warn(
                  "Chart has no visible data, skipping synchronization"
                );
              }
            } catch (error) {
              console.error("Error setting visible range for chart:", error);
            }
          }
        });
      };

      const setupChartSubscriptions = () => {
        const charts = [
          candlestickChart.current,
          macdChart.current,
          rsiChart.current,
        ];

        charts.forEach((chart) => {
          if (chart && chart.timeScale()) {
            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
              setTimeout(() => syncTimeRange(chart), 50);
            });
          }
        });
      };

      setTimeout(() => {
        setupChartSubscriptions();
        syncTimeRange(candlestickChart.current);
      }, 100);

      const createResizeObserver = (chart, container) => {
        return new ResizeObserver((entries) => {
          if (entries[0].target === container) {
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
          }
        });
      };

      candlestickResizeObserver.current = createResizeObserver(
        candlestickChart.current,
        candlestickChartContainerRef.current
      );
      macdResizeObserver.current = createResizeObserver(
        macdChart.current,
        macdChartContainerRef.current
      );
      rsiResizeObserver.current = createResizeObserver(
        rsiChart.current,
        rsiChartContainerRef.current
      );

      candlestickResizeObserver.current.observe(
        candlestickChartContainerRef.current
      );
      macdResizeObserver.current.observe(macdChartContainerRef.current);
      rsiResizeObserver.current.observe(rsiChartContainerRef.current);

      initializeWebSocket();
    } catch (error) {
      console.error("Error initializing charts:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (resizeObserver.current && candlestickChartContainerRef.current) {
        resizeObserver.current.unobserve(candlestickChartContainerRef.current);
        resizeObserver.current = null;
      }
    };
  }, []);

  const fetchIntradayCandleData = async () => {
    if (!token) return [];

    const today = new Date().toISOString().split("T")[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const fromDate = oneWeekAgo.toISOString().split("T")[0];

    const historicalEndpoint = `https://api.upstox.com/v2/historical-candle/${instrumentKey}/${interval}/${today}/${fromDate}`;
    const todayEndpoint = `https://api.upstox.com/v2/historical-candle/intraday/${instrumentKey}/${interval}/`;

    try {
      const historicalResponse = await fetch(historicalEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!historicalResponse.ok) {
        throw new Error(`HTTP error! status: ${historicalResponse.status}`);
      }

      const historicalData = await historicalResponse.json();
      const processedHistoricalData =
        historicalData.status === "success" &&
        historicalData.data &&
        historicalData.data.candles
          ? historicalData.data.candles.map((candle) => ({
              time: new Date(candle[0]).getTime() / 1000 + 19800,
              open: candle[1],
              high: candle[2],
              low: candle[3],
              close: candle[4],
              volume: candle[5],
            }))
          : [];

      const todayResponse = await fetch(todayEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!todayResponse.ok) {
        throw new Error(`HTTP error! status: ${todayResponse.status}`);
      }

      const todayData = await todayResponse.json();
      const processedTodayData =
        todayData.status === "success" &&
        todayData.data &&
        todayData.data.candles
          ? todayData.data.candles.map((candle) => ({
              time: new Date(candle[0]).getTime() / 1000 + 19800,
              open: candle[1],
              high: candle[2],
              low: candle[3],
              close: candle[4],
              volume: candle[5],
            }))
          : [];

      const combinedData = [...processedHistoricalData, ...processedTodayData];
      const sortedData = combinedData.sort((a, b) => a.time - b.time);

      const threeMinuteCandles = create3MinuteCandles(sortedData);
      return threeMinuteCandles;
    } catch (error) {
      console.error("Error fetching intraday candle data:", error);
      return [];
    }
  };

  const initializeWebSocket = async () => {
    if (!token) return;

    const messageQueue = [];

    const sendQueuedMessages = () => {
      while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (
          websocket.current &&
          websocket.current.readyState === WebSocket.OPEN
        ) {
          websocket.current.send(message);
        } else {
          messageQueue.unshift(message);
          break;
        }
      }
    };

    try {
      const wsUrl = await getUrl(token);
      websocket.current = new WebSocket(wsUrl);

      websocket.current.onopen = () => {
        const now = new Date();
        const startTime = new Date(now);
        const endTime = new Date(now);

        startTime.setHours(9, 15, 0, 0);
        endTime.setHours(15, 30, 0, 0);

        if (now >= startTime && now <= endTime) {
          setIsConnected(true);

          const data = {
            guid: "someguid",
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: [instrumentKey],
            },
          };

          messageQueue.push(Buffer?.from(JSON.stringify(data)));
          sendQueuedMessages();
        } else {
          setIsConnected(false);
        }
      };

      websocket.current.onclose = () => {
        setIsConnected(false);
      };

      websocket.current.onmessage = async (event) => {
        if (
          !websocket.current ||
          websocket.current.readyState !== WebSocket.OPEN
        ) {
          return;
        }
        const arrayBuffer = await blobToArrayBuffer(event.data);
        let buffer = Buffer?.from(arrayBuffer);
        let response = decodeProfobuf({ buffer, protobufRoot });

        const feeds = response.feeds;
        const nseIndexData = feeds[instrumentKey];

        let cp = "N/A";
        if (nseIndexData && nseIndexData.ff) {
          cp = nseIndexData.ff.indexFF.ltpc["ltp"];
        }

        handleMarketData(response);
      };

      websocket.current.onerror = (error) => {
        setIsConnected(false);
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  };

  const create3MinuteCandle = (oneMinCandles) => {
    if (oneMinCandles.length === 0) return null;

    return {
      time: oneMinCandles[0].time,
      open: oneMinCandles[0].open,
      high: Math.max(...oneMinCandles.map((c) => c.high)),
      low: Math.min(...oneMinCandles.map((c) => c.low)),
      close: oneMinCandles[oneMinCandles.length - 1].close,
      volume: oneMinCandles.reduce((sum, c) => sum + c.volume, 0),
    };
  };

  const create3MinuteCandles = (data) => {
    const result = [];
    for (let i = 0; i < data.length; i += 3) {
      if (i + 2 < data.length) {
        const threeMinuteCandle = create3MinuteCandle(data.slice(i, i + 3));
        result.push(threeMinuteCandle);
      }
    }
    return result;
  };

  const handleMarketData = (data) => {
    if (data && data.feeds) {
      const feedKey = Object.keys(data.feeds).find((key) =>
        key.includes(instrumentKey)
      );
      const tickData = data.feeds[feedKey];

      if (!feedKey) {
        return;
      }

      if (feedKey !== instrumentKey) {
        setLastProcessedMinute(null);
        setCurrent3MinCandle(null);
        setCurrentCandle(null);
        candlestickSeries.current.clear();
        upperBandSeries.current.clear();
        lowerBandSeries.current.clear();
        instrumentKey = feedKey;
      }

      const lastTickTime =
        new Date(tickData.ff.indexFF.ltpc.ltt).getTime() / 1000;

      const sortedOHLC = [...tickData.ff.indexFF.marketOHLC.ohlc]
        .filter((item) => item.interval === "I1")
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

      if (sortedOHLC.length > 0) {
        const minuteOHLC = sortedOHLC[sortedOHLC.length - 1];

        const currentMinuteTime = Math.floor(lastTickTime / 60) * 60 + 19800;

        if (currentMinuteTime === lastProcessedMinute) {
          return;
        }

        setLastProcessedMinute(currentMinuteTime);

        const current3MinCandleStart =
          Math.floor(currentMinuteTime / 180) * 180;

        const currentMinuteCandle = {
          time: currentMinuteTime,
          open: minuteOHLC.open,
          high: minuteOHLC.high,
          low: minuteOHLC.low,
          close: minuteOHLC.close,
          volume: minuteOHLC.volume,
        };

        setCurrent3MinCandle((prev3MinCandle) => {
          let updatedCandle;
          if (!prev3MinCandle || current3MinCandleStart > prev3MinCandle.time) {
            updatedCandle = {
              time: current3MinCandleStart,
              open: currentMinuteCandle.open,
              high: currentMinuteCandle.high,
              low: currentMinuteCandle.low,
              close: currentMinuteCandle.close,
              volume: currentMinuteCandle.volume,
            };
          } else {
            updatedCandle = {
              ...prev3MinCandle,
              high: Math.max(prev3MinCandle.high, currentMinuteCandle.high),
              low: Math.min(prev3MinCandle.low, currentMinuteCandle.low),
              close: currentMinuteCandle.close,
              volume: prev3MinCandle.volume + currentMinuteCandle.volume,
            };
          }

          candlestickSeries.current.update(updatedCandle);

          setCurrentCandle({
            O: updatedCandle.open,
            H: updatedCandle.high,
            L: updatedCandle.low,
            C: updatedCandle.close,
          });

          updateMACD({ updatedCandle, candlestickSeries, macdSeries });
          updateRSI({ updatedCandle, candlestickSeries, rsiSeries });

          updateSuperTrend(updatedCandle);

          return updatedCandle;
        });
      } else {
        console.error("Minute OHLC data not found in response.");
      }
    }
  };

  const updateSuperTrend = (updatedCandle) => {
    const allCandles = candlestickSeries.current.data();
    const updatedSuperTrend = calculateSuperTrend([
      ...allCandles,
      updatedCandle,
    ]);

    const latestSuperTrend = updatedSuperTrend[updatedSuperTrend.length - 1];
    if (latestSuperTrend) {
      upperBandSeries.current.update({
        time: latestSuperTrend.time,
        value: latestSuperTrend.upper,
      });
      upperBandSeries.current.applyOptions({
        visible: latestSuperTrend.trend === "down",
      });

      lowerBandSeries.current.update({
        time: latestSuperTrend.time,
        value: latestSuperTrend.lower,
      });
      lowerBandSeries.current.applyOptions({
        visible: latestSuperTrend.trend === "up",
      });
    }
  };

  const calculateSuperTrend = (data, period = 10, multiplier = 3) => {
    const atr = calculateATR(data, period);
    const superTrend = [];
    let currentTrend = "up";

    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        superTrend.push({
          time: data[i].time,
          upper: null,
          lower: null,
          trend: currentTrend,
        });
        continue;
      }

      const highLow = (data[i].high + data[i].low) / 2;
      const basicUpperBand = highLow + multiplier * atr[i - period];
      const basicLowerBand = highLow - multiplier * atr[i - period];

      let finalUpperBand, finalLowerBand;

      if (i === period) {
        finalUpperBand = basicUpperBand;
        finalLowerBand = basicLowerBand;
      } else {
        finalUpperBand =
          basicUpperBand < superTrend[i - 1].upper ||
          data[i - 1].close > superTrend[i - 1].upper
            ? basicUpperBand
            : superTrend[i - 1].upper;

        finalLowerBand =
          basicLowerBand > superTrend[i - 1].lower ||
          data[i - 1].close < superTrend[i - 1].lower
            ? basicLowerBand
            : superTrend[i - 1].lower;
      }

      if (currentTrend === "down" && data[i].close > finalUpperBand) {
        currentTrend = "up";
      } else if (currentTrend === "up" && data[i].close < finalLowerBand) {
        currentTrend = "down";
      }

      superTrend.push({
        time: data[i].time,
        upper: finalUpperBand,
        lower: finalLowerBand,
        trend: currentTrend,
      });
    }

    return superTrend;
  };

  useEffect(() => {
    const matchedOption = MARKET_OPTIONS.find(
      (option) => option.value === instrumentKey
    );
    if (matchedOption) {
      setSelectedMarket(matchedOption.label);
    }
  }, []);

  const handleMarketSelect = (option) => {
    setSelectedMarket(option.label);
    setInstrumentKey(option.value);
    setIsDropdownOpen(false);
    sessionStorage.clear();
    setShouldReload(true);
    navigate("/market", { state: { instrumentKey: option.value, token } });
  };

  useEffect(() => {
    if (shouldReload) {
      window.location.reload();
    }
  }, [shouldReload]);

  useEffect(() => {
    setShouldReload(false);
    candlestickSeries.current.setData([]);

    const fetchAndUpdateData = async () => {
      const fetchedData = await fetchIntradayCandleData();
      if (fetchedData.length > 0) {
        candlestickSeries.current.setData(fetchedData);
      }
    };

    fetchAndUpdateData();

    const cleanupWebSocket = () => {
      if (websocket.current) {
        websocket.current.close();
        websocket.current = null;
        setIsConnected(false);
      }
    };

    const initializeWebSocketConnection = () => {
      cleanupWebSocket();
      initializeWebSocket();
    };

    initializeWebSocketConnection();

    return () => {
      cleanupWebSocket();
    };
  }, [instrumentKey]);

  return (
    <div className="market-wrapper">
      <div className="market-controls">
        <img
          src={BackArrow}
          className="back-button"
          alt="back"
          onClick={() => navigate(-1)}
        />
        <div className="market-list-container">
          <button
            className="dropdown-toggle"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {selectedMarket} ▼
          </button>
          {isDropdownOpen && (
            <ul className="dropdown-menu">
              {MARKET_OPTIONS.map((option) => (
                <li
                  key={option.value}
                  onClick={() => handleMarketSelect(option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          className="socket-connection-indicator"
          style={{ backgroundColor: isConnected ? "#26a69a" : "#ef5350" }}
        />
        {remainingTime && isConnected && (
          <div className="current-candle-timer"> {remainingTime}</div>
        )}
        <CurrentCandleData currentCandle={currentCandle} />
      </div>
      <div ref={candlestickChartContainerRef} className="chart-container" />
      <div ref={macdChartContainerRef} className="chart-container" />
      <div ref={rsiChartContainerRef} className="chart-container" />
    </div>
  );
};

export default Market;
