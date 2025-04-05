import pandas as pd
import requests
from datetime import datetime, timedelta
import numpy as np
import pickle
import os
import time
from statsmodels.tsa.ar_model import AutoReg

def fetch_historical_data(start_date, end_date, batch_size=1000, max_retries=3, delay_between_retries=2):
    """
    Fetch historical subway ridership data from the NY Open Data API
    with improved error handling and pagination support
    """
    print(f"Fetching data from {start_date} to {end_date}")
    
    all_data = []
    current_date = start_date
    
    while current_date <= end_date:
        # Calculate end of current batch (up to 7 days at a time to avoid hitting API limits)
        batch_end = min(current_date + timedelta(days=7), end_date)
        
        formatted_start = current_date.strftime("%Y-%m-%dT%H:%M:%S")
        formatted_end = batch_end.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Build query with date range and limit
        url = f"https://data.ny.gov/resource/wujg-7c2s.json"
        query = f"?$where=transit_timestamp >= '{formatted_start}' AND transit_timestamp <= '{formatted_end}'"
        query += f"&$limit={batch_size}"
        
        for attempt in range(max_retries):
            try:
                print(f"Fetching batch: {formatted_start} to {formatted_end}")
                response = requests.get(url + query, timeout=30)
                
                if response.status_code == 200:
                    batch_data = response.json()
                    print(f"Retrieved {len(batch_data)} records")
                    all_data.extend(batch_data)
                    break
                else:
                    print(f"API returned status {response.status_code}. Attempt {attempt+1}/{max_retries}")
                    if attempt < max_retries - 1:
                        time.sleep(delay_between_retries)
            except Exception as e:
                print(f"Error fetching data: {e}. Attempt {attempt+1}/{max_retries}")
                if attempt < max_retries - 1:
                    time.sleep(delay_between_retries)
        
        # Move to next batch
        current_date = batch_end + timedelta(seconds=1)
        
        # Be nice to the API - add a small delay between batch requests
        time.sleep(0.5)
    
    print(f"Total records fetched: {len(all_data)}")
    return pd.DataFrame.from_dict(all_data) if all_data else pd.DataFrame()

def process_raw_data(df_raw, manhattan_stops):
    """Process the raw data from the API into a usable format"""
    
    if len(df_raw) == 0:
        print("No data to process")
        return pd.DataFrame()
    
    # Get unique Manhattan station names
    manhattan_unique = manhattan_stops["Stop Name"].unique()
    
    # Filter to required columns
    try:
        filtered_df = df_raw[["station_complex", "ridership", "transfers", "transit_timestamp"]]
    except KeyError as e:
        print(f"Missing columns in data: {e}")
        print(f"Available columns: {df_raw.columns.tolist()}")
        return pd.DataFrame()
    
    # Split stations with multiple names
    try:
        expanded_data = filtered_df.drop("station_complex", axis=1).join(
            filtered_df["station_complex"]
            .str.split("/")
            .explode("station_complex")
            .reset_index(drop=True)
        )
        
        # Clean station names by removing parenthetical info
        expanded_data["station_complex"] = expanded_data["station_complex"].str.replace(
            r"\s*\([^)]+\)", "", regex=True
        ).str.strip()
        
        # Convert ridership and transfers to numeric
        expanded_data["ridership"] = pd.to_numeric(
            expanded_data["ridership"], errors="coerce"
        )
        expanded_data["transfers"] = pd.to_numeric(
            expanded_data["transfers"], errors="coerce"
        )
        
        # Remove rows with missing ridership data
        expanded_data = expanded_data.dropna(subset=["ridership"])
        
        # Convert timestamp to datetime
        expanded_data["transit_timestamp"] = pd.to_datetime(expanded_data["transit_timestamp"])
        
        # Group by timestamp and station
        consolidated_data = (
            expanded_data.groupby(["transit_timestamp", "station_complex"])
            .agg({"ridership": "sum", "transfers": "sum"})
            .reset_index()
        )
        
        # Filter to only Manhattan stations
        consolidated_data = consolidated_data[
            consolidated_data["station_complex"].isin(manhattan_unique)
        ]
        
        # Add time features
        consolidated_data["day_of_week"] = consolidated_data["transit_timestamp"].dt.day_name()
        consolidated_data["hour"] = consolidated_data["transit_timestamp"].dt.hour
        consolidated_data["minute"] = consolidated_data["transit_timestamp"].dt.minute
        
        # Create a time_bin column (0-143 for each 10-minute interval in a day)
        consolidated_data["time_bin"] = (consolidated_data["hour"] * 60 + consolidated_data["minute"]) // 10
        
        print(f"Processed data: {len(consolidated_data)} records for Manhattan stations")
        return consolidated_data
    
    except Exception as e:
        print(f"Error processing data: {e}")
        return pd.DataFrame()

