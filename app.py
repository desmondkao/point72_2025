from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import sys
import json
import traceback

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try importing the ridership prediction module
try:
    from utils.ridership import ridership
    print("Successfully imported ridership module")
    RIDERSHIP_AVAILABLE = True
except Exception as e:
    print(f"Error importing ridership module: {e}")
    print(traceback.format_exc())
    RIDERSHIP_AVAILABLE = False

app = Flask(__name__, static_folder='congestion-map/build')

# More specific CORS configuration
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/api/ridership-predictions')
def get_ridership_predictions():
    """
    Endpoint to get ridership predictions
    Query params:
    - time: Time in format HH:MM (default: current time)
    - day: Day of week (default: current day)
    """
    print("\n" + "="*80)
    print("RIDERSHIP PREDICTIONS API CALLED")
    print("="*80)
    
    # Get query parameters and log them
    time_param = request.args.get('time', '12:00')
    day_param = request.args.get('day', 'monday')
    print(f"Request params: time={time_param}, day={day_param}")
    
    try:
        if RIDERSHIP_AVAILABLE:
            print("Using actual ridership prediction function")
            # Use your actual ridership prediction function
            predictions_df = ridership(time_param, day_param)

            
            print(f"Ridership predictions shape: {predictions_df.shape}")
            print(f"Ridership predictions columns: {predictions_df.columns}")
            print(f"First 5 rows of predictions:")
            print(predictions_df.head(5))
            
            # Try to load station coordinates
            try:
                # Look in multiple possible locations for the manhattan_stops.csv file
                possible_paths = [
                    os.path.join('utils', 'data', 'manhattan_stops.csv'),
                    'manhattan_stops.csv',
                    os.path.join('..', 'utils', 'data', 'manhattan_stops.csv'),
                    os.path.join('backend', 'utils', 'data', 'manhattan_stops.csv')
                ]
                
                stops_path = None
                for path in possible_paths:
                    if os.path.exists(path):
                        stops_path = path
                        break
                
                if stops_path is None:
                    print("ERROR: Could not find manhattan_stops.csv in any of these locations:")
                    for path in possible_paths:
                        print(f"  - {os.path.abspath(path)}")
                    return generate_fallback_ridership_data()
                
                print(f"Loading Manhattan stops from: {stops_path}")
                manhattan_stops = pd.read_csv(stops_path)
                
                print(f"Manhattan stops shape: {manhattan_stops.shape}")
                print(f"Manhattan stops columns: {manhattan_stops.columns}")
                print(f"First 5 rows of manhattan_stops:")
                print(manhattan_stops.head(5))
                
                # Clean up station names for better matching
                predictions_df['station'] = predictions_df['station'].str.strip()
                manhattan_stops['Stop Name'] = manhattan_stops['Stop Name'].str.strip()
                
                # Merge the datasets
                merged_df = pd.merge(
                    predictions_df,
                    manhattan_stops,
                    left_on='station',
                    right_on='Stop Name',
                    how='inner'
                )
                
                print(f"Merged dataframe shape: {merged_df.shape}")
                
                if merged_df.shape[0] == 0:
                    print("WARNING: No matching stations found after merge!")
                    print("Prediction stations:")
                    print(predictions_df['station'].unique())
                    print("Manhattan stop names:")
                    print(manhattan_stops['Stop Name'].unique())
                    return generate_fallback_ridership_data()
                
                # Convert to list of dictionaries for JSON response
                result = []
                for _, row in merged_df.iterrows():
                    result.append({
                        'station': row['station'],
                        'ridership_pred': float(row['ridership_pred']),
                        'latitude': float(row['GTFS Latitude']),
                        'longitude': float(row['GTFS Longitude'])
                    })
                
                print(f"Returning {len(result)} station predictions")
                # Print first result to debug
                if len(result) > 0:
                    print(f"First result: {json.dumps(result[0])}")
                
                return jsonify(result)
            
            except Exception as e:
                print(f"Error processing station data: {e}")
                print(traceback.format_exc())
                return generate_fallback_ridership_data()
        else:
            print("Using fallback ridership data")
            return generate_fallback_ridership_data()
    
    except Exception as e:
        print(f"Critical error in ridership prediction endpoint: {e}")
        print(traceback.format_exc())
        return generate_fallback_ridership_data()

