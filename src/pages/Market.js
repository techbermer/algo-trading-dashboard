import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createChart, CrosshairMode } from "lightweight-charts";
import { MACD, RSI } from "technicalindicators";
import BackArrow from "../assets/icons/BackArrow.png";
import { MARKET_OPTIONS } from "../constants/markets";
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
  const macdChart = useRef(null);
  const macdSeries = useRef(null);
  const resizeObserver = useRef(null);
  const candlestickChart = useRef(null);
  const candlestickSeries = useRef(null);
  const macdResizeObserver = useRef(null);
  const macdChartContainerRef = useRef(null);
  const candlestickResizeObserver = useRef(null);
  const candlestickChartContainerRef = useRef(null);

  const rsiChart = useRef(null);
  const rsiSeries = useRef(null);
  const rsiResizeObserver = useRef(null);
  const rsiChartContainerRef = useRef(null);

  const [feedData, setFeedData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
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

  const blobToArrayBuffer = async (blob) => {
    if ("arrayBuffer" in blob) return await blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject();
      reader.readAsArrayBuffer(blob);
    });
  };

  const decodeProfobuf = (buffer) => {
    if (!protobufRoot) {
      console.warn("Protobuf part not initialized yet!");
      return null;
    }
    const FeedResponse = protobufRoot.lookupType(
      "com.upstox.marketdatafeeder.rpc.proto.FeedResponse"
    );
    return FeedResponse.decode(buffer);
  };

  const getUrl = async (token) => {
    const apiUrl = "https://api-v2.upstox.com/feed/market-data-feed/authorize";
    let headers = {
      "Content-type": "application/json",
      Authorization: "Bearer " + token,
    };
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const res = await response.json();
    return res.data.authorizedRedirectUri;
  };

 useEffect(() => {
   const initializeCharts = async () => {
     if (
       !candlestickChartContainerRef.current ||
       !macdChartContainerRef.current ||
       !rsiChartContainerRef.current ||
       !token
     )
       return;

     const commonChartOptions = {
       layout: {
         background: { type: "solid", color: "#1E222D" },
         textColor: "white",
       },
       grid: {
         vertLines: { color: "#2B2B43" },
         horzLines: { color: "#2B2B43" },
       },
       rightPriceScale: {
         visible: true,
         borderColor: "#2B2B43",
         minimumWidth: 70, 
       },
       timeScale: {
         timeVisible: true,
         secondsVisible: false,
         borderColor: "#2B2B43",
       },
     };

     candlestickChart.current = createChart(
       candlestickChartContainerRef.current,
       {
         ...commonChartOptions,
         width: candlestickChartContainerRef.current.clientWidth,
         height: 400,
         crosshair: {
           mode: CrosshairMode.Normal,
         },
       }
     );

     candlestickSeries.current = candlestickChart.current.addCandlestickSeries({
       upColor: "#26a69a",
       downColor: "#ef5350",
       borderVisible: false,
       wickUpColor: "#26a69a",
       wickDownColor: "#ef5350",
     });

     macdChart.current = createChart(macdChartContainerRef.current, {
       ...commonChartOptions,
       width: macdChartContainerRef.current.clientWidth,
       height: 200,
     });

     macdSeries.current = macdChart.current.addHistogramSeries({
       color: "#26a69a",
       priceFormat: {
         type: "price",
       },
     });

     rsiChart.current = createChart(rsiChartContainerRef.current, {
       ...commonChartOptions,
       width: rsiChartContainerRef.current.clientWidth,
       height: 150,
     });

     rsiSeries.current = rsiChart.current.addLineSeries({
       color: "#2962FF",
       lineWidth: 2,
     });

     const initialData = await fetchIntradayCandleData();
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

     // Synchronize time scales
     const syncTimeRange = (sourceChart) => {
       const visibleRange = sourceChart?.timeScale()?.getVisibleRange();
       macdChart.current?.timeScale()?.setVisibleRange(visibleRange);
       rsiChart.current?.timeScale()?.setVisibleRange(visibleRange);
       candlestickChart?.current?.timeScale()?.setVisibleRange(visibleRange);
     };

     // Subscribe to time scale changes
     candlestickChart.current
       .timeScale()
       .subscribeVisibleTimeRangeChange(() => {
         syncTimeRange(candlestickChart.current);
       });

     macdChart.current.timeScale().subscribeVisibleTimeRangeChange(() => {
       syncTimeRange(macdChart.current);
     });

     rsiChart.current.timeScale().subscribeVisibleTimeRangeChange(() => {
       syncTimeRange(rsiChart.current);
     });

     // Create ResizeObservers
     const createResizeObserver = (chart, container) => {
       return new ResizeObserver((entries) => {
         if (entries[0].target === container) {
           const { width, height } = entries[0].contentRect;
           chart.applyOptions({ width, height });
         }
       });
     };

     // Assign the observers to the refs
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

     // Observe the containers
     candlestickResizeObserver.current.observe(
       candlestickChartContainerRef.current
     );
     macdResizeObserver.current.observe(macdChartContainerRef.current);
     rsiResizeObserver.current.observe(rsiChartContainerRef.current);

     // Initialize WebSocket
     initializeWebSocket();
   };

   initializeCharts();

   return () => {
     // Cleanup
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
        let response = decodeProfobuf(buffer);

        const feeds = response.feeds;
        const nseIndexData = feeds[instrumentKey];

        let cp = "N/A";
        if (nseIndexData && nseIndexData.ff) {
          cp = nseIndexData.ff.indexFF.ltpc["ltp"];
        }

        setFeedData((currentData) => [
          ...currentData,
          JSON.stringify(response),
        ]);

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
          if (!prev3MinCandle || current3MinCandleStart > prev3MinCandle.time) {
            const newCandle = {
              time: current3MinCandleStart,
              open: currentMinuteCandle.open,
              high: currentMinuteCandle.high,
              low: currentMinuteCandle.low,
              close: currentMinuteCandle.close,
              volume: currentMinuteCandle.volume,
            };

            candlestickSeries.current.update(newCandle);

            setCurrentCandle({
              O: currentMinuteCandle.open,
              H: currentMinuteCandle.high,
              L: currentMinuteCandle.low,
              C: currentMinuteCandle.close,
            });

            updateMACD(newCandle);
            updateRSI(newCandle);

            return newCandle;
          } else {
            const updatedCandle = {
              ...prev3MinCandle,
              high: Math.max(prev3MinCandle.high, currentMinuteCandle.high),
              low: Math.min(prev3MinCandle.low, currentMinuteCandle.low),
              close: currentMinuteCandle.close,
              volume: prev3MinCandle.volume + currentMinuteCandle.volume,
            };

            candlestickSeries.current.update(updatedCandle);

            setCurrentCandle({
              O: updatedCandle.open,
              H: updatedCandle.high,
              L: updatedCandle.low,
              C: updatedCandle.close,
            });

            updateMACD(updatedCandle);
            updateRSI(updatedCandle);

            return updatedCandle;
          }
        });
      } else {
        console.error("Minute OHLC data not found in response.");
      }
    }
  };

  const calculateRSI = (data) => {
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

  const updateRSI = (newCandle) => {
    const currentData = candlestickSeries.current.data();
    const updatedData = [...currentData, newCandle];
    const closePrices = updatedData.map((candle) => candle.close);

    const rsiPeriod = 14;
    const rsiValues = RSI.calculate({
      values: closePrices,
      period: rsiPeriod,
    });

    const latestRSI = rsiValues[rsiValues.length - 1];

    if (latestRSI) {
      rsiSeries.current.update({
        time: newCandle.time,
        value: latestRSI,
      });
    }
  };

  const updateMACD = (newCandle) => {
    const currentData = candlestickSeries.current.data();

    const updatedData = [...currentData, newCandle];

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
        time: newCandle.time,
        value: latestMACD.MACD - latestMACD.signal,
        color: latestMACD.MACD >= latestMACD.signal ? "#26a69a" : "#ef5350",
      };

      macdSeries.current.update(macdHistogram);
    }
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
    localStorage.clear();
    sessionStorage.clear();
    navigate("/market", { state: { instrumentKey: option.value, token } });
  };

  useEffect(() => {
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

  const CandleDataRow = ({ keyName, value, isBullish }) => (
    <p>
      <span style={{ color: "white" }}>{keyName}:</span>{" "}
      <span
        style={{
          color: isBullish ? "#26a69a" : "#ef5350",
        }}
      >
        {value?.toLocaleString("en-IN")}
      </span>
    </p>
  );

  const CurrentCandleData = ({ currentCandle }) => {
    const isBullish = currentCandle?.C > currentCandle?.O;

    return (
      <div className="current-candle-data">
        <CandleDataRow
          keyName="O"
          value={currentCandle?.O}
          isBullish={isBullish}
        />
        <CandleDataRow
          keyName="H"
          value={currentCandle?.H}
          isBullish={isBullish}
        />
        <CandleDataRow
          keyName="L"
          value={currentCandle?.L}
          isBullish={isBullish}
        />
        <CandleDataRow
          keyName="C"
          value={currentCandle?.C}
          isBullish={isBullish}
        />
      </div>
    );
  };

  const calculateMACD = (data) => {
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
        <CurrentCandleData currentCandle={currentCandle} />
      </div>
      <div ref={candlestickChartContainerRef} className="chart-container" />
      <div ref={macdChartContainerRef} className="chart-container" />
      <div ref={rsiChartContainerRef} className="chart-container" />
    </div>
  );
};

export default Market;
