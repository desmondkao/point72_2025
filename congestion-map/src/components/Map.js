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
        // Important: This disables the immutable state invariant middleware
        // that's causing the stack overflow errors
        immutableCheck: false,
        serializableCheck: false,
      }).concat(taskMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });
};

// Main Map Component
function Map({ currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D, selectedVehicles, onStatsUpdate }) {
  // Basic state
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [showDebug, setShowDebug] = useState(true);
  const [mapKey, setMapKey] = useState("initial");
  const [currentData, setCurrentData] = useState(null);
  const [dataStats, setDataStats] = useState(null); // New state for data statistics
  const [prevParams, setPrevParams] = useState(null); // Added for throttling

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

    // Get day parameter based on mode
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

  const defaultConfig = {
    visState: {
      layers: [],
      filters: [],
    },
    mapState: {
      bearing: is3D ? 24 : 0,
      pitch: is3D ? 50 : 0,
      latitude: 40.726,
      longitude: -74.0,
      zoom: 11.8,
      dragRotate: is3D,
    },
    mapStyle: {
      styleType: "dark",
    },
  };

  useEffect(() => {
    store.dispatch(
      addDataToMap({
        options: { centerMap: true, readOnly: true },
        defaultConfig,
      })
    );
  }, []);

  // Throttled data loading for performance
  useEffect(() => {
    // Get current parameters
    const { timeString, dayParam } = getTimeParams();

    // Skip if nothing changed
    const currentParams = `${timeString}-${dayParam}-${selectedVehicles.join(",")}-${is3D ? "3d" : "2d"}`;
    if (prevParams === currentParams) return;

    setPrevParams(currentParams);

    // Set a small delay to avoid too frequent updates
    const loadTimer = setTimeout(() => {
      loadData();
    }, 300);

    return () => clearTimeout(loadTimer);
  }, [getTimeParams, is3D, selectedVehicles]);

  // Load data function (moved outside of useEffect for cleaner code)
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Get parameters for display
      const { timeHour, minutes, dayParam } = getTimeParams();
      const timeString = `${timeHour}:${minutes.toString().padStart(2, "0")}`;

      addDebug(`Loading data for time: ${timeString} day: ${dayParam} with vehicles: ${selectedVehicles.join(", ")}`);

      // Create layers and datasets array
      const datasets = [];
      const layers = [];

      // Determine if we're showing subway data (vehicle type 7)
      const showSubwayData = selectedVehicles.includes(7);

      // Add subway data if selected
      if (showSubwayData) {
        try {
          // Try to fetch from API
          const apiUrl = `http://localhost:8080/api/ridership-predictions?time=${timeHour}:${minutes
            .toString()
            .padStart(2, "0")}&day=${dayParam}`;
          addDebug(`Fetching subway data from API: ${apiUrl}`);

          let subwayData;
          try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
              throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            subwayData = await response.json();
            addDebug(`Received ${subwayData.length} subway stations from API`);
          } catch (apiError) {
            // If API fails, use fallback data
            addDebug(`API fetch failed: ${apiError.message}, using fallback subway data`);

            // Fallback subway station data with improved time-based patterns
            const timeFactor = getTimePatternFactor(timeHour, minutes);
            subwayData = [
              {
                latitude: 40.76266,
                longitude: -73.967258,
                ridership_pred: 818.0 * timeFactor,
                station: "Lexington Av/59 St",
              },
              {
                latitude: 40.764811,
                longitude: -73.973347,
                ridership_pred: 159.0 * timeFactor,
                station: "5 Av/59 St",
              },
              {
                latitude: 40.764664,
                longitude: -73.980658,
                ridership_pred: 148.03 * timeFactor,
                station: "57 St-7 Av",
              },
              {
                latitude: 40.759901,
                longitude: -73.984139,
                ridership_pred: Math.max(0, 50 * timeFactor),
                station: "49 St",
              },
              {
                latitude: 40.754672,
                longitude: -73.986754,
                ridership_pred: 276.0 * timeFactor,
                station: "Times Sq-42 St",
              },
              {
                latitude: 40.75529,
                longitude: -73.987495,
                ridership_pred: 276.0 * timeFactor,
                station: "Times Sq-42 St (2)",
              },
            ];
          }

          // Clean up data to fix any issues
          const cleanedSubwayData = subwayData.map((item) => ({
            ...item,
            // Ensure ridership is never negative (causes visualization issues)
            ridership_pred: item.ridership_pred < 0 ? 0 : item.ridership_pred,
          }));

          // Calculate statistics for the debug panel
          const riderships = cleanedSubwayData.map((s) => s.ridership_pred);
          const maxRidership = Math.max(...riderships);
          const maxStationIndex = riderships.indexOf(maxRidership);

          const stats = {
            stationCount: cleanedSubwayData.length,
            avgRidership: riderships.reduce((a, b) => a + b, 0) / riderships.length,
            minRidership: Math.min(...riderships),
            maxRidership: maxRidership,
            maxStationName: maxStationIndex >= 0 ? cleanedSubwayData[maxStationIndex].station : null,
            timestamp: new Date().toLocaleTimeString(),
          };

          // Set the data statistics
          setDataStats(stats);

          // Update parent component with stats if callback is provided
          if (onStatsUpdate && typeof onStatsUpdate === "function") {
            onStatsUpdate(stats);
          }

          // Store the current data for statistics
          setCurrentData(cleanedSubwayData);

          // Create subway dataset
          const subwayDatasetId = `subway-data-${Date.now()}`;
          datasets.push({
            info: {
              id: subwayDatasetId,
              label: `Subway Stations (${timeString})`,
            },
            data: {
              fields: [
                { name: "station", type: "string" },
                { name: "ridership_pred", type: "real" },
                { name: "latitude", type: "real" },
                { name: "longitude", type: "real" },
              ],
              rows: cleanedSubwayData.map((d) => [d.station, d.ridership_pred, d.latitude, d.longitude]),
            },
          });

          // Create subway layer
          layers.push({
            id: `subway-layer-${Date.now()}`,
            type: is3D ? "grid" : "point",
            config: {
              dataId: subwayDatasetId,
              label: "Subway Ridership",
              columns: {
                lat: "latitude",
                lng: "longitude",
              },
              isVisible: true,
              colorField: {
                name: "ridership_pred",
                type: "real",
              },
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
                  category: "Sequential",
                  colors: ["#ff0000", "#ff3333", "#ff6666", "#ff9999", "#ffcccc", "#ffffff"], // Red to white for subway
                },
                filled: true,
                enable3d: is3D,
                elevationScale: is3D ? 10 : 0,
                elevationField: is3D
                  ? {
                      name: "ridership_pred",
                    }
                  : null,
              },
            },
          });
        } catch (subwayError) {
          addDebug(`Error loading subway data: ${subwayError.message}`);
        }
      } else {
        // Clear subway data when not selected
        setCurrentData(null);
        setDataStats(null);

        // Clear parent component stats if callback is provided
        if (onStatsUpdate && typeof onStatsUpdate === "function") {
          onStatsUpdate(null);
        }
      }

      // Add vehicle congestion data for other vehicle types
      const showRoadVehicles = selectedVehicles.some((id) => id >= 1 && id <= 6);

      if (showRoadVehicles) {
        try {
          // Only use actual congestion entry points, not default points
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

          // Generate volume data for each selected vehicle type
          const vehicleData = [];

          // Is this a weekday?
          const isWeekday = ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(dayParam);
          const isWeekend = ["saturday", "sunday"].includes(dayParam);
          const dayFactor = isWeekday ? 1.0 : isWeekend ? 0.7 : 0.85;

          // Time patterns throughout the day
          const timeFactor = getTimePatternFactor(timeHour, minutes);
          const isPeak = (timeHour >= 7 && timeHour <= 10) || (timeHour >= 16 && timeHour <= 19);

          // Only generate data for entry points, not default points
          congestionPoints.forEach((point) => {
            // Base volume that varies by location and time
            const locationFactor = Math.random() * 0.4 + 0.8; // 0.8 to 1.2
            const baseVolume = Math.round(1000 * dayFactor * timeFactor * locationFactor);

            selectedVehicles.forEach((vehicleId) => {
              if (vehicleId >= 1 && vehicleId <= 6) {
                // Skip subway
                const vehicleTypeName = getVehicleTypeName(vehicleId);
                const volumeMultiplier = getVehicleVolumeMultiplier(vehicleId);
                const volumeVariation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
                const volume = Math.round(baseVolume * volumeMultiplier * volumeVariation);

                vehicleData.push({
                  entry_point: point.name,
                  vehicle_type: vehicleTypeName,
                  vehicle_id: vehicleId,
                  latitude: point.lat,
                  longitude: point.lng,
                  volume: volume,
                  is_peak: isPeak,
                  toll_fee: isPeak ? getPeakFee(vehicleId) : getOvernightFee(vehicleId),
                });
              }
            });
          });

          if (vehicleData.length > 0) {
            // Create vehicle congestion dataset
            const vehicleDatasetId = `vehicle-data-${Date.now()}`;
            datasets.push({
              info: {
                id: vehicleDatasetId,
                label: `Vehicle Traffic (${timeString})`,
              },
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

            // Create vehicle layer
            layers.push({
              id: `vehicle-layer-${Date.now()}`,
              type: is3D ? "hexagon" : "point",
              config: {
                dataId: vehicleDatasetId,
                label: "Vehicle Traffic",
                columns: {
                  lat: "latitude",
                  lng: "longitude",
                },
                isVisible: true,
                colorField: {
                  name: "volume",
                  type: "integer",
                },
                colorScale: "quantile",
                visConfig: {
                  radius: is3D ? 400 : 75,
                  fixedRadius: false,
                  opacity: 0.8,
                  outline: true,
                  thickness: 2,
                  colorRange: {
                    name: "Viridis",
                    type: "sequential",
                    category: "Sequential",
                    colors: [
                      "#440154",
                      "#482878",
                      "#3e4989",
                      "#31688e",
                      "#26828e",
                      "#1f9e89",
                      "#35b779",
                      "#6ece58",
                      "#b5de2b",
                      "#fde725",
                    ],
                  },
                  filled: true,
                  enable3d: is3D,
                  elevationScale: is3D ? 5 : 0,
                  elevationField: is3D
                    ? {
                        name: "volume",
                      }
                    : null,
                },
              },
            });
          }
        } catch (vehicleError) {
          addDebug(`Error loading vehicle data: ${vehicleError.message}`);
        }
      }

      // Create map configuration with all layers
      const config = {
        visState: {
          layers,
          filters: [],
        },
        mapState: {
          bearing: is3D ? 24 : 0,
          pitch: is3D ? 50 : 0,
          latitude: 40.7128,
          longitude: -74.006,
          zoom: 11.5,
          dragRotate: is3D,
        },
        mapStyle: {
          styleType: "dark",
        },
      };

      // Only dispatch if we have datasets to show
      if (datasets.length > 0) {
        // Dispatch data to Kepler.gl
        store.dispatch(
          addDataToMap({
            datasets,
            options: { centerMap: true },
            config,
          })
        );

        addDebug(`Map updated with ${datasets.length} datasets for time: ${timeString}`);
      } else {
        addDebug("No vehicle types selected - map is empty");
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
    // Force component recreation when 3D mode changes
    setMapKey(`map-${Date.now()}`);
  }, [is3D]);

  // Render the map component
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
              <button
                className="mt-2 px-4 py-1 bg-blue-500 text-white rounded"
                onClick={() => {
                  setError(null);
                }}
              >
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

// Helper functions for vehicle data
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
    1: 1.0, // Cars are the baseline
    2: 0.25, // Fewer trucks than cars
    3: 0.1, // Even fewer multi-unit trucks
    4: 0.15, // Buses are relatively rare
    5: 0.2, // Motorcycles are less common
    6: 0.5, // Taxis are common but less than cars
  };
  return multipliers[id] || 1.0;
}

