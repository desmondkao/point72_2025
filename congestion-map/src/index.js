// index.js with required Mapbox CSS
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import store from "./store";
import "./index.css";

// Important: Add Mapbox CSS for Kepler.gl to work properly
import "mapbox-gl/dist/mapbox-gl.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);