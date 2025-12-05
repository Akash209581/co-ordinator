import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Comprehensive error suppression for browser extension errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const errorString = args.join(' ');
  if (
    errorString.includes('translate-page') ||
    errorString.includes('save-page') ||
    errorString.includes('menu item with id')
  ) {
    return; // Suppress these errors
  }
  originalConsoleError.apply(console, args);
};

// Suppress browser extension errors
window.addEventListener('error', (event) => {
  if (event.message && (
    event.message.includes('translate-page') ||
    event.message.includes('save-page') ||
    event.message.includes('menu item with id')
  )) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && (
    event.reason.message.includes('translate-page') ||
    event.reason.message.includes('save-page') ||
    event.reason.message.includes('menu item with id')
  )) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