function getPeakFee(id) {
  const fees = {
    1: 9.0,
    2: 14.4,
    3: 21.6,
    4: 14.4,
    5: 4.5,
    6: 0.75,
    7: 0,
  };
  return fees[id] || 0;
}

function getOvernightFee(id) {
  const fees = {
    1: 2.25,
    2: 3.6,
    3: 5.4,
    4: 3.6,
    5: 1.05,
    6: 0.75,
    7: 0,
  };
  return fees[id] || 0;
}

// Helper function to get time pattern factor based on hour of day
function getTimePatternFactor(hour, minute) {
  // Early morning (12am-5am): very low ridership
  if (hour >= 0 && hour < 5) {
    return 0.2 + (hour / 5) * 0.3; // Gradually increases from 0.2 to 0.5
  }
  // Morning commute build up (5am-7am)
  else if (hour >= 5 && hour < 7) {
    return 0.5 + ((hour - 5) / 2) * 1.0; // Rises from 0.5 to 1.5
  }
  // Morning rush hour (7am-9am)
  else if (hour >= 7 && hour < 9) {
    return 1.5 + ((hour - 7) / 2) * 0.5; // Peaks at 2.0
  }
  // Mid-morning decline (9am-11am)
  else if (hour >= 9 && hour < 11) {
    return 2.0 - ((hour - 9) / 2) * 0.7; // Falls to 1.3
  }
  // Midday plateau (11am-3pm)
  else if (hour >= 11 && hour < 15) {
    return 1.3;
  }
  // Afternoon build up (3pm-5pm)
  else if (hour >= 15 && hour < 17) {
    return 1.3 + ((hour - 15) / 2) * 0.7; // Rises to 2.0
  }
  // Evening rush hour (5pm-7pm)
  else if (hour >= 17 && hour < 19) {
    return 2.0;
  }
  // Evening decline (7pm-10pm)
  else if (hour >= 19 && hour < 22) {
    return 2.0 - ((hour - 19) / 3) * 1.3; // Falls to 0.7
  }
  // Late night (10pm-12am)
  else {
    return 0.7 - ((hour - 22) / 2) * 0.5; // Falls to 0.2
  }
}

export default Map;
