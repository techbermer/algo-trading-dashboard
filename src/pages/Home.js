import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import HomeDecorImg from "../assets/images/HomeDecorativeImg.png";
import BlackBackgroundImg from "../assets/images/HomeBackgroundImg.png";
import { MARKET_OPTIONS } from "../constants/markets";
import "../stylings/Home.css";

const Home = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = location.state?.token;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState("Select Market");

  const handleMarketSelect = (option) => {
    setSelectedMarket(option.label);
    setIsDropdownOpen(false);
    navigate("/market", { state: { instrumentKey: option.value, token } });
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <div className="home-wrapper">
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
          <div className="dropdown-container">
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
        </div>
        <div className="home-content-right">
          <img className="home-decor-img" src={HomeDecorImg} />
        </div>
      </div>
    </div>
  );
};

export default Home;
