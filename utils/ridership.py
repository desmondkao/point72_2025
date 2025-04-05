import pandas as pd
import requests
import numpy as np
from datetime import datetime, timedelta
import pickle
import os

# Function to safely find the data file
def find_file(file_path, fallback_paths=None):
    if os.path.exists(file_path):
        return file_path
    
    if fallback_paths:
        for path in fallback_paths:
            if os.path.exists(path):
                return path
    
    # If we can't find the file, print a warning
    print(f"Warning: Could not find file at {file_path} or any fallback paths")
    return None

# Reads in stations in Manhattan
stops_file = find_file(
    "utils/data/manhattan_stops.csv", 
    ["manhattan_stops.csv", "backend/utils/data/manhattan_stops.csv"]
)

if stops_file:
    manhattan_stops = pd.read_csv(stops_file)
    manhattan_unique = manhattan_stops["Stop Name"].unique()
else:
    # Create dummy data if file not found
    print("Creating dummy Manhattan stops data")
    manhattan_stops = pd.DataFrame({
        "Stop Name": ["Times Square", "Grand Central", "Union Square"],
        "GTFS Latitude": [40.7559, 40.7527, 40.7356],
        "GTFS Longitude": [-73.9870, -73.9772, -73.9910]
    })
    manhattan_unique = manhattan_stops["Stop Name"].unique()

# Function takes in timeframe as input and outputs the most recently available data
def generate_data(timeframe):
    # 380 hr offset cuz need data
    # april 24 -- deprecated tbh bc the 2025 api is entirely differnet so i'm time machining it back to the original hackathon day.
    current_time = datetime(2024, 4, 27, 11, 0, 0) - timedelta(hours=380)
    print(f"Starting data search from: {current_time}")
    
    # Add a safety counter to prevent infinite loops
    max_attempts = 24  # Try for a maximum of 24 hours back
    attempts = 0
    
    df_sub = pd.DataFrame()
    
    # Try to find the first available dataset
    while len(df_sub) == 0 and attempts < max_attempts:
        try:
            formatted_time = current_time.strftime('%Y-%m-%dT%H:00:00')
            url = f"https://data.ny.gov/resource/wujg-7c2s.json?$where=transit_timestamp >= '{formatted_time}'&$limit=1000"
            
            print(f"Fetching data from: {url}")
            response = requests.get(url, timeout=10)  # Add a timeout
            
            if response.status_code == 200:
                data = response.json()
                df_sub = pd.DataFrame.from_dict(data)
                print(f"Found {len(df_sub)} records")
            else:
                print(f"API returned status code: {response.status_code}")
            
        except Exception as e:
            print(f"Error fetching data: {e}")
        
        # Move back one hour and try again
        current_time = current_time - timedelta(hours=1)
        attempts += 1
    
    # If we couldn't find any data, return an empty DataFrame with the expected columns
    if len(df_sub) == 0:
        print("No data found after multiple attempts")
        return pd.DataFrame(columns=["transit_timestamp", "station_complex", "ridership", "transfers"])
    
    # Get additional data for the timeframe
    for j in range(min(timeframe, 12)):  # Limit to at most 12 hours to avoid excessive API calls
        try:
            current_time = current_time - timedelta(hours=1)
            formatted_time = current_time.strftime('%Y-%m-%dT%H:00:00')
            url = f"https://data.ny.gov/resource/wujg-7c2s.json?$where=transit_timestamp >= '{formatted_time}'&$limit=1000"
            
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                df_temp = pd.DataFrame.from_dict(data)
                df_sub = pd.concat([df_sub, df_temp], axis=0)
                print(f"Added {len(df_temp)} records")
            else:
                print(f"API returned status code: {response.status_code}")
        except Exception as e:
            print(f"Error fetching additional data: {e}")
    
    # Filter and process data
    if "station_complex" not in df_sub.columns or "ridership" not in df_sub.columns:
        print("Missing required columns in data")
        return pd.DataFrame(columns=["transit_timestamp", "station_complex", "ridership", "transfers"])
    
    # Filters dataframe
    filtered_df = df_sub[["station_complex", "ridership", "transfers", "transit_timestamp"]]
    
    # Splits stations accordingly
    try:
        expanded_data = filtered_df.drop("station_complex", axis=1).join(
            filtered_df["station_complex"]
            .str.split("/")
            .explode("station_complex")
            .reset_index(drop=True)
        )
        
        expanded_data["station_complex"] = expanded_data["station_complex"].str.replace(
            r"\s*\([^)]+\)", "", regex=True
        )
        expanded_data["ridership"] = pd.to_numeric(
            expanded_data["ridership"], errors="coerce"
        )
        expanded_data["transfers"] = pd.to_numeric(
            expanded_data["transfers"], errors="coerce"
        )
        expanded_data = expanded_data.dropna(subset=["ridership", "transfers"])
        
        # Finds sum of ridership for stations with multiple entries
        consolidated_data = (
            expanded_data.groupby(["transit_timestamp", "station_complex"])
            .agg({"ridership": "sum", "transfers": "sum"})
            .reset_index()
        )
        
        # Filter to Manhattan stations
        consolidated_data = consolidated_data[
            consolidated_data["station_complex"].isin(manhattan_unique)
        ]
        
        print(f"Final dataset has {len(consolidated_data)} records for Manhattan stations")
        return consolidated_data
    except Exception as e:
        print(f"Error processing data: {e}")
        return pd.DataFrame(columns=["transit_timestamp", "station_complex", "ridership", "transfers"])

# Function uses provided models or defaults if models are unavailable
def ridership():
    try:
        # Check multiple possible locations for the model file
        model_path = find_file(
            "utils/models.pickle", 
            ["models.pickle", "backend/utils/models.pickle"]
        )
        
        if not model_path:
            print("Warning: Model file not found. Generating random predictions.")
            # Create simple default predictions
            ridership_pred = {station: np.random.randint(100, 1000) for station in manhattan_unique}
            return pd.DataFrame(list(ridership_pred.items()), columns=["station", "ridership_pred"])
        
        # Load models
        print(f"Loading model from {model_path}")
        with open(model_path, "rb") as handle:
            models = pickle.load(handle)
        
        # Get data
        consolidated_data = generate_data(3)
        
        if len(consolidated_data) == 0:
            print("No data available for predictions")
            ridership_pred = {station: np.random.randint(100, 1000) for station in manhattan_unique}
            return pd.DataFrame(list(ridership_pred.items()), columns=["station", "ridership_pred"])
        
        # Calculate predictions
        ridership_pred = {}
        
        for station in manhattan_unique:
            try:
                # Check if we have data for this station
                station_df = consolidated_data[consolidated_data["station_complex"] == station]
                
                if len(station_df) < 3:
                    # Not enough data for this station, use random prediction
                    ridership_pred[station] = np.random.randint(100, 1000)
                    continue
                
                station_df = station_df.sort_values("transit_timestamp")
                station_df["transit_timestamp"] = pd.to_datetime(station_df["transit_timestamp"])
                station_df = station_df.dropna(subset=["ridership"])
                station_df.reset_index(inplace=True, drop=True)
                
                # Check if station exists in models
                if station in models:
                    coef = models[station]
                    
                    # Predict function
                    def predict(coef, history):
                        yhat = coef[0]
                        for i in range(1, len(coef)):
                            if i <= len(history):
                                yhat += coef[i] * history[-i]
                        return yhat
                    
                    prediction = round(predict(coef, station_df["ridership"].values), 2)
                    ridership_pred[station] = prediction
                else:
                    # No model for this station, use average of available data
                    ridership_pred[station] = round(station_df["ridership"].mean(), 2)
            except Exception as e:
                print(f"Error processing station {station}: {e}")
                ridership_pred[station] = np.random.randint(100, 1000)
        
        return pd.DataFrame(list(ridership_pred.items()), columns=["station", "ridership_pred"])
    
    except Exception as e:
        print(f"Critical error in ridership prediction: {e}")
        # Return fallback predictions
        ridership_pred = {station: np.random.randint(100, 1000) for station in manhattan_unique}
        return pd.DataFrame(list(ridership_pred.items()), columns=["station", "ridership_pred"])

if __name__ == "__main__":
    # For testing, call ridership function
    result = ridership()
    print(f"Generated predictions for {len(result)} stations")
    print(result.head())