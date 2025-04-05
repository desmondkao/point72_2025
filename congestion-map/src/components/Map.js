import React, { useEffect, useState, useCallback, useRef } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { taskMiddleware } from "react-palm/tasks";

import { keplerGlReducer } from "kepler.gl/reducers";
import KeplerGl from "kepler.gl";
import { addDataToMap } from "kepler.gl/actions";

import mapboxgl from 'mapbox-gl';
console.log("ENV token:", process.env.REACT_APP_MAPBOX_API_KEY);
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_API_KEY;
console.log("mapboxgl.accessToken:", mapboxgl.accessToken);

// Create the store with serializableCheck disabled to prevent Kepler warnings
const store = configureStore({
  reducer: {
    keplerGl: keplerGlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false // Disable serializable check to prevent warnings
    }).concat(taskMiddleware),
  devTools: process.env.NODE_ENV !== "production",
});

const LIGHT_STYLE = [
  {
    id: "light-v10",
    label: "Light",
    url: "mapbox://styles/mapbox/light-v10",
    icon: null
  }
];

// Create a debug panel to display real-time debug information
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

function Map({ currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [datasets, setDatasets] = useState([]);
  const [mapConfig, setMapConfig] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [showDebug, setShowDebug] = useState(true);

  // Add a debug message
  const addDebug = useCallback((message) => {
    console.log(message); // Also log to console
    setDebugMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only the last 20 messages
      return newMessages.slice(Math.max(0, newMessages.length - 20));
    });
  }, []);

  // Get time parameters for API requests
  const getTimeParams = useCallback(() => {
    const timeHour = Math.floor(currentTime / 60);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    let dayParam = '';
    
    if (timeMode === 'specificDay') {
      const dayIndex = specificDate.getDay();
      dayParam = dayNames[dayIndex];
    } else if (timeMode === 'dayPattern') {
      dayParam = dayPattern.toLowerCase();
    } else if (timeMode === 'aggregate') {
      dayParam = aggregateType.toLowerCase();
    }
    
    return { timeHour, dayParam };
  }, [currentTime, timeMode, specificDate, dayPattern, aggregateType]);

  // Measure container dimensions for Kepler
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          setDimensions({
            width: clientWidth,
            height: clientHeight
          });
        }
      };
      
      // Initial measurement
      updateDimensions();
      
      // Listen for resize events
      window.addEventListener('resize', updateDimensions);
      
      // Clean up
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Function to create Kepler configuration for ridership data
  const createKeplerConfig = useCallback((ridershipDataset, is3D) => {
    addDebug(`Creating Kepler config with 3D mode: ${is3D}`);

    const styleConfig = {
      styleType: "custom",
      styleUrl: LIGHT_STYLE[0].url,
      topLayerGroups: {},
      visibleLayerGroups: { label:true, road:true, border:false, building:true, water:true, land:true },
      buildingLayer: { color:[255,255,255], opacity: is3D?0.7:0.1 }
    };
    console.log("Generated mapStyle in config:", styleConfig);
    
    const layers = [];
    
    // Subway color scheme - inspired by NYC subway colors
    const subwayColors = [
      "#0039A6", // MTA Blue (A, C, E)
      "#FF6319", // MTA Orange (B, D, F, M)
      "#00933C", // MTA Green (4, 5, 6)
      "#B933AD", // MTA Purple (7)
      "#FCCC0A", // MTA Yellow (N, Q, R, W)
      "#EE352E", // MTA Red (1, 2, 3)
      "#6CBE45", // MTA Lime Green (G)
      "#996633", // MTA Brown (J, Z)
      "#A7A9AC", // MTA Gray (L)
    ];
    
    if (ridershipDataset) {
      if (is3D) {
        addDebug("Adding 3D column layer for subway ridership");
        // 3D column layer for subway ridership
        layers.push({
          id: "subway-ridership-3d",
          type: "column",
          config: {
            dataId: "ridership_data",
            label: "Subway Ridership (3D)",
            columns: {
              lat: "Latitude",
              lng: "Longitude",
            },
            isVisible: true,
            visConfig: {
              opacity: 0.8,
              filled: true,
              enable3d: true,
              colorRange: {
                name: "NYC Subway Lines",
                type: "sequential",
                category: "Custom",
                colors: subwayColors
              },
              radiusRange: [5, 20],
              elevationScale: 5,
            },
            visualChannels: {
              colorField: {
                name: "ridership_pred",
                type: "real",
              },
              colorScale: "quantile",
              heightField: {
                name: "ridership_pred",
                type: "real"
              },
              heightScale: "linear",
            },
          }
        });
      } else {
        // Heatmap layer for 2D view
        addDebug("Adding 2D heatmap for subway ridership");
        layers.push({
          id: "subway-ridership-heatmap",
          type: "heatmap",
          config: {
            dataId: "ridership_data",
            label: "Subway Ridership Heatmap",
            columns: {
              lat: "Latitude",
              lng: "Longitude",
              weight: "ridership_pred"
            },
            isVisible: true,
            visConfig: {
              opacity: 0.8,
              colorRange: {
                name: "NYC Subway Heat",
                type: "sequential",
                category: "Custom",
                colors: [
                  "#FFFFFF", 
                  "#A7A9AC", // Light gray
                  "#6CBE45", // Light green
                  "#00933C", // Green
                  "#0039A6", // Blue
                  "#B933AD", // Purple
                  "#FF6319", // Orange
                  "#EE352E"  // Red
                ]
              },
              radius: 40,
              intensity: 3,
            }
          }
        });
        
        // Point layer for station locations
        addDebug("Adding station point layer");
        layers.push({
          id: "subway-stations",
          type: "point",
          config: {
            dataId: "ridership_data",
            label: "Subway Stations",
            columns: {
              lat: "Latitude",
              lng: "Longitude",
            },
            isVisible: true,
            visConfig: {
              radius: 5,
              fixedRadius: true,
              opacity: 1,
              outline: true,
              thickness: 2,
              strokeColor: [255, 255, 255],
              colorRange: {
                name: "NYC Subway",
                type: "sequential",
                category: "Custom",
                colors: subwayColors
              },
              filled: true,
            },
            visualChannels: {
              colorField: {
                name: "ridership_pred",
                type: "real",
              },
              colorScale: "quantile",
            },
          }
        });
      }
    } else {
      addDebug("Warning: No ridership dataset provided to createKeplerConfig");
    }
    
    // Create tooltip configuration
    const tooltipConfig = {
      fieldsToShow: {}
    };
    
    if (ridershipDataset) {
      tooltipConfig.fieldsToShow.ridership_data = [
        "station",
        "ridership_pred"
      ];
    }
    
    return {
      visState: {
        filters: [],
        layers: layers,
        interactionConfig: {
          tooltip: {
            ...tooltipConfig,
            enabled: true,
          },
          brush: {
            size: 0.5,
            enabled: false,
          },
          coordinate: {
            enabled: true,
          },
        },
      },
      mapState: {
        bearing: is3D ? 24 : 0,
        dragRotate: is3D,
        latitude: 40.7128,
        longitude: -74.006,
        pitch: is3D ? 40 : 0,
        zoom: 11.5,
        isSplit: false,
      },
      mapStyle: styleConfig,
    };
  }, [addDebug]);

  // Load ridership data from API
  useEffect(() => {
    const loadRidershipData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        addDebug("Starting to load ridership data...");
        const { timeHour, dayParam } = getTimeParams();
        addDebug(`Time parameters: hour=${timeHour}, day=${dayParam}`);
        
        // Fetch ridership data
        const port = 8080; // Make sure this matches your Flask port
        const url = `http://localhost:${port}/api/ridership-predictions?time=${timeHour}:00&day=${dayParam}`;
        addDebug(`Fetching from: ${url}`);
        
        const ridershipResponse = await fetch(url);
        
        addDebug(`Response status: ${ridershipResponse.status}`);
        if (!ridershipResponse.ok) {
          throw new Error(`Error fetching ridership data: ${ridershipResponse.statusText}`);
        }
        
        const ridershipData = await ridershipResponse.json();
        addDebug(`Received data for ${ridershipData.length} stations`);
        
        if (ridershipData.length === 0) {
          throw new Error("No ridership data returned from API");
        }
        
        // Log sample data
        if (ridershipData.length > 0) {
          addDebug(`Sample station data: ${JSON.stringify(ridershipData[0])}`);
        }
        
        // Format data for Kepler.gl
        const ridershipDataset = {
          info: {
            label: "NYC Subway Ridership",
            id: "ridership_data",
          },
          data: {
            fields: [
              { name: "station", format: "", type: "string" },
              { name: "ridership_pred", format: "", type: "real" },
              { name: "Latitude", format: "", type: "real" },
              { name: "Longitude", format: "", type: "real" },
            ],
            rows: ridershipData.map(item => [
              item.station,
              item.ridership_pred,
              item.latitude || item.Latitude,  // Try both capitalization options
              item.longitude || item.Longitude,
            ]),
          },
        };
        console.log("Dataset info.id:", ridershipDataset.info.id, "rows:", ridershipDataset.data.rows.length);

        addDebug(`Formatted data with ${ridershipDataset.data.rows.length} rows`);
        
        // Set datasets and generate configuration
        setDatasets([ridershipDataset]);
        const config = createKeplerConfig(ridershipDataset, is3D);
        setMapConfig(config);
        
        // Dispatch to Kepler.gl
        addDebug("Dispatching data to Kepler.gl");
        store.dispatch(
          addDataToMap({
            datasets: [ridershipDataset],
            option: {
              centerMap: true,
              readOnly: false,
            },
            config: config,
          })
        );
        
        setIsLoading(false);
        addDebug("Finished loading ridership data");
      } catch (error) {
        console.error("Error loading ridership data:", error);
        addDebug(`Error: ${error.message}`);
        setError(`Failed to load ridership data: ${error.message}`);
        setIsLoading(false);
        
        // If there's an error, try to fall back to static test data
        try {
          addDebug("Falling back to static test data");
          
          // Create static test data with NYC subway stations
          const testData = [
            {station: "Times Square-42 St", ridership_pred: 850, latitude: 40.7559, longitude: -73.9870},
            {station: "Grand Central-42 St", ridership_pred: 780, latitude: 40.7527, longitude: -73.9772},
            {station: "Union Square", ridership_pred: 650, latitude: 40.7356, longitude: -73.9910},
            {station: "34 St-Penn Station", ridership_pred: 920, latitude: 40.7506, longitude: -73.9936},
            {station: "59 St-Columbus Circle", ridership_pred: 580, latitude: 40.7682, longitude: -73.9819},
            {station: "Brooklyn Bridge-City Hall", ridership_pred: 420, latitude: 40.7132, longitude: -74.0021},
            {station: "Wall St", ridership_pred: 510, latitude: 40.7074, longitude: -74.0113},
            {station: "Canal St", ridership_pred: 610, latitude: 40.7193, longitude: -74.0000},
            {station: "14 St", ridership_pred: 550, latitude: 40.7368, longitude: -73.9971},
            {station: "96 St", ridership_pred: 480, latitude: 40.7906, longitude: -73.9722},
            {station: "125 St", ridership_pred: 520, latitude: 40.8075, longitude: -73.9454},
            {station: "72 St", ridership_pred: 490, latitude: 40.7769, longitude: -73.9820},
            {station: "West 4 St", ridership_pred: 670, latitude: 40.7322, longitude: -74.0008},
            {station: "Fulton St", ridership_pred: 730, latitude: 40.7092, longitude: -74.0076},
          ];
          
          const testDataset = {
            info: {
              label: "NYC Subway Ridership (Test Data)",
              id: "ridership_data",
            },
            data: {
              fields: [
                { name: "station", format: "", type: "string" },
                { name: "ridership_pred", format: "", type: "real" },
                { name: "Latitude", format: "", type: "real" },
                { name: "Longitude", format: "", type: "real" },
              ],
              rows: testData.map(item => [
                item.station,
                item.ridership_pred,
                item.latitude,
                item.longitude,
              ]),
            },
          };
          
          addDebug(`Created fallback dataset with ${testDataset.data.rows.length} stations`);
          setDatasets([testDataset]);
          const config = createKeplerConfig(testDataset, is3D);
          setMapConfig(config);
          
          store.dispatch(
            addDataToMap({
              datasets: [testDataset],
              option: {
                centerMap: true,
                readOnly: false,
              },
              config: config,
            })
          );
          
          // Clear error and loading state
          setError(null);
          setIsLoading(false);
          addDebug("Loaded fallback data successfully");
        } catch (fallbackError) {
          console.error("Error creating fallback data:", fallbackError);
          addDebug(`Fallback error: ${fallbackError.message}`);
        }
      }
    };
    
    loadRidershipData();
  }, [currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D, getTimeParams, createKeplerConfig, addDebug]);

  console.log("Using mapStyles override:", LIGHT_STYLE);

  return (
    <Provider store={store}>
      <div className="relative w-full h-full" ref={containerRef}>
        {showDebug && <DebugPanel messages={debugMessages} />}
        
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="p-4 bg-white rounded-lg shadow-md">
              <p className="text-lg font-medium text-gray-800">
                Loading NYC Subway Ridership Data...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="p-4 bg-white rounded-lg shadow-md border-l-4 border-red-500">
              <p className="text-lg font-medium text-gray-800">
                {error}
              </p>
              <button 
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        ) : (
          <KeplerGl
            id="nyc-subway-map"
            mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_API_KEY}
            width={dimensions.width}
            height={dimensions.height}
            appName="NYC Subway Ridership Map"
            mapStyles={LIGHT_STYLE}
            datasets={datasets}                               
            config={mapConfig}
            readOnly={false}
          />
        )}
        
        {/* Toggle debug panel button */}
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="absolute bottom-4 left-4 bg-white p-2 rounded shadow z-50 text-xs"
        >
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
      </div>
    </Provider>
  );
}

export default Map;