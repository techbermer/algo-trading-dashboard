import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// import { logout } from "../apis/authApis";
import { getUrl } from "../apis/webSocketUrl";
import { startMarket, stopMarket } from "../apis/marketDataApis";
import HomeDecorImg from "../assets/images/HomeDecorativeImg.png";
import BlackBackgroundImg from "../assets/images/HomeBackgroundImg.png";
import { MARKET_OPTIONS } from "../constants/markets";
import "../stylings/Home.css";

const Home = ({ onLogout }) => {
  const navigate = useNavigate();
  const marketDropdownRef = useRef(null);
  const lotSizeDropdownRef = useRef(null);
  const [token, setToken] = useState(null);
  const [toastType, setToastType] = useState("error");
  const [toastMessage, setToastMessage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState("Select Market");
  const [selectedMarketInstrumentKey, setSelectedMarketInstrumentKey] =
    useState("");
  const [isLotSizeDropdownOpen, setIsLotSizeDropdownOpen] = useState(false);
  const [selectedLotSize, setSelectedLotSize] = useState("Select Lot Size");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setToken(token);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        marketDropdownRef.current &&
        !marketDropdownRef.current.contains(event.target) &&
        lotSizeDropdownRef.current &&
        !lotSizeDropdownRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
        setIsLotSizeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleMarketSelect = (option) => {
    setSelectedMarket(option.label);
    setSelectedMarketInstrumentKey(option.value);
    setIsDropdownOpen(false);
  };

  const handleLotSizeSelect = (size) => {
    setSelectedLotSize(size);
    setIsLotSizeDropdownOpen(false);
  };

  const handleLogout = async () => {
    onLogout();
    // try {
    //   const response = await logout();
    //   if (response.ok) {
    //     setToastMessage("Market stopped");
    //     setToastType("error");
    //     onLogout();
    //   } else {
    //     console.error("Failed to logout");
    //   }
    // } catch (error) {
    //   console.error("Error during logout:", error);
    // }
  };

  const start_Market = async () => {
    if (
      !selectedMarketInstrumentKey ||
      selectedMarketInstrumentKey === "Select Market"
    ) {
      setToastMessage("Please select a market to start.");
      setToastType("error");
      return;
    }

    if (!selectedLotSize || selectedLotSize === "Select Lot Size") {
      setToastMessage("Please select a lot size to start.");
      setToastType("error");
      return;
    }

    const lotData = {
      NIFTY_50:
        selectedMarketInstrumentKey === "NSE_INDEX|Nifty 50"
          ? selectedLotSize
          : 0,
      BANK_NIFTY:
        selectedMarketInstrumentKey === "NSE_INDEX|Bank Nifty"
          ? selectedLotSize
          : 0,
      FIN_NIFTY:
        selectedMarketInstrumentKey === "NSE_INDEX|Fin Nifty"
          ? selectedLotSize
          : 0,
      MIDCPNIFTY:
        selectedMarketInstrumentKey === "NSE_INDEX|Midcap Nifty"
          ? selectedLotSize
          : 0,
      SENSEX:
        selectedMarketInstrumentKey === "BSE_INDEX|Sensex"
          ? selectedLotSize
          : 0,
      BANKEX:
        selectedMarketInstrumentKey === "BSE_INDEX|Bankex"
          ? selectedLotSize
          : 0,
    };

    const body = JSON.stringify({
      instrument_key: selectedMarketInstrumentKey,
      lot: lotData,
    });

    try {
      const response = await startMarket({ selectedMarketAndLot: body });

      if (response.ok) {
        navigate("/market", {
          state: { instrumentKey: selectedMarketInstrumentKey, token },
        });
      } else {
        console.error("Failed to start market");
      }
    } catch (error) {
      console.error("Error while starting market:", error);
    }
  };

  const stop_Market = async () => {
    try {
      const response = await stopMarket();

      if (response.ok) {
        setToastMessage("Market operations stopped");
        setToastType("error");
      } else {
        console.error("Failed to stop market");
      }
    } catch (error) {
      console.error("Error while stopping market:", error);
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage("");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    initializeWebSocket();
  }, []);

  const initializeWebSocket = async () => {
    try {
      await getUrl();
    } catch (error) {
      if (error.message === "Token expired") {
        onLogout("Session expired, please re-login");
      }
    }
  };

  return (
    <div className="home-wrapper">
      {toastMessage && (
        <div className={`custom-toast ${toastType}`}>
          <span>{toastMessage}</span>
          <button className="close-btn" onClick={() => setToastMessage("")}>
            ×
          </button>
        </div>
      )}
      <h2 className="home-title">
        Trade <span>X</span>
      </h2>
      <button className="profile-button" onClick={handleLogout}>
        Logout
      </button>
      <img src={BlackBackgroundImg} alt="" className="black-background-img" />
      <div className="home-content-container">
        <div className="home-content-left">
          <h1 className="home-quote">Your Edge in the Market:</h1>
          <h1 className="home-quote">Intelligent Algorithmic Trading</h1>
          <h6 className="home-description">
            Navigate and manage your trading strategies effortlessly with an
            intuitive and easy-to-use platform.
          </h6>

          <div className="home-buttons">
            <div className="dropdown-container" ref={marketDropdownRef}>
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
            <div className="dropdown-container" ref={lotSizeDropdownRef}>
              <button
                className="dropdown-toggle"
                onClick={() => setIsLotSizeDropdownOpen(!isLotSizeDropdownOpen)}
              >
                {selectedLotSize} ▼
              </button>
              {isLotSizeDropdownOpen && (
                <ul className="dropdown-menu">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                    <li key={size} onClick={() => handleLotSizeSelect(size)}>
                      {size}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dropdown-container">
              <button className="dropdown-toggle" onClick={start_Market}>
                Start
              </button>
            </div>

            <div className="dropdown-container">
              <button className="dropdown-toggle" onClick={stop_Market}>
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="home-content-right">
          <img className="home-decor-img" src={HomeDecorImg} />
        </div>
      </div>
    </div>
  );
};

export default Home;
