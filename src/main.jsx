import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AssessmentProvider } from './state/assessment.jsx';
import './styles/tailwind.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AssessmentProvider>
        <App />
      </AssessmentProvider>
    </HashRouter>
  </React.StrictMode>,
);
