import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundImg from "../assets/images/LoginBackgroundImg.png";
import "../stylings/Login.css";

const Login = ({ onLogin }) => {
  const API_SECRET = "y5ns11i89v";
  const API_KEY = "75638fd0-be6a-4c01-8e6a-a09946997f1c";
  const REDIRECT_URI = "http://localhost:3000/login";

  const navigate = useNavigate();
  const [authError, setAuthError] = useState(null);

  const handleAuthorize = () => {
    window.location.href = generateAuthUrl();
  };

  const generateAuthUrl = () => {
    const client_id = encodeURIComponent(API_KEY);
    const redirect_uri = encodeURIComponent(REDIRECT_URI);
    return `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}`;
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
  }, []);

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
        onLogin(data.access_token);
        navigate("/", { state: { token: data.access_token } });
        setAuthError(null);
      } else {
        setAuthError("Failed to fetch access token. Please try again.");
      }
    } catch (error) {
      setAuthError("An error occurred while fetching the access token.");
    }
  };

  return (
    <div className="login-wrapper">
      <h1 className="login-heading">
        Trade<span>X</span>
      </h1>
      <img
        src={BackgroundImg}
        className="login-background-img"
        alt="login-background"
      />

      <button onClick={handleAuthorize} className="login-button">
        Login
      </button>
    </div>
  );
};

export default Login;
