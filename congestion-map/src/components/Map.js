// Map.js - Connected to real API data
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { taskMiddleware } from "react-palm/tasks";
import { KeplerGl } from "@kepler.gl/components";
import { keplerGlReducer } from "@kepler.gl/reducers";
import { addDataToMap } from "@kepler.gl/actions";

// Debug panel
const DebugPanel = ({ messages }) => (
  <div className="absolute top-2 left-2 bg-white p-3 rounded shadow-md z-50 max-w-md max-h-96 overflow-auto text-xs">
    <h3 className="font-bold mb-2">Debug Info:</h3>
    <div className="space-y-1">
      {messages.map((msg, idx) => (
        <div key={idx} className="border-b border-gray-200 pb-1">
          <span className="font-mono">{msg}</span>
        </div>
      ))}
    </div>
  </div>
);

// Create a single store instance
const KEPLER_GL_NAME = 'map1';
const store = configureStore({
  reducer: {
    keplerGl: keplerGlReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false
    }).concat(taskMiddleware),
  devTools: process.env.NODE_ENV !== "production"
});

// Main Map Component
function Map({ currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D, selectedVehicles }) {
  // Basic state
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [showDebug, setShowDebug] = useState(true);
  const [currentData, setCurrentData] = useState(null);
  
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
          height: containerRef.current.clientHeight
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
    let dayParam = '';
    
    if (timeMode === 'specificDay') {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      dayParam = dayNames[specificDate.getDay()];
    } else if (timeMode === 'dayPattern') {
      dayParam = dayPattern.toLowerCase();
    } else if (timeMode === 'aggregate') {
      dayParam = aggregateType.toLowerCase();
    }
    
    return { 
      timeHour, 
      minutes,
      timeString: `${timeHour}:${minutes.toString().padStart(2, '0')}`,
      dayParam
    };
  }, [currentTime, timeMode, specificDate, dayPattern, aggregateType]);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Get parameters for API request
        const { timeHour, minutes, dayParam } = getTimeParams();
        const apiUrl = `http://localhost:8080/api/ridership-predictions?time=${timeHour}:${minutes.toString().padStart(2, '0')}&day=${dayParam}`;
        
        addDebug(`Fetching data from API: ${apiUrl}`);
        
        // Try to fetch from API
        let data;
        try {
          const response = await fetch(apiUrl);
          if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
          }
          data = await response.json();
          addDebug(`Received ${data.length} records from API`);
        } catch (apiError) {
          // If API fails, use the data from the document as fallback
          addDebug(`API fetch failed: ${apiError.message}, using fallback data`);
          
          // Sample of data from your document
          data = [
            {
              "latitude": 40.76266,
              "longitude": -73.967258,
              "ridership_pred": 818.0,
              "station": "Lexington Av/59 St"
            },
            {
              "latitude": 40.764811,
              "longitude": -73.973347,
              "ridership_pred": 159.0,
              "station": "5 Av/59 St"
            },
            {
              "latitude": 40.764664,
              "longitude": -73.980658,
              "ridership_pred": 148.03,
              "station": "57 St-7 Av"
            },
            {
              "latitude": 40.759901,
              "longitude": -73.984139,
              "ridership_pred": 0, // Changed negative value to 0
              "station": "49 St"
            },
            {
              "latitude": 40.754672,
              "longitude": -73.986754,
              "ridership_pred": 276.0,
              "station": "Times Sq-42 St"
            }
            // Add more stations as needed
          ];
        }
        
        // Clean up data to fix any issues
        const cleanedData = data.map(item => ({
          ...item,
          // Ensure ridership is never negative (causes visualization issues)
          ridership_pred: item.ridership_pred < 0 ? 0 : item.ridership_pred
        }));
        
        // Store the current data
        setCurrentData(cleanedData);
        
        // Format for Kepler.gl
        const dataset = {
          info: {
            id: `data-${Date.now()}`, // Use timestamp to ensure unique ID
            label: `Subway Data (${timeHour}:${minutes.toString().padStart(2, '0')})`
          },
          data: {
            fields: [
              { name: "station", type: "string" },
              { name: "ridership_pred", type: "real" },
              { name: "latitude", type: "real" },
              { name: "longitude", type: "real" }
            ],
            rows: cleanedData.map(d => [
              d.station,
              d.ridership_pred,
              d.latitude,
              d.longitude
            ])
          }
        };
        
        // Create map configuration - safe 2D mode only for now
        const config = {
          visState: {
            layers: [
              {
                id: `stations-${Date.now()}`,
                type: "point",
                config: {
                  dataId: dataset.info.id,
                  label: "Subway Stations",
                  columns: {
                    lat: "latitude",
                    lng: "longitude"
                  },
                  isVisible: true,
                  colorField: {
                    name: "ridership_pred",
                    type: "real"
                  },
                  colorScale: "quantile",
                  visConfig: {
                    radius: 50,
                    fixedRadius: false,
                    opacity: 0.8,
                    outline: true,
                    thickness: 2,
                    colorRange: {
                      name: "Global Warming",
                      type: "sequential",
                      category: "Sequential",
                      colors: ["#FFC300", "#FF5733", "#C70039", "#900C3F", "#581845"]
                    },
                    filled: true
                  }
                }
              }
            ]
          },
          mapState: {
            latitude: 40.7128,
            longitude: -74.006,
            zoom: 11.5
          },
          mapStyle: {
            styleType: "light"
          }
        };
        
        // Dispatch data to Kepler.gl
        store.dispatch(
          addDataToMap({
            datasets: [dataset],
            options: { centerMap: true },
            config
          })
        );
        
        addDebug(`Map updated for time: ${timeHour}:${minutes.toString().padStart(2, '0')}`);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading map data:", err);
        setError(`Failed to load map data: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [getTimeParams, addDebug]);

  // Render the map component
  return (
    <Provider store={store}>
      <div className="relative w-full h-full" ref={containerRef}>
        {showDebug && <DebugPanel messages={debugMessages} />}

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
        
        {is3D && (
          <div className="absolute top-20 left-2 bg-yellow-100 p-3 rounded shadow-md z-50 border border-yellow-400">
            <p className="text-yellow-800 font-medium">
              3D mode is currently disabled to prevent browser crashes.
            </p>
          </div>
        )}

        <KeplerGl
          id={KEPLER_GL_NAME}
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
        
        {/* Data Statistics */}
        {currentData && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64 z-10">
            <h3 className="font-semibold mb-2">Station Statistics</h3>
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium">Stations:</span> {currentData.length}
              </p>
              <p>
                <span className="font-medium">Avg Ridership:</span> {
                  (currentData.reduce((sum, item) => sum + item.ridership_pred, 0) / currentData.length).toFixed(1)
                }
              </p>
              <p>
                <span className="font-medium">Max Ridership:</span> {
                  Math.max(...currentData.map(item => item.ridership_pred)).toFixed(1)
                }
              </p>
              <p>
                <span className="font-medium">Min Ridership:</span> {
                  Math.min(...currentData.map(item => item.ridership_pred)).toFixed(1)
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </Provider>
  );
}

export default Map;