import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { BusinessDataProvider } from "./data/BusinessDataContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BusinessDataProvider>
          <App />
        </BusinessDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
