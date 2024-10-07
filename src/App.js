import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Market from "./pages/Market";
import Home from "./pages/Home";
import ErrorBoundary from "./errorHandler/ErrorBoundary";

const App = () => {
  return (
    <Router style={styles.container}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/market"
          element={
            <ErrorBoundary>
              <Market />
            </ErrorBoundary>
          }
        />
      </Routes>
    </Router>
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
