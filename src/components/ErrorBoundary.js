// src/components/ErrorBoundary.js
import React from "react";

// ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error("Error caught in Error Boundary:", error, errorInfo);
    // Reload the page or perform any necessary action
    window.location.reload(); // Reload the page on error
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Reloading...</h1>; // Fallback UI
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
