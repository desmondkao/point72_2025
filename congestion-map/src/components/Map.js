// App.js
import React, { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { createStore, combineReducers, applyMiddleware } from "redux";
import { taskMiddleware } from "react-palm/tasks";
import { keplerGlReducer } from "kepler.gl/reducers";
import KeplerGl from "kepler.gl";
import { addDataToMap } from "kepler.gl/actions";

// Define the reducer
const reducers = combineReducers({
  keplerGl: keplerGlReducer,
});

// Create the store
const store = createStore(reducers, {}, applyMiddleware(taskMiddleware));

function Map() {
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

  useEffect(() => {
    // Sample CSV data - in a real application, you would fetch this from an API
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
                      colors: ["#5A1846", "#900C3F", "#C70039", "#E3611C", "#F1920E", "#FFC300"],
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
                  toll_data: ["Toll Date", "Toll Hour", "Vehicle Class", "CRZ Entries", "Detection Region"],
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
            bearing: 0,
            dragRotate: true,
            latitude: 40.7128,
            longitude: -74.006,
            pitch: 40,
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
              opacity: 0.7,
            },
          },
        };

        setMapConfig(mapConfig);
      })
      .catch((error) => {
        console.error("Error loading data:", error);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (data) {
      // Dispatch action to add data to the map
      store.dispatch(
        addDataToMap({
          datasets: [data],
          option: {
            centerMap: true,
            readOnly: false,
          },
          config: mapConfig,
        })
      );
    }
  }, [data, mapConfig]);

  return (
    <Provider store={store}>
      <div className="app">
        <div className="map-container">
          {isLoading ? (
            <div className="loading">Loading NYC Toll Data...</div>
          ) : (
            <KeplerGl
              id="nyc-toll-map"
              mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_API_KEY}
              width={window.innerWidth}
              height={window.innerHeight}
            />
          )}
        </div>
      </div>
    </Provider>
  );
}

export default Map;
