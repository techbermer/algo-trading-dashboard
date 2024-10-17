import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../components/Loader";
import BackgroundImg from "../assets/images/LoginBackgroundImg.png";
import { generateAuthUrl, getAccessToken } from "../apis/authApis";
import "../stylings/Login.css";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthorize = () => {
    window.location.href = generateAuthUrl();
  };

  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get("code");

      if (authCode) {
        setIsLoading(true);
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
      const data = await getAccessToken({ authorizationCode });
      if (data.access_token) {
        onLogin(data.access_token);
        navigate("/", { state: { token: data.access_token } });
        setAuthError(null);
      } else {
        setAuthError("Failed to fetch access token. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {isLoading ? (
        <Loader />
      ) : (
        <>
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

          {authError && <p className="error-message">{authError}</p>}
        </>
      )}
    </div>
  );
};

export default Login;
