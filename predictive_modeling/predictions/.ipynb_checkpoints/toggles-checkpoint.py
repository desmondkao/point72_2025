import pandas as pd
import json

def load_predictions(file_path):
    df = pd.read_csv(file_path)
    selected_columns = ["Toll 10 Minute Block", "Detection Region", "Predicted CRZ Entries"]
    missing_cols = [col for col in selected_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Required columns missing in {file_path}: {missing_cols}")
    
    return df[selected_columns]

def load_taxi_predictions(file_path):
    df = pd.read_csv(file_path)
    selected_columns = ["time_interval", "count", "LocationID"]
    missing_cols = [col for col in selected_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Required columns missing in {file_path}: {missing_cols}")
    
    return df[selected_columns]

#names of each of the csv's
cars_file = "1 - Cars, Pickups and Vans_predictions.csv"
single_unit_file = "2 - Single-Unit Trucks_predictions.csv"
multi_unit_file = "3 - Multi-Unit Trucks_predictions.csv"
buses_file = "4 - Buses_predictions.csv"
motorcycles_file = "5 - Motorcycles_predictions.csv"
taxifhv_file = "6 - TaxiFHV_predictions.csv"
taxi_pred_file = "taxi_pred.csv"

# Load CSV files into their own DataFrames
cars_df = load_predictions(cars_file)
single_unit_df = load_predictions(single_unit_file)
multi_unit_df = load_predictions(multi_unit_file)
buses_df = load_predictions(buses_file)
motorcycles_df = load_predictions(motorcycles_file)
taxifhv_df = load_predictions(taxifhv_file)
taxi_pred_df = load_taxi_predictions(taxi_pred_file)  # Ensure this is defined before use

# Dictionary mapping toggle keys to their corresponding DataFrames
dataframes = {
    "cars": cars_df,
    "single_unit": single_unit_df,
    "multi_unit": multi_unit_df,
    "buses": buses_df,
    "motorcycles": motorcycles_df,
    "taxifhv": taxifhv_df,
}

def aggregate_by_time_and_region(toggles):
    aggregated_data = []
    for key, is_on in toggles.items():
        if is_on:
            if key not in dataframes:
                raise KeyError(f"No dataframe found for key: {key}")
            df = dataframes[key].copy()
            # Convert CRZ entries to numeric.
            df["Predicted CRZ Entries"] = pd.to_numeric(df["Predicted CRZ Entries"], errors="coerce").fillna(0)
            # Group by both time and detection region.
            grouped = df.groupby(["Toll 10 Minute Block", "Detection Region"], as_index=False)["Predicted CRZ Entries"].sum()
            aggregated_data.append(grouped)
    
    if not aggregated_data:
        return pd.DataFrame(columns=["Toll 10 Minute Block", "Detection Region", "Total Predicted CRZ Entries"])

    combined_df = pd.concat(aggregated_data, ignore_index=True)
    # Re-group in case different datasets have overlapping time/region entries.
    result_df = combined_df.groupby(["Toll 10 Minute Block", "Detection Region"], as_index=False)["Predicted CRZ Entries"].sum()
    result_df.rename(columns={"Predicted CRZ Entries": "Total Predicted CRZ Entries"}, inplace=True)
    return result_df

def aggregate_taxi_by_time_and_location(taxi_df, toggles_time_intervals):
    """
    Aggregates taxi prediction counts by time interval and LocationID,
    aligning the taxi data with the toggles' time intervals.
    If a taxi count is missing for a time interval, it defaults to 0.
    The taxi data is trimmed so that its last interval is the same as the toggles' last interval.
    
    Parameters:
        taxi_df (pd.DataFrame): Taxi predictions DataFrame with columns "time_interval", "count", and "LocationID".
        toggles_time_intervals (list-like): Sorted list of time intervals (from toggles data) to align with.
    
    Returns:
        pd.DataFrame: A pivoted DataFrame with "time_interval" as the first column and one column for each LocationID.
    """
    # Ensure 'count' is numeric.
    taxi_df["count"] = pd.to_numeric(taxi_df["count"], errors="coerce").fillna(0)
    
    # Trim the taxi data so its last interval matches the toggles' last interval.
    max_interval = max(toggles_time_intervals)
    taxi_df = taxi_df[taxi_df["time_interval"] <= max_interval]
    
    # Aggregate counts for each time_interval and LocationID.
    aggregated = taxi_df.groupby(["time_interval", "LocationID"], as_index=False)["count"].sum()
    
    # Pivot so that each LocationID becomes its own column.
    pivot_df = aggregated.pivot(index="time_interval", columns="LocationID", values="count")
    
    # Reindex the pivot table to ensure every toggles time interval is present.
    pivot_df = pivot_df.reindex(toggles_time_intervals, fill_value=0)
    pivot_df.index.name = "time_interval"
    
    return pivot_df.reset_index()

zone_coords = {
    "brooklyn": {"latitude": 40.7061, "longitude": -73.9969},
    "east 60th street": {"latitude": 40.7616, "longitude": -73.9644},
    "fdr drive": {"latitude": 40.7626, "longitude": -73.9582},
    "new jersey": {"latitude": 40.7608, "longitude": -74.0075},
    "queens": {"latitude": 40.7440, "longitude": -73.9675},
    "west 60th street": {"latitude": 40.7700, "longitude": -73.9850},
    "west side highway": {"latitude": 40.7711, "longitude": -73.9897}
}


def format_toggle_data(df):
    """
    Convert a dataframe with columns 'Toll 10 Minute Block', 'Detection Region',
    and 'Total Predicted CRZ Entries' into a list of JSON objects with format:
    
      {
        "latitude": xxx,
        "longitude": xxx,
        "time": xxxx,
        "predictionCRZ": xxxx
      }
    """
    output_list = []
    for _, row in df.iterrows():
        raw_region = row["Detection Region"]
        # Normalize the region: strip whitespace, lower case, collapse multiple spaces.
        region_key = ' '.join(raw_region.strip().lower().split())
        
        # If the region_key contains variations of east or west 60th street, force a standard key.
        if "east" in region_key and "60th" in region_key:
            region_key = "east 60th street"
        if "west" in region_key and "60th" in region_key:
            region_key = "west 60th street"
        
        coords = zone_coords.get(region_key, {"latitude": None, "longitude": None})
        
        # Print the region_key if a coordinate is missing.
        if coords["latitude"] is None or coords["longitude"] is None:
            print(f"Missing coordinate for region: {region_key} (original: {raw_region})")
        
        toggle_obj = {
            "latitude": coords["latitude"],
            "longitude": coords["longitude"],
            "time": row["Toll 10 Minute Block"],
            "predictionCRZ": row["Predicted CRZ Entries"]
        }
        output_list.append(toggle_obj)
    return output_list


def save_json(data, filename):
    """Save the provided data into a JSON file."""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved {filename}")

cars_json = format_toggle_data(cars_df)
single_unit_json = format_toggle_data(single_unit_df)
multi_unit_json = format_toggle_data(multi_unit_df)
buses_json = format_toggle_data(buses_df)
motorcycles_json = format_toggle_data(motorcycles_df)
taxifhv_json = format_toggle_data(taxifhv_df)

save_json(cars_json, "cars.json")
save_json(single_unit_json, "single_unit.json")
save_json(multi_unit_json, "multi_unit.json")
save_json(buses_json, "buses.json")
save_json(motorcycles_json, "motorcycles.json")
save_json(taxifhv_json, "taxifhv.json")









if __name__ == "__main__":
    # Example toggle configuration: set True for datasets you want to include.
    toggles = {
        "cars": True,
        "single_unit": True,
        "multi_unit": True,
        "buses": True,
        "motorcycles": True,
        "taxifhv": True,
    }

    # Aggregate toggles data by time (Toll 10 Minute Block) and region.
    toggles_agg_df = aggregate_by_time_and_region(toggles)
    print("Aggregated Predicted CRZ Entries by Toll 10 Minute Block and Detection Region:")
    print(toggles_agg_df.head(15), "\n")
    
    # Extract sorted time intervals from the toggles data.
    toggles_time_intervals = sorted(toggles_agg_df["Toll 10 Minute Block"].unique())
    
    # Process taxi data: Align by time interval and separate by LocationID.
    taxi_aligned_df = aggregate_taxi_by_time_and_location(taxi_pred_df, toggles_time_intervals)
    print("Taxi Predictions Aligned by Time Interval and LocationID:")
    print(taxi_aligned_df)
