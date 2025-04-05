import React, { useEffect, useState, useCallback } from "react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { taskMiddleware } from "react-palm/tasks";
import { keplerGlReducer } from "kepler.gl/reducers";
import KeplerGl from "kepler.gl";
import { addDataToMap } from "kepler.gl/actions";

// Create the store
const store = configureStore({
  reducer: {
    keplerGl: keplerGlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(taskMiddleware),
  devTools: process.env.NODE_ENV !== "production",
});

function Map({ currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D }) {
  const [data, setData] = useState(null);
  const [mapConfig, setMapConfig] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const processCSVData = (csvData) => {
    // Parse CSV to array of objects
    const lines = csvData.split("\n");
    const headers = lines[0].split(",").map((header) => header.trim());
    const parsedData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(",");
      const entry = {};
      for (let j = 0; j < headers.length; j++) {
        entry[headers[j]] = values[j];
      }
      // Ensure latitude and longitude are numbers
      if (entry.Latitude && entry.Longitude) {
        entry.Latitude = parseFloat(entry.Latitude);
        entry.Longitude = parseFloat(entry.Longitude);
        parsedData.push(entry);
      }
    }
    return parsedData;
  };

  // Memoize the filter function to prevent it from changing on every render
  const filterDataByTimeSelections = useCallback((data) => {
    if (!data) return data;
    
    // Format the time for comparison (from minutes to hour)
    const timeHour = Math.floor(currentTime / 60);
    
    console.log("Filtering data with:", { 
      timeMode, 
      specificDate: timeMode === "specificDay" ? specificDate : null,
      dayPattern: timeMode === "dayPattern" ? dayPattern : null,
      aggregateType: timeMode === "aggregate" ? aggregateType : null,
      timeHour 
    });
    
    // For now, return data unmodified.
    // You can extend this function to filter `data.data.rows` as needed.
    return data;
  }, [currentTime, timeMode, specificDate, dayPattern, aggregateType]);

  useEffect(() => {
    // Fetch sample CSV data - in a real application, fetch from an API
    fetch("/sample-toll-data.csv")
      .then((response) => response.text())
      .then((csvData) => {
        const parsedData = processCSVData(csvData);

        // Format data for Kepler.gl
        const dataset = {
          info: {
            label: "NYC Toll Data",
            id: "toll_data",
          },
          data: {
            fields: [
              { name: "Toll Date", format: "", type: "string" },
              { name: "Toll Hour", format: "", type: "integer" },
              { name: "Toll 10 Minute Block", format: "", type: "integer" },
              { name: "Minute of Hour", format: "", type: "integer" },
              { name: "Hour of Day", format: "", type: "integer" },
              { name: "Day of Week", format: "", type: "string" },
              { name: "Int Day of Week", format: "", type: "integer" },
              { name: "Toll Week", format: "", type: "integer" },
              { name: "Time Period", format: "", type: "string" },
              { name: "Vehicle Class", format: "", type: "string" },
              { name: "Detection Group", format: "", type: "string" },
              { name: "Detection Region", format: "", type: "string" },
              { name: "CRZ Entries", format: "", type: "integer" },
              { name: "Excluded Roadway Entries", format: "", type: "integer" },
              { name: "Latitude", format: "", type: "real" },
              { name: "Longitude", format: "", type: "real" },
            ],
            rows: parsedData.map((item) => [
              item["Toll Date"],
              parseInt(item["Toll Hour"]),
              parseInt(item["Toll 10 Minute Block"]),
              parseInt(item["Minute of Hour"]),
              parseInt(item["Hour of Day"]),
              item["Day of Week"],
              parseInt(item["Int Day of Week"]),
              parseInt(item["Toll Week"]),
              item["Time Period"],
              item["Vehicle Class"],
              item["Detection Group"],
              item["Detection Region"],
              parseInt(item["CRZ Entries"]),
              parseInt(item["Excluded Roadway Entries"]),
              item.Latitude,
              item.Longitude,
            ]),
          },
        };

        setData(dataset);
        setIsLoading(false);

        // Initial map configuration
        const mapConfig = {
          visState: {
            filters: [],
            layers: [
              {
                id: "toll-points",
                type: "point",
                config: {
                  dataId: "toll_data",
                  label: "Toll Points",
                  color: [255, 153, 31],
                  columns: {
                    lat: "Latitude",
                    lng: "Longitude",
                  },
                  isVisible: true,
                  visConfig: {
                    radius: 10,
                    fixedRadius: false,
                    opacity: 0.8,
                    outline: false,
                    thickness: 2,
                    colorRange: {
                      name: "Global Warming",
                      type: "sequential",
                      category: "Uber",
                      colors: [
                        "#5A1846",
                        "#900C3F",
                        "#C70039",
                        "#E3611C",
                        "#F1920E",
                        "#FFC300",
                      ],
                    },
                    radiusRange: [0, 50],
                    filled: true,
                  },
                },
                visualChannels: {
                  colorField: {
                    name: "CRZ Entries",
                    type: "integer",
                  },
                  colorScale: "quantile",
                  sizeField: {
                    name: "CRZ Entries",
                    type: "integer",
                  },
                  sizeScale: "sqrt",
                },
              },
            ],
            interactionConfig: {
              tooltip: {
                fieldsToShow: {
                  toll_data: [
                    "Toll Date",
                    "Toll Hour",
                    "Vehicle Class",
                    "CRZ Entries",
                    "Detection Region",
                  ],
                },
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
          mapStyle: {
            styleType: "dark",
            topLayerGroups: {},
            visibleLayerGroups: {
              label: true,
              road: true,
              border: false,
              building: true,
              water: true,
              land: true,
            },
            buildingLayer: {
              color: [255, 255, 255],
              opacity: is3D ? 0.7 : 0.1,
            },
          },
        };

        setMapConfig(mapConfig);
      })
      .catch((error) => {
        console.error("Error loading data:", error);
        setIsLoading(false);
      });
  }, [is3D]);

  // Update the map when time selections change
  useEffect(() => {
    if (data) {
      const filteredData = filterDataByTimeSelections(data);
      const updatedMapConfig = {
        ...mapConfig,
        mapState: {
          ...mapConfig.mapState,
          bearing: is3D ? 24 : 0,
          dragRotate: is3D,
          pitch: is3D ? 40 : 0,
        },
        mapStyle: {
          ...mapConfig.mapStyle,
          buildingLayer: {
            ...mapConfig.mapStyle?.buildingLayer,
            opacity: is3D ? 0.7 : 0.1,
          },
        },
      };

      store.dispatch(
        addDataToMap({
          datasets: [filteredData || data],
          option: {
            centerMap: false,
            readOnly: false,
          },
          config: updatedMapConfig,
        })
      );
    }
  }, [data, mapConfig, currentTime, timeMode, specificDate, dayPattern, aggregateType, is3D, filterDataByTimeSelections]);

  return (
    <Provider store={store}>
      <div className="relative w-full h-full">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="p-4 bg-white rounded-lg shadow-md">
              <p className="text-lg font-medium text-gray-800">
                Loading NYC Toll Data...
              </p>
            </div>
          </div>
        ) : (
          <KeplerGl
            id="nyc-toll-map"
            mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_API_KEY}
            width="100%"
            height="100%"
            appName="NYC Congestion Map"
          />
        )}
      </div>
    </Provider>
  );
}

export default Map;
