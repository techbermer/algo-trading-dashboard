import React, { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode } from "lightweight-charts";
import "./App.css";
import proto from "../src/prot/MarketDataFeed.proto";
import { Buffer } from "buffer";
const protobuf = require("protobufjs");

let protobufRoot = null;
const initProtobuf = async () => {
  protobufRoot = await protobuf.load(proto);
  console.log("Protobuf part initialization complete");
};

const App = () => {
  const chartContainerRef = useRef(null);
  const chart = useRef(null);
  const resizeObserver = useRef(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [intervalTime, setIntervalTime] = useState(3); // Default interval of 3 minutes
  const [currentCandle, setCurrentCandle] = useState(null);
  const candlestickSeries = useRef(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authError, setAuthError] = useState(null);
  const websocket = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [feedData, setFeedData] = useState([]);

    const [current3MinCandle, setCurrent3MinCandle] = useState(null);
    const [lastProcessedMinute, setLastProcessedMinute] = useState(null);

  const API_KEY = "75638fd0-be6a-4c01-8e6a-a09946997f1c";
  const API_SECRET = "y5ns11i89v";
  const REDIRECT_URI = "http://localhost:3000";

  const instrumentKey = "NSE_INDEX|Nifty 50";
  const interval = "1minute";
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);


  const generateAuthUrl = () => {
    const client_id = encodeURIComponent(API_KEY);
    const redirect_uri = encodeURIComponent(REDIRECT_URI);
    return `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}`;
  };

  const fetchAccessToken = async (authorizationCode) => {
    try {
      const response = await fetch(
        "https://api.upstox.com/v2/login/authorization/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code: authorizationCode,
            client_id: API_KEY,
            client_secret: API_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setAccessToken(data.access_token);
        setAuthError(null);
      } else {
        setAuthError("Failed to fetch access token. Please try again.");
      }
    } catch (error) {
      setAuthError("An error occurred while fetching the access token.");
    }
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


  const fetchIntradayCandleData = async () => {
    if (!accessToken) return [];

    const today = new Date().toISOString().split("T")[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 1);
    const fromDate = oneWeekAgo.toISOString().split("T")[0];

    const historicalEndpoint = `https://api.upstox.com/v2/historical-candle/${instrumentKey}/${interval}/${today}/${fromDate}`;
    const todayEndpoint = `https://api.upstox.com/v2/historical-candle/intraday/${instrumentKey}/${interval}/`;

    try {
      const historicalResponse = await fetch(historicalEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
          Authorization: `Bearer ${accessToken}`,
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

  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get("code");

      if (authCode) {
        fetchAccessToken(authCode);
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }
    };

    handleOAuthCallback();
    initProtobuf();
  }, []);

  useEffect(() => {
    const initializeChart = async () => {
      if (!chartContainerRef.current || !accessToken) return;

      chart.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { type: "solid", color: "#1E222D" },
          textColor: "white",
        },
        grid: {
          vertLines: { color: "#2B2B43" },
          horzLines: { color: "#2B2B43" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          visible: true,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      candlestickSeries.current = chart.current.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });

      const initialData = await fetchIntradayCandleData();
      console.log("initial data", initialData);
      const sortedData = initialData.sort((a, b) => a.time - b.time);
      candlestickSeries.current.setData(sortedData);
      setCurrentCandle(sortedData[sortedData.length - 1]);

      resizeObserver.current = new ResizeObserver((entries) => {
        if (entries[0].target === chartContainerRef.current) {
          const { width, height } = entries[0].contentRect;
          chart.current.applyOptions({ width, height });
        }
      });

      resizeObserver.current.observe(chartContainerRef.current);

      initializeWebSocket();
    };

    initializeChart();

    return () => {
      if (resizeObserver.current && chartContainerRef.current) {
        resizeObserver.current.unobserve(chartContainerRef.current);
      }
      if (chart.current) {
        console.log("removing");
        chart.current.remove();
      }
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, [accessToken]);

  const initializeWebSocket = async () => {
    if (!accessToken) return;

    try {
      const wsUrl = await getUrl(accessToken);
      websocket.current = new WebSocket(wsUrl);

      websocket.current.onopen = () => {
        setIsConnected(true);
        console.log("Connected");
        const data = {
          guid: "someguid",
          method: "sub",
          data: {
            mode: "full",
            instrumentKeys: [instrumentKey],
          },
        };
        websocket.current.send(Buffer.from(JSON.stringify(data)));
      };

      websocket.current.onclose = () => {
        setIsConnected(false);
        console.log("Disconnected");
      };

      websocket.current.onmessage = async (event) => {
        const arrayBuffer = await blobToArrayBuffer(event.data);
        let buffer = Buffer.from(arrayBuffer);
        let response = decodeProfobuf(buffer);

        console.log("data", response);

        const currentTs = response.currentTs; // Timestamp of the message in ISO string format
        const feeds = response.feeds; 
        const nseIndexData = feeds["NSE_INDEX|Nifty 50"];

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
  if (data && data.feeds && data.feeds[instrumentKey]) {
    const tickData = data.feeds[instrumentKey];

    const lastPrice = tickData.ff.indexFF.ltpc.ltp;
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

      // Check if we've already processed this minute
      if (currentMinuteTime === lastProcessedMinute) {
        return;
      }

      setLastProcessedMinute(currentMinuteTime);

      // Calculate the start time of the current 3-minute candle
      const current3MinCandleStart = Math.floor(currentMinuteTime / 180) * 180;

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
          return updatedCandle;
        }
      });

      setCurrentPrice(lastPrice);
    } else {
      console.error("Minute OHLC data not found in response.");
    }
  }
};

  const handleIntervalChange = (e) => {
    const newInterval = parseInt(e.target.value, 10);
    setIntervalTime(newInterval);
  };

  const handleAuthorize = () => {
    window.location.href = generateAuthUrl();
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Algo trading</h1>
      {authError && <div className="error-message">{authError}</div>}
      {!accessToken ? (
        <button onClick={handleAuthorize} className="auth-button">
          Authorize with Upstox
        </button>
      ) : (
        <>
          <div className="app-controls">
            <label htmlFor="interval-select" className="app-label">
              Select Interval:{" "}
            </label>
            <select
              id="interval-select"
              value={intervalTime}
              onChange={handleIntervalChange}
              className="app-dropdown"
            >
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
            <div className="app-info">
              <p>Current Price: {currentPrice || "N/A"}</p>
              <p>Current Candle: {JSON.stringify(currentCandle)}</p>
              <p>
                Connection Status: {isConnected ? "Connected" : "Disconnected"}
              </p>
            </div>
          </div>
          <div ref={chartContainerRef} className="chart-container" />
          <div className="feed-section">
            <h2>Feed Data</h2>
            <div>
              {feedData.slice(-5).map((data, index) => (
                <div key={index} className="feed-item">
                  {data}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
