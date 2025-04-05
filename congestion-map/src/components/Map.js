// Map.js - Connected to real API data
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { taskMiddleware } from "react-palm/tasks";
import { KeplerGl } from "@kepler.gl/components";
import { keplerGlReducer } from "@kepler.gl/reducers";
import { addDataToMap } from "@kepler.gl/actions";

// Debug panel - Updated to show data statistics
const DebugPanel = ({ messages, dataStats }) => (
  <div className="absolute top-2 left-2 bg-white p-3 rounded shadow-md z-50 max-w-md max-h-96 overflow-auto text-xs">
    <h3 className="font-bold mb-2">Debug Info:</h3>

    {dataStats && (
      <div className="mb-2 p-2 bg-blue-50 rounded">
        <h4 className="font-semibold">Data Statistics:</h4>
        <div className="grid grid-cols-2 gap-1">
          <div>Stations:</div>
          <div>{dataStats.stationCount}</div>

          <div>Avg Ridership:</div>
          <div>{dataStats.avgRidership?.toFixed(2)}</div>

          <div>Min Ridership:</div>
          <div>{dataStats.minRidership?.toFixed(2)}</div>

          <div>Max Ridership:</div>
          <div>{dataStats.maxRidership?.toFixed(2)}</div>

          {dataStats.maxStationName && (
            <>
              <div>Peak Station:</div>
              <div>{dataStats.maxStationName}</div>
            </>
          )}

          {dataStats.busiestEntry && (
            <>
              <div>Busiest Entry:</div>
              <div>{dataStats.busiestEntry}</div>
            </>
          )}
          {dataStats.leastBusyEntry && (
            <>
              <div>Least Busy Entry:</div>
              <div>{dataStats.leastBusyEntry}</div>
            </>
          )}
        </div>
      </div>
    )}

    <div className="space-y-1">
      {messages.map((msg, idx) => (
        <div key={idx} className="border-b border-gray-200 pb-1">
          <span className="font-mono">{msg}</span>
        </div>
      ))}
    </div>
  </div>
);

const customReducer = keplerGlReducer.initialState({
  uiState: {
    currentModal: null,
  },
});

// Create a Redux store with immutable state checking DISABLED
const createMapStore = () => {
  return configureStore({
    reducer: {
      keplerGl: customReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        serializableCheck: false,
      }).concat(taskMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });
};

// Minimal defaultConfig for initial dispatch
const defaultConfig = {
  visState: { layers: [], filters: [] },
  mapState: {
    bearing: 0,
    pitch: 0,
    latitude: 40.726,
    longitude: -74.0,
    zoom: 11.8,
    dragRotate: false,
  },
  mapStyle: { styleType: "dark" },
};

// Main Map Component
function Map({
  currentTime,
  timeMode,
  specificDate,
  dayPattern,
  aggregateType,
  is3D,
  selectedVehicles,
  onStatsUpdate,
  customDatasets = [],
}) {
  // Basic state
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [showDebug, setShowDebug] = useState(true);
  const [mapKey, setMapKey] = useState("initial");
  const [currentData, setCurrentData] = useState(null);
  const [dataStats, setDataStats] = useState(null);
  const [prevParams, setPrevParams] = useState(null);

  // Create a new store instance
  const [store] = useState(createMapStore);

  // Debug logging helper
  const addDebug = useCallback((message) => {
    console.log(message);
    setDebugMessages((prev) => [...prev.slice(-19), message]);
  }, []);

  // Window resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Time parameter handling
  const getTimeParams = useCallback(() => {
    const timeHour = Math.floor(currentTime / 60);
    const minutes = currentTime % 60;
    let dayParam = "";

    if (timeMode === "specificDay") {
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      dayParam = dayNames[specificDate.getDay()];
    } else if (timeMode === "dayPattern") {
      dayParam = dayPattern.toLowerCase();
    } else if (timeMode === "aggregate") {
      dayParam = aggregateType.toLowerCase();
    }

    return {
      timeHour,
      minutes,
      timeString: `${timeHour}:${minutes.toString().padStart(2, "0")}`,
      dayParam,
    };
  }, [currentTime, timeMode, specificDate, dayPattern, aggregateType]);

  // Initial empty map
  useEffect(() => {
    store.dispatch(
      addDataToMap({
        options: { centerMap: true, readOnly: true },
        defaultConfig,
      })
    );
  }, [store]);

  // Throttled data loading for performance
  useEffect(() => {
    const { timeString, dayParam } = getTimeParams();
    const key = `${timeString}-${dayParam}-${selectedVehicles.join(",")}-${is3D ? "3d" : "2d"}`;
    if (prevParams === key) return;
    setPrevParams(key);
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [getTimeParams, is3D, selectedVehicles]);

  // Load data function
  const loadData = async () => {
    try {
      setIsLoading(true);

      const { timeHour, minutes, timeString, dayParam } = getTimeParams();
      addDebug(`Loading data for time: ${timeString} day: ${dayParam}`);

      const datasets = [];
      const layers = [];

      // --- 1) SUBWAY BLOCK: compute subwayStats, add layer ---
      let subwayStats = null;
      if (selectedVehicles.includes(7)) {
        // Fetch from API or fallback
        let subwayData;
        try {
          const apiUrl = `http://localhost:8080/api/ridership-predictions?time=${timeHour}:${minutes
            .toString()
            .padStart(2, "0")}&day=${dayParam}`;
          addDebug(`Fetching subway data from API: ${apiUrl}`);
          const response = await fetch(apiUrl);
          if (!response.ok) throw new Error(response.statusText);
          subwayData = await response.json();
        } catch (err) {
          addDebug(`API failed (${err.message}), using fallback subway data`);
          const tf = getTimePatternFactor(timeHour, minutes);
          subwayData = [
            { latitude: 40.76266, longitude: -73.967258, ridership_pred: 818.0 * tf, station: "Lexington Av/59 St" },
            { latitude: 40.764811, longitude: -73.973347, ridership_pred: 159.0 * tf, station: "5 Av/59 St" },
            { latitude: 40.764664, longitude: -73.980658, ridership_pred: 148.03 * tf, station: "57 St-7 Av" },
            { latitude: 40.759901, longitude: -73.984139, ridership_pred: Math.max(0, 50 * tf), station: "49 St" },
            { latitude: 40.754672, longitude: -73.986754, ridership_pred: 276.0 * tf, station: "Times Sq-42 St" },
            { latitude: 40.75529, longitude: -73.987495, ridership_pred: 276.0 * tf, station: "Times Sq-42 St (2)" },
          ];
        }

        // Clean and stats
        const cleanedSubway = subwayData.map((d) => ({ ...d, ridership_pred: Math.max(0, d.ridership_pred) }));
        const riderships = cleanedSubway.map((d) => d.ridership_pred);
        const maxRidership = Math.max(...riderships);
        const maxIdx = riderships.indexOf(maxRidership);

        subwayStats = {
          stationCount: cleanedSubway.length,
          avgRidership: riderships.reduce((a, b) => a + b, 0) / riderships.length,
          minRidership: Math.min(...riderships),
          maxRidership,
          maxStationName: maxIdx >= 0 ? cleanedSubway[maxIdx].station : null,
        };

        setCurrentData(cleanedSubway);

        // Dataset & layer for subway
        const subwayId = `subway-data-${Date.now()}`;
        datasets.push({
          info: { id: subwayId, label: `Subway Stations (${timeString})` },
          data: {
            fields: [
              { name: "station", type: "string" },
              { name: "ridership_pred", type: "real" },
              { name: "latitude", type: "real" },
              { name: "longitude", type: "real" },
            ],
            rows: cleanedSubway.map((d) => [d.station, d.ridership_pred, d.latitude, d.longitude]),
          },
        });

        layers.push({
          id: `subway-layer-${Date.now()}`,
          type: is3D ? "grid" : "point",
          config: {
            dataId: subwayId,
            label: "Subway Ridership",
            columns: { lat: "latitude", lng: "longitude" },
            isVisible: true,
            colorField: { name: "ridership_pred", type: "real" },
            colorScale: "quantile",
            visConfig: {
              radius: is3D ? 300 : 50,
              fixedRadius: false,
              opacity: 0.8,
              outline: true,
              thickness: 2,
              colorRange: {
                name: "Plasma",
                type: "sequential",
                colors: ["#ff0000", "#ff3333", "#ff6666", "#ff9999", "#ffcccc", "#ffffff"],
              },
              filled: true,
              enable3d: is3D,
              elevationScale: is3D ? 10 : 0,
              elevationField: is3D ? { name: "ridership_pred" } : null,
            },
          },
        });
      }

      // --- 2) ROAD VEHICLE BLOCK: compute roadStats, add layer ---
      let roadStats = {};
      const showRoad = selectedVehicles.some((id) => id >= 1 && id <= 6);
      if (showRoad) {
        const congestionPoints = [
          { name: "Holland Tunnel", lat: 40.7274, lng: -74.0066 },
          { name: "Lincoln Tunnel", lat: 40.7588, lng: -74.0014 },
          { name: "George Washington Bridge", lat: 40.8517, lng: -73.9527 },
          { name: "Queens Midtown Tunnel", lat: 40.7429, lng: -73.9421 },
          { name: "Ed Koch Queensboro Bridge", lat: 40.7568, lng: -73.9544 },
          { name: "Williamsburg Bridge", lat: 40.7134, lng: -73.9724 },
          { name: "Manhattan Bridge", lat: 40.7074, lng: -73.9903 },
          { name: "Brooklyn Bridge", lat: 40.7061, lng: -73.9969 },
          { name: "Hugh L. Carey Tunnel", lat: 40.6901, lng: -74.0091 },
        ];

        const vehicleData = [];
        const isWeekday = ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(dayParam);
        const isWeekend = ["saturday", "sunday"].includes(dayParam);
        const dayFactor = isWeekday ? 1.0 : isWeekend ? 0.7 : 0.85;
        const timeFactor = getTimePatternFactor(timeHour, minutes);
        const isPeak = (timeHour >= 7 && timeHour <= 10) || (timeHour >= 16 && timeHour <= 19);

        congestionPoints.forEach((pt) => {
          const locationFactor = Math.random() * 0.4 + 0.8;
          const baseVolume = Math.round(1000 * dayFactor * timeFactor * locationFactor);

          selectedVehicles.forEach((vid) => {
            if (vid >= 1 && vid <= 6) {
              const multiplier = getVehicleVolumeMultiplier(vid);
              const variation = 0.7 + Math.random() * 0.6;
              const volume = Math.round(baseVolume * multiplier * variation);

              vehicleData.push({
                entry_point: pt.name,
                vehicle_type: getVehicleTypeName(vid),
                vehicle_id: vid,
                latitude: pt.lat,
                longitude: pt.lng,
                volume,
                is_peak: isPeak,
                toll_fee: isPeak ? getPeakFee(vid) : getOvernightFee(vid),
              });
            }
          });
        });

        if (vehicleData.length) {
          // compute busiest and least busy
          const volumes = vehicleData.map((d) => d.volume);
          const maxVol = Math.max(...volumes);
          const minVol = Math.min(...volumes);
          const busiest = vehicleData.find((d) => d.volume === maxVol);
          const leastBusy = vehicleData.find((d) => d.volume === minVol);
          roadStats = {
            busiestEntry: busiest.entry_point,
            busiestVolume: maxVol,
            leastBusyEntry: leastBusy.entry_point,
            leastBusyVolume: minVol,
          };

          // dataset & layer
          const vid = `vehicle-data-${Date.now()}`;
          datasets.push({
            info: { id: vid, label: `Vehicle Traffic (${timeString})` },
            data: {
              fields: [
                { name: "entry_point", type: "string" },
                { name: "vehicle_type", type: "string" },
                { name: "vehicle_id", type: "integer" },
                { name: "latitude", type: "real" },
                { name: "longitude", type: "real" },
                { name: "volume", type: "integer" },
                { name: "is_peak", type: "boolean" },
                { name: "toll_fee", type: "real" },
              ],
              rows: vehicleData.map((d) => [
                d.entry_point,
                d.vehicle_type,
                d.vehicle_id,
                d.latitude,
                d.longitude,
                d.volume,
                d.is_peak,
                d.toll_fee,
              ]),
            },
          });

          layers.push({
            id: `vehicle-layer-${Date.now()}`,
            type: is3D ? "hexagon" : "point",
            config: {
              dataId: vid,
              label: "Vehicle Traffic",
              columns: { lat: "latitude", lng: "longitude" },
              isVisible: true,
              colorField: { name: "volume", type: "integer" },
              colorScale: "quantile",
              visConfig: {
                radius: is3D ? 400 : 75,
                fixedRadius: false,
                opacity: 0.8,
                outline: true,
                thickness: 2,
                colorRange: {
                  name: "CustomBlue",
                  type: "sequential",
                  colors: ["#ffffff", "#ccccff", "#9999ff", "#6666ff", "#3333ff", "#0000ff"],
                },
                filled: true,
                enable3d: is3D,
                elevationScale: is3D ? 5 : 0,
                elevationField: is3D ? { name: "volume" } : null,
              },
            },
          });
        }
      }

      // --- 3) DISPATCH TO KEPLER ---
      const config = {
        visState: { layers, filters: [] },
        mapState: {
          bearing: is3D ? 24 : 0,
          pitch: is3D ? 50 : 0,
          latitude: 40.7128,
          longitude: -74.006,
          zoom: 11.5,
          dragRotate: is3D,
        },
        mapStyle: { styleType: "dark" },
      };

      if (datasets.length) {
        store.dispatch(addDataToMap({ datasets, options: { centerMap: true }, config }));
        addDebug(`Map updated with ${datasets.length} datasets`);
      } else {
        addDebug("No vehicle types selected - map is empty");
      }

      // <<< STATS MERGE: combine subwayStats + roadStats and push once >>>
      const finalStats = { ...(subwayStats || {}), ...roadStats };
      setDataStats(finalStats);
      if (onStatsUpdate) onStatsUpdate(finalStats);

      if (customDatasets.length > 0) {
        customDatasets.forEach((customData) => {
          const datasetId = `custom-${customData.id}-${Date.now()}`;

          datasets.push({
            info: {
              id: datasetId,
              label: customData.label,
            },
            data: customData.data,
          });

          layers.push({
            id: `custom-layer-${customData.id}-${Date.now()}`,
            type: customData.visualConfig?.type || "point",
            config: {
              dataId: datasetId,
              label: customData.label,
              columns: {
                lat: customData.data.fields.find((f) => f.name.includes("lat"))?.name || "latitude",
                lng: customData.data.fields.find((f) => f.name.includes("lon"))?.name || "longitude",
              },
              isVisible: true,
              colorField: customData.visualConfig?.colorField
                ? {
                    name: customData.visualConfig.colorField,
                    type: "real",
                  }
                : null,
              colorScale: "quantile",
              visConfig: {
                radius: customData.visualConfig?.radius || 50,
                fixedRadius: false,
                opacity: 0.8,
                outline: true,
                thickness: 2,
                colorRange: {
                  colors: customData.visualConfig?.colorRange || ["#FFB6C1", "#FF69B4", "#FF1493"],
                },
                filled: true,
                enable3d: customData.visualConfig?.enable3d || false,
                elevationScale: customData.visualConfig?.enable3d ? 5 : 0,
              },
            },
          });
        });
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading map data:", err);
      setError(`Failed to load map data: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Handle 3D mode changes
  useEffect(() => {
    setMapKey(`map-${Date.now()}`);
  }, [is3D]);

  // Render
  return (
    <Provider store={store}>
      <div className="relative w-full h-full" ref={containerRef}>
        {showDebug && <DebugPanel messages={debugMessages} dataStats={dataStats} />}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-50">
            <div className="p-4 bg-white rounded shadow">
              <p>Loading map data...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-50">
            <div className="p-4 bg-white rounded shadow border border-red-500">
              <p className="text-red-500">{error}</p>
              <button className="mt-2 px-4 py-1 bg-blue-500 text-white rounded" onClick={() => setError(null)}>
                Try Again
              </button>
            </div>
          </div>
        )}
        <KeplerGl
          id="dynamic_map"
          key={mapKey}
          mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_API_KEY}
          width={dimensions.width}
          height={dimensions.height}
        />
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="absolute bottom-4 left-4 bg-white px-3 py-1 text-xs shadow rounded z-50"
        >
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
      </div>
    </Provider>
  );
}

// Helper functions
function getVehicleTypeName(id) {
  const types = {
    1: "Cars, Pickups & Vans",
    2: "Single-Unit Trucks",
    3: "Multi-Unit Trucks",
    4: "Buses",
    5: "Motorcycles",
    6: "Taxi/FHV",
    7: "Subway",
  };
  return types[id] || "Unknown";
}

function getVehicleVolumeMultiplier(id) {
  const multipliers = {
    1: 1.0,
    2: 0.25,
    3: 0.1,
    4: 0.15,
    5: 0.2,
    6: 0.5,
  };
  return multipliers[id] || 1.0;
}

function getPeakFee(id) {
  const fees = { 1: 9.0, 2: 14.4, 3: 21.6, 4: 14.4, 5: 4.5, 6: 0.75, 7: 0 };
  return fees[id] || 0;
}

function getOvernightFee(id) {
  const fees = { 1: 2.25, 2: 3.6, 3: 5.4, 4: 3.6, 5: 1.05, 6: 0.75, 7: 0 };
  return fees[id] || 0;
}

function getTimePatternFactor(hour, minute) {
  if (hour < 5) return 0.2 + (hour / 5) * 0.3;
  if (hour < 7) return 0.5 + ((hour - 5) / 2) * 1.0;
  if (hour < 9) return 1.5 + ((hour - 7) / 2) * 0.5;
  if (hour < 11) return 2.0 - ((hour - 9) / 2) * 0.7;
  if (hour < 15) return 1.3;
  if (hour < 17) return 1.3 + ((hour - 15) / 2) * 0.7;
  if (hour < 19) return 2.0;
  if (hour < 22) return 2.0 - ((hour - 19) / 3) * 1.3;
  return 0.7 - ((hour - 22) / 2) * 0.5;
}

export default Map;
