import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Market from "./pages/Market";
import Home from "./pages/Home";
import ErrorBoundary from "./errorHandler/ErrorBoundary";

const App = () => {
  return (
    <Router>
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

export default App;