def generate_fallback_ridership_data():
    """Generate fake ridership data for testing"""
    print("Generating fallback ridership data")
    
    # Try to load Manhattan stops for coordinates
    try:
        # Look in multiple possible locations
        possible_paths = [
            os.path.join('utils', 'data', 'manhattan_stops.csv'),
            'manhattan_stops.csv',
            os.path.join('..', 'utils', 'data', 'manhattan_stops.csv'),
            os.path.join('backend', 'utils', 'data', 'manhattan_stops.csv')
        ]
        
        for stops_path in possible_paths:
            if os.path.exists(stops_path):
                print(f"Using stops data from: {stops_path}")
                manhattan_stops = pd.read_csv(stops_path)
                
                # Take a subset of stations
                stations_sample = manhattan_stops.sample(min(20, len(manhattan_stops)))
                
                # Get time parameter for simulating time-based ridership
                time_param = request.args.get('time', '12:00')
                try:
                    hour = int(time_param.split(':')[0])
                except (ValueError, IndexError):
                    hour = 12
                
                # Ridership multiplier based on time of day
                multiplier = 1.0
                if 7 <= hour <= 9:  # Morning rush
                    multiplier = 2.5
                elif 16 <= hour <= 19:  # Evening rush
                    multiplier = 2.3
                elif hour >= 22 or hour <= 5:  # Late night
                    multiplier = 0.4
                
                # Generate ridership values
                result = []
                for _, station in stations_sample.iterrows():
                    # Base ridership varies by station
                    base_ridership = np.random.uniform(200, 800)
                    
                    # Adjust for time of day
                    ridership_value = base_ridership * multiplier
                    
                    result.append({
                        "station": station["Stop Name"],
                        "ridership_pred": round(ridership_value, 2),
                        "latitude": float(station["GTFS Latitude"]),
                        "longitude": float(station["GTFS Longitude"])
                    })
                
                print(f"Returning {len(result)} fallback stations from real coordinates")
                if len(result) > 0:
                    print(f"Sample station: {json.dumps(result[0])}")
                return jsonify(result)
                
    except Exception as e:
        print(f"Error loading Manhattan stops for fallback data: {e}")
        print(traceback.format_exc())
    
    # If all else fails, return hardcoded NYC subway stations
    print("Using hardcoded subway station data")
    stations = [
        {"name": "Times Square-42 St", "lat": 40.7559, "lng": -73.9870},
        {"name": "Grand Central-42 St", "lat": 40.7527, "lng": -73.9772},
        {"name": "Union Square", "lat": 40.7356, "lng": -73.9910},
        {"name": "34 St-Penn Station", "lat": 40.7506, "lng": -73.9936},
        {"name": "59 St-Columbus Circle", "lat": 40.7682, "lng": -73.9819},
        {"name": "Brooklyn Bridge-City Hall", "lat": 40.7132, "lng": -74.0021},
        {"name": "Wall St", "lat": 40.7074, "lng": -74.0113},
        {"name": "Canal St", "lat": 40.7193, "lng": -74.0000},
        {"name": "14 St", "lat": 40.7368, "lng": -73.9971},
        {"name": "96 St", "lat": 40.7906, "lng": -73.9722},
        {"name": "125 St", "lat": 40.8075, "lng": -73.9454},
        {"name": "72 St", "lat": 40.7769, "lng": -73.9820},
        {"name": "West 4 St", "lat": 40.7322, "lng": -74.0008},
        {"name": "Fulton St", "lat": 40.7092, "lng": -74.0076},
    ]
    
    # Get time parameter for simulating time-based ridership
    time_param = request.args.get('time', '12:00')
    try:
        hour = int(time_param.split(':')[0])
    except (ValueError, IndexError):
        hour = 12
    
    # Ridership multiplier based on time of day
    multiplier = 1.0
    if 7 <= hour <= 9:  # Morning rush
        multiplier = 2.5
    elif 16 <= hour <= 19:  # Evening rush
        multiplier = 2.3
    elif hour >= 22 or hour <= 5:  # Late night
        multiplier = 0.4
    
    # Generate ridership values
    result = []
    for station in stations:
        # Base ridership varies by station
        base_ridership = np.random.uniform(200, 800)
        
        # Adjust for time of day
        ridership_value = base_ridership * multiplier
        
        result.append({
            "station": station["name"],
            "ridership_pred": round(ridership_value, 2),
            "latitude": station["lat"],
            "longitude": station["lng"]
        })
    
    print(f"Returning {len(result)} hardcoded fallback stations")
    return jsonify(result)

# For development, serve the React app at root
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/debug')
def debug_info():
    """Endpoint to get debug information about the environment"""
    info = {
        "current_directory": os.getcwd(),
        "files_in_current_dir": os.listdir('.'),
        "python_path": sys.path,
        "manhattan_stops_found": False,
        "ridership_module_available": RIDERSHIP_AVAILABLE
    }
    
    # Check for manhattan_stops.csv
    possible_paths = [
        os.path.join('utils', 'data', 'manhattan_stops.csv'),
        'manhattan_stops.csv',
        os.path.join('..', 'utils', 'data', 'manhattan_stops.csv'),
        os.path.join('backend', 'utils', 'data', 'manhattan_stops.csv')
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            info["manhattan_stops_found"] = True
            info["manhattan_stops_path"] = os.path.abspath(path)
            try:
                df = pd.read_csv(path)
                info["manhattan_stops_shape"] = df.shape
                info["manhattan_stops_columns"] = list(df.columns)
            except Exception as e:
                info["manhattan_stops_error"] = str(e)
            break
    
    # Check for models.pickle
    possible_model_paths = [
        os.path.join('utils', 'models.pickle'),
        'models.pickle',
        os.path.join('..', 'utils', 'models.pickle'),
        os.path.join('backend', 'utils', 'models.pickle')
    ]
    
    info["models_pickle_found"] = False
    for path in possible_model_paths:
        if os.path.exists(path):
            info["models_pickle_found"] = True
            info["models_pickle_path"] = os.path.abspath(path)
            break
    
    # Add installed packages
    try:
        import pkg_resources
        info["installed_packages"] = [
            {"name": d.project_name, "version": d.version}
            for d in pkg_resources.working_set
        ]
    except:
        info["installed_packages"] = "Unable to retrieve"
    
    return jsonify(info)

if __name__ == '__main__':
    # Run on port 8080 
    port = 8080
    max_port = 8130
    
    print(f"Starting Flask server on port {port}")
    
    while port < max_port:
        try:
            # Allow connections from any IP
            app.run(debug=True, host='0.0.0.0', port=port)
            break
        except OSError:
            print(f"Port {port} is in use, trying {port + 1}")
            port += 1