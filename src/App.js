import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./pages/Login";
import Market from "./pages/Market";
import Home from "./pages/Home";
import Loader from "./components/Loader";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogin = (token) => {
    setIsLoggedIn(true);
    localStorage.setItem("token", token);
  };

  const handleLogout = (message) => {
    setIsLoggedIn(false);
    localStorage.removeItem("token");

    if (message && !toast.isActive("session-expired-toast")) {
      toast.error(message, {
        toastId: "session-expired-toast",
      });
    }
  };

  if (isLoggedIn === null) {
    return <Loader />;
  }

  return (
    <>
      <Router style={styles.container}>
        <Routes>
          {isLoggedIn ? (
            <>
              <Route path="/" element={<Home onLogout={handleLogout} />} />
              <Route
                path="/market"
                element={<Market onLogout={handleLogout} />}
              />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          )}
        </Routes>
      </Router>
      <ToastContainer />
    </>
  );
};

const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
};

const styleTag = `
  ::selection {
    background-color: rgba(255, 82, 82, 0.7);
    color: rgba(76, 175, 80, 0.7);
  }
`;

document.head.insertAdjacentHTML("beforeend", `<style>${styleTag}</style>`);

export default App;