def build_time_of_day_models(processed_data):
    """
    Build models for each station, day of week, and time interval
    """
    # Check if we have data
    if len(processed_data) == 0:
        print("No data available to build models")
        return {}
    
    print("Building time-of-day models for each station and day of week...")
    
    # Create a dictionary to store our models
    models_dict = {
        "by_station": {},           # Station-level models (general)
        "by_day_and_time": {},      # Models for each station, day of week, and 10-min interval
        "time_patterns": {},        # Relative patterns throughout the day
        "day_of_week_factors": {}   # Day of week adjustment factors
    }
    
    # List of days
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    # First, build base station models
    for station in processed_data["station_complex"].unique():
        station_df = processed_data[processed_data["station_complex"] == station].copy()
        
        if len(station_df) < 24:
            print(f"Not enough data for station {station}, skipping")
            continue
        
        # Calculate average ridership for this station
        avg_ridership = station_df["ridership"].mean()
        models_dict["by_station"][station] = {
            "avg_ridership": avg_ridership
        }
        
        # Calculate day of week factors
        day_factors = {}
        for day in days_of_week:
            day_data = station_df[station_df["day_of_week"] == day]
            if len(day_data) > 0:
                day_factors[day] = day_data["ridership"].mean() / avg_ridership if avg_ridership > 0 else 1.0
            else:
                day_factors[day] = 1.0
        
        models_dict["day_of_week_factors"][station] = day_factors
        
        # Calculate time patterns (relative to daily average)
        time_patterns = {}
        # Group by time bin and calculate average
        time_bin_avg = station_df.groupby("time_bin")["ridership"].mean()
        
        # Calculate the relative pattern for each 10-minute bin
        for time_bin in range(144):  # 144 10-minute intervals in a day
            if time_bin in time_bin_avg:
                time_patterns[time_bin] = time_bin_avg[time_bin] / avg_ridership if avg_ridership > 0 else 1.0
            else:
                # Use interpolation or set a reasonable default
                closest_bins = sorted(time_bin_avg.index, key=lambda x: abs(x - time_bin))
                if closest_bins:
                    time_patterns[time_bin] = time_bin_avg[closest_bins[0]] / avg_ridership if avg_ridership > 0 else 1.0
                else:
                    time_patterns[time_bin] = 1.0
        
        models_dict["time_patterns"][station] = time_patterns
        
        # For detailed time and day models
        for day in days_of_week:
            day_data = station_df[station_df["day_of_week"] == day]
            
            if len(day_data) < 12:  # Need at least some data points
                continue
                
            # Group by time bin for this day
            day_time_bins = day_data.groupby("time_bin")["ridership"].mean()
            
            # Store in models dictionary
            if station not in models_dict["by_day_and_time"]:
                models_dict["by_day_and_time"][station] = {}
            
            models_dict["by_day_and_time"][station][day] = dict(day_time_bins)
    
    # Add AR models where enough data is available
    print("Building AutoRegressive models for stations with sufficient data...")
    
    for station in processed_data["station_complex"].unique():
        station_df = processed_data[processed_data["station_complex"] == station].copy()
        
        if len(station_df) >= 30:  # Need at least 30 data points for AR model
            try:
                # Sort by timestamp
                station_df = station_df.sort_values("transit_timestamp")
                
                # Build an AR model
                model = AutoReg(station_df["ridership"], lags=3)
                fitted_model = model.fit()
                
                # Store the model parameters
                if station in models_dict["by_station"]:
                    models_dict["by_station"][station]["ar_params"] = fitted_model.params.tolist()
            except Exception as e:
                print(f"Error building AR model for {station}: {e}")
    
    return models_dict

def generate_model(use_cached_data=False, cache_file="ridership_data_cache.csv"):
    """
    Main function to generate the ridership prediction model
    """
    # Find the Manhattan stops file
    stops_path = find_file(
        "utils/data/manhattan_stops.csv",
        ["manhattan_stops.csv", "backend/utils/data/manhattan_stops.csv"]
    )
    
    if not stops_path:
        print("Error: Cannot find Manhattan stops file")
        return False
    
    # Load Manhattan stops data
    manhattan_stops = pd.read_csv(stops_path)
    
    # Define the date range for historical data
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 12, 31)
    
    # Either use cached data or fetch from API
    if use_cached_data and os.path.exists(cache_file):
        print(f"Using cached data from {cache_file}")
        df_raw = pd.read_csv(cache_file)
        df_raw["transit_timestamp"] = pd.to_datetime(df_raw["transit_timestamp"])
    else:
        print("Fetching data from API...")
        df_raw = fetch_historical_data(start_date, end_date)
        
        # Cache the data if we successfully retrieved it
        if len(df_raw) > 0:
            df_raw.to_csv(cache_file, index=False)
            print(f"Cached raw data to {cache_file}")
    
    # Process the data
    processed_data = process_raw_data(df_raw, manhattan_stops)
    
    if len(processed_data) == 0:
        print("Error: No processed data available")
        return False
    
    # Build time-of-day models
    models_dict = build_time_of_day_models(processed_data)
    
    # Save the models
    model_path = "utils/models.pickle"
    with open(model_path, "wb") as handle:
        pickle.dump(models_dict, handle)
    
    print(f"Model saved to {model_path}")
    return True

def find_file(file_path, fallback_paths=None):
    """Utility function to find a file from multiple possible locations"""
    if os.path.exists(file_path):
        return file_path
    
    if fallback_paths:
        for path in fallback_paths:
            if os.path.exists(path):
                return path
    
    return None

if __name__ == "__main__":
    # Set to True to use cached data if available
    use_cached = True
    generate_model(use_cached)