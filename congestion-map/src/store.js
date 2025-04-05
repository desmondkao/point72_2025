// store.js
import { configureStore } from "@reduxjs/toolkit";
import { taskMiddleware } from "react-palm/tasks";
import { keplerGlReducer } from "@kepler.gl/reducers";


const store = configureStore({
  reducer: {
    keplerGl: keplerGlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(taskMiddleware),
  devTools: process.env.NODE_ENV !== "production",
});

export default store;
