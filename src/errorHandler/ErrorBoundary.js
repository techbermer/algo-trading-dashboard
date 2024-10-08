import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught in Error Boundary:", error, errorInfo);
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Reloading...</h1>;
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
