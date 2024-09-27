// src/App.js
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Market from "./pages/Market";
import Home from "./pages/Home";


const App = () => {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/market" element={<Market />} />
        </Routes>
    </Router>
  );
};

export default App;
