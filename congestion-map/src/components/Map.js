// Map.js - With dropdown vehicle selector
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

// Compact Vehicle Type Dropdown Selector
const VehicleTypeDropdown = ({ selectedVehicles, onChange }) => {
  const vehicleTypes = [
    { id: 1, name: 'Cars, Pickups & Vans', peakFee: 9.00 },
    { id: 2, name: 'Single-Unit Trucks', peakFee: 14.40 },
    { id: 3, name: 'Multi-Unit Trucks', peakFee: 21.60 },
    { id: 4, name: 'Buses', peakFee: 14.40 },
    { id: 5, name: 'Motorcycles', peakFee: 4.50 },
    { id: 6, name: 'Taxi/FHV', peakFee: 0.75 },
    { id: 7, name: 'Subway', peakFee: 0 }
  ];

  const toggleVehicle = (id) => {
    if (selectedVehicles.includes(id)) {
      onChange(selectedVehicles.filter(vehicleId => vehicleId !== id));
    } else {
      onChange([...selectedVehicles, id]);
    }
  };

  const handleSelectAll = () => {
    onChange(vehicleTypes.map(v => v.id));
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium min-w-[80px]">Vehicle Types:</label>
      <div className="relative flex-grow">
        <div className="flex flex-wrap gap-1 border border-gray-300 rounded-md p-2 bg-white min-h-[36px]">
          {selectedVehicles.length === 0 && (
            <span className="text-sm text-gray-500">None selected</span>
          )}
          {selectedVehicles.map(id => {
            const vehicle = vehicleTypes.find(v => v.id === id);
            return (
              <span key={id} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full flex items-center">
                {vehicle?.name}
                <button 
                  className="ml-1 text-blue-500 hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVehicle(id);
                  }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <div className="absolute right-2 top-2 flex">
          <button
            className="text-xs text-gray-500 hover:text-gray-700 ml-2"
            onClick={handleSelectAll}
          >
            All
          </button>
          <span className="text-gray-300 mx-1">|</span>
          <button
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={handleSelectNone}
          >
            None
          </button>
        </div>
        <div className="absolute left-0 top-full mt-1 w-full z-50">
          <div className="hidden group-focus-within:block bg-white border border-gray-300 shadow-lg rounded-md p-2 max-h-48 overflow-y-auto">
            {vehicleTypes.map(vehicle => (
              <label key={vehicle.id} className="flex items-center p-1 hover:bg-gray-100 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedVehicles.includes(vehicle.id)}
                  onChange={() => toggleVehicle(vehicle.id)}
                  className="mr-2"
                />
                <span className="text-sm">{vehicle.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="relative group">
        <button className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white hover:bg-gray-50">
          Select
        </button>
        <div className="hidden group-hover:block absolute left-0 top-full mt-1 w-48 z-50 bg-white border border-gray-300 shadow-lg rounded-md p-2 max-h-48 overflow-y-auto">
          {vehicleTypes.map(vehicle => (
            <label key={vehicle.id} className="flex items-center p-1 hover:bg-gray-100 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedVehicles.includes(vehicle.id)}
                onChange={() => toggleVehicle(vehicle.id)}
                className="mr-2"
              />
              <span className="text-sm">{vehicle.name}</span>
            </label>
          ))}
          <div className="border-t border-gray-200 mt-1 pt-1 flex justify-between">
            <button
              className="text-xs text-blue-500 hover:text-blue-700"
              onClick={handleSelectAll}
            >
              Select All
            </button>
            <button
              className="text-xs text-blue-500 hover:text-blue-700"
              onClick={handleSelectNone}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Create a Redux store with immutable state checking DISABLED
const createMapStore = () => {
  return configureStore({
    reducer: {
      keplerGl: keplerGlReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Important: This disables the immutable state invariant middleware
        // that's causing the stack overflow errors
        immutableCheck: false,
        serializableCheck: false
      }).concat(taskMiddleware),
    devTools: process.env.NODE_ENV !== "production"
  });
};

// Main Map Component
function Map({ currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D, selectedVehicles: initialVehicles, onVehicleSelectionChange }) {
  // Basic state
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugMessages, setDebugMessages] = useState([]);
  const [showDebug, setShowDebug] = useState(true);
  const [mapKey, setMapKey] = useState('initial');
  const [vehicleSelection, setVehicleSelection] = useState(initialVehicles || [1, 2, 3, 4, 5, 6, 7]);
  const [currentData, setCurrentData] = useState(null);
  
  // Create a new store instance
  const [store] = useState(createMapStore);
  
  // Sync vehicle selection with parent component if provided
  useEffect(() => {
    if (initialVehicles && JSON.stringify(initialVehicles) !== JSON.stringify(vehicleSelection)) {
      setVehicleSelection(initialVehicles);
    }
  }, [initialVehicles, vehicleSelection]);

  // Update parent component when vehicle selection changes
  const handleVehicleSelectionChange = (newSelection) => {
    setVehicleSelection(newSelection);
    if (onVehicleSelectionChange) {
      onVehicleSelectionChange(newSelection);
    }
  };
  
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

  // Load data when time parameters or vehicle selection changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Get parameters for display
        const { timeHour, minutes, dayParam } = getTimeParams();
        const timeString = `${timeHour}:${minutes.toString().padStart(2, '0')}`;
        
        addDebug(`Loading data for time: ${timeString} day: ${dayParam} with vehicles: ${vehicleSelection.join(', ')}`);
        
        // Create layers and datasets array
        const datasets = [];
        const layers = [];
        
        // Determine if we're showing subway data (vehicle type 7)
        const showSubwayData = vehicleSelection.includes(7);
        
        // Add subway data if selected
        if (showSubwayData) {
          try {
            // Try to fetch from API
            const apiUrl = `http://localhost:8080/api/ridership-predictions?time=${timeHour}:${minutes.toString().padStart(2, '0')}&day=${dayParam}`;
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
              
              // Fallback subway station data
              const timeFactor = (timeHour % 24) / 24;  // 0 to 1 based on hour
              subwayData = [
                {
                  "latitude": 40.76266,
                  "longitude": -73.967258,
                  "ridership_pred": 818.0 * (0.7 + 0.6 * timeFactor),
                  "station": "Lexington Av/59 St"
                },
                {
                  "latitude": 40.764811,
                  "longitude": -73.973347,
                  "ridership_pred": 159.0 * (0.5 + 1.0 * timeFactor),
                  "station": "5 Av/59 St"
                },
                {
                  "latitude": 40.764664,
                  "longitude": -73.980658,
                  "ridership_pred": 148.03 * (0.8 + 0.4 * timeFactor),
                  "station": "57 St-7 Av"
                },
                {
                  "latitude": 40.759901,
                  "longitude": -73.984139,
                  "ridership_pred": Math.max(0, 50 * (0.6 + 0.8 * timeFactor)),
                  "station": "49 St"
                },
                {
                  "latitude": 40.754672,
                  "longitude": -73.986754,
                  "ridership_pred": 276.0 * (0.9 + 0.2 * timeFactor),
                  "station": "Times Sq-42 St"
                },
                {
                  "latitude": 40.75529,
                  "longitude": -73.987495,
                  "ridership_pred": 276.0 * (0.7 + 0.6 * timeFactor),
                  "station": "Times Sq-42 St (2)"
                }
              ];
            }
  
            // Clean up data to fix any issues
            const cleanedSubwayData = subwayData.map(item => ({
              ...item,
              // Ensure ridership is never negative (causes visualization issues)
              ridership_pred: item.ridership_pred < 0 ? 0 : item.ridership_pred
            }));
            
            // Store the current data for statistics
            setCurrentData(cleanedSubwayData);
            
            // Create subway dataset
            const subwayDatasetId = `subway-data-${Date.now()}`;
            datasets.push({
              info: {
                id: subwayDatasetId,
                label: `Subway Stations (${timeString})`
              },
              data: {
                fields: [
                  { name: "station", type: "string" },
                  { name: "ridership_pred", type: "real" },
                  { name: "latitude", type: "real" },
                  { name: "longitude", type: "real" }
                ],
                rows: cleanedSubwayData.map(d => [
                  d.station,
                  d.ridership_pred,
                  d.latitude,
                  d.longitude
                ])
              }
            });
            
            // Create subway layer
            layers.push({
              id: `subway-layer-${Date.now()}`,
              type: is3D ? "hexagon" : "point",
              config: {
                dataId: subwayDatasetId,
                label: "Subway Ridership",
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
                  radius: is3D ? 300 : 50,
                  fixedRadius: false,
                  opacity: 0.8,
                  outline: true,
                  thickness: 2,
                  colorRange: {
                    name: "Plasma",
                    type: "sequential",
                    category: "Sequential",
                    colors: ["#0d0887", "#5302a3", "#8b0aa5", "#b83289", "#db5c68", "#f48849", "#febd2a", "#f0f921"]
                  },
                  filled: true,
                  enable3d: is3D,
                  elevationScale: is3D ? 10 : 0,
                  elevationField: is3D ? {
                    name: "ridership_pred"
                  } : null
                }
              }
            });
          } catch (subwayError) {
            addDebug(`Error loading subway data: ${subwayError.message}`);
          }
        } else {
          // Clear subway data when not selected
          setCurrentData(null);
        }
        
        // Add vehicle congestion data for other vehicle types
        const showRoadVehicles = vehicleSelection.some(id => id >= 1 && id <= 6);
        
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
              { name: "Hugh L. Carey Tunnel", lat: 40.6901, lng: -74.0091 }
            ];
            
            // Generate volume data for each selected vehicle type
            const vehicleData = [];
            const timeFactor = (timeHour % 24) / 24;
            const isPeak = (timeHour >= 7 && timeHour <= 10) || (timeHour >= 16 && timeHour <= 19);
            
            // Only generate data for entry points, not default points
            congestionPoints.forEach(point => {
              // Base volume that varies by time of day
              const baseHourlyFactor = Math.sin((timeHour / 24) * Math.PI * 2) * 0.5 + 0.5;
              const baseVolume = Math.round(1000 * baseHourlyFactor);
              
              vehicleSelection.forEach(vehicleId => {
                if (vehicleId >= 1 && vehicleId <= 6) {
                  // Skip subway
                  const vehicleTypeName = getVehicleTypeName(vehicleId);
                  const volumeMultiplier = getVehicleVolumeMultiplier(vehicleId);
                  const volume = Math.round(baseVolume * volumeMultiplier * (0.7 + Math.random() * 0.6));
                  
                  vehicleData.push({
                    entry_point: point.name,
                    vehicle_type: vehicleTypeName,
                    vehicle_id: vehicleId,
                    latitude: point.lat,
                    longitude: point.lng,
                    volume: volume,
                    is_peak: isPeak,
                    toll_fee: isPeak ? getPeakFee(vehicleId) : getOvernightFee(vehicleId)
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
                  label: `Vehicle Traffic (${timeString})`
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
                    { name: "toll_fee", type: "real" }
                  ],
                  rows: vehicleData.map(d => [
                    d.entry_point,
                    d.vehicle_type,
                    d.vehicle_id,
                    d.latitude,
                    d.longitude,
                    d.volume,
                    d.is_peak,
                    d.toll_fee
                  ])
                }
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
                    lng: "longitude"
                  },
                  isVisible: true,
                  colorField: {
                    name: "volume",
                    type: "integer"
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
                      colors: ["#440154", "#482878", "#3e4989", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde725"]
                    },
                    filled: true,
                    enable3d: is3D,
                    elevationScale: is3D ? 5 : 0,
                    elevationField: is3D ? {
                      name: "volume"
                    } : null
                  }
                }
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
            filters: []
          },
          mapState: {
            bearing: is3D ? 24 : 0,
            pitch: is3D ? 50 : 0,
            latitude: 40.7128,
            longitude: -74.006,
            zoom: 11.5,
            dragRotate: is3D
          },
          mapStyle: {
            styleType: "light"
          }
        };
        
        // Only dispatch if we have datasets to show
        if (datasets.length > 0) {
          // Dispatch data to Kepler.gl
          store.dispatch(
            addDataToMap({
              datasets,
              options: { centerMap: true },
              config
            })
          );
          
          addDebug(`Map updated with ${datasets.length} datasets for time: ${timeString}`);
        } else {
          addDebug('No vehicle types selected - map is empty');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading map data:", err);
        setError(`Failed to load map data: ${err.message}`);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [getTimeParams, is3D, vehicleSelection, addDebug, store]);

  // Handle 3D mode changes
  useEffect(() => {
    // Force component recreation when 3D mode changes
    setMapKey(`map-${Date.now()}`);
  }, [is3D]);

  // Render the map component
  return (
    <Provider store={store}>
      <div className="flex flex-col h-full">
        {/* Vehicle selector dropdown in header */}
        <div className="bg-white p-2 border-b border-gray-200">
          <VehicleTypeDropdown 
            selectedVehicles={vehicleSelection}
            onChange={handleVehicleSelectionChange}
          />
        </div>
        
        {/* Map area */}
        <div className="relative flex-grow" ref={containerRef}>
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
          
          {/* Subway Data Statistics - only shown when subway is selected */}
          {currentData && vehicleSelection.includes(7) && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64 z-10">
              <h3 className="font-semibold mb-2">Subway Statistics</h3>
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
      </div>
    </Provider>
  );
}

// Helper functions for vehicle data
function getVehicleTypeName(id) {
  const types = {
    1: 'Cars, Pickups & Vans',
    2: 'Single-Unit Trucks',
    3: 'Multi-Unit Trucks',
    4: 'Buses',
    5: 'Motorcycles',
    6: 'Taxi/FHV',
    7: 'Subway'
  };
  return types[id] || 'Unknown';
}

function getVehicleVolumeMultiplier(id) {
  const multipliers = {
    1: 1.0,    // Cars are the baseline
    2: 0.25,   // Fewer trucks than cars
    3: 0.1,    // Even fewer multi-unit trucks
    4: 0.15,   // Buses are relatively rare
    5: 0.2,    // Motorcycles are less common
    6: 0.5     // Taxis are common but less than cars
  };
  return multipliers[id] || 1.0;
}

function getPeakFee(id) {
  const fees = {
    1: 9.00,
    2: 14.40,
    3: 21.60,
    4: 14.40,
    5: 4.50,
    6: 0.75,
    7: 0
  };
  return fees[id] || 0;
}

function getOvernightFee(id) {
  const fees = {
    1: 2.25,
    2: 3.60,
    3: 5.40,
    4: 3.60,
    5: 1.05,
    6: 0.75,
    7: 0
  };
  return fees[id] || 0;
}

export default Map;