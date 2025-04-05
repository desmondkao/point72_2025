// App.js - Updated with vehicle selection
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Info, Clock, Calendar, BarChart2 } from 'lucide-react';
import VisualizationModeSelector from './components/VisualizationModeSelector';
import MapDimensionToggle from './components/MapDimensionToggle';
import Map from './components/Map';
import './App.css';
import "kepler.gl/umd/keplergl.min.css";

function App() {
  // State for time selection
  const [timeMode, setTimeMode] = useState('specificDay'); // specificDay, dayPattern, aggregate
  const [specificDate, setSpecificDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(720); // 12:00 in minutes
  const [dayPattern, setDayPattern] = useState('monday');
  const [aggregateType, setAggregateType] = useState('weekdays');
  
  // State for UI
  const [visualizationMode, setVisualizationMode] = useState('map');
  const [is3D, setIs3D] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [estimatedCost, setEstimatedCost] = useState('23.00');
  
  // State for vehicle selection
  const [selectedVehicles, setSelectedVehicles] = useState([1,2,3,4,5,6,7]);

  // Convert minutes to formatted time
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Format date to display format
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate vehicle-specific toll based on selected vehicles
  const calculateToll = (time, selectedVehicleTypes) => {
    const hour = Math.floor(time / 60);
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
    const isOvernight = (hour >= 22 || hour <= 5);
    
    // If no vehicles selected, return 0
    if (!selectedVehicleTypes.length) return '0.00';
    
    // Vehicle type fee map
    const vehicleFees = {
      1: { peak: 9.00, overnight: 2.25, regular: 4.50 },    // Cars, Pickups & Vans
      2: { peak: 14.40, overnight: 3.60, regular: 7.20 },   // Single-Unit Trucks
      3: { peak: 21.60, overnight: 5.40, regular: 10.80 },  // Multi-Unit Trucks
      4: { peak: 14.40, overnight: 3.60, regular: 7.20 },   // Buses
      5: { peak: 4.50, overnight: 1.05, regular: 2.25 },    // Motorcycles
      6: { peak: 0.75, overnight: 0.75, regular: 0.75 }     // Taxi/FHV
      // Subway (7) has no toll
    };
    
    // Get only road vehicles (1-6)
    const roadVehicles = selectedVehicleTypes.filter(v => v >= 1 && v <= 6);
    
    if (roadVehicles.length === 0) return '0.00';
    
    // For simplicity, use the highest toll vehicle as representative
    const highestTollVehicle = roadVehicles.reduce((highest, current) => {
      const currentFee = isPeak ? vehicleFees[current].peak : 
                        isOvernight ? vehicleFees[current].overnight : 
                        vehicleFees[current].regular;
      
      const highestFee = isPeak ? vehicleFees[highest].peak : 
                        isOvernight ? vehicleFees[highest].overnight :
                        vehicleFees[highest].regular;
      
      return currentFee > highestFee ? current : highest;
    }, roadVehicles[0]);
    
    // Get the fee for the time period
    let fee;
    if (isPeak) {
      fee = vehicleFees[highestTollVehicle].peak;
    } else if (isOvernight) {
      fee = vehicleFees[highestTollVehicle].overnight;
    } else {
      fee = vehicleFees[highestTollVehicle].regular;
    }
    
    return fee.toFixed(2);
  };

  // Update data based on time selection and vehicle types
  useEffect(() => {
    // Update estimated cost based on time and selected vehicles
    const newCost = calculateToll(currentTime, selectedVehicles);

    // Only call setter if it's different
    if (newCost !== estimatedCost) {
      setEstimatedCost(newCost);
    }
    
    console.log('Selection changed:', {
      timeMode,
      specificDate: timeMode === 'specificDay' ? specificDate : null,
      currentTime: formatTime(currentTime),
      dayPattern: timeMode === 'dayPattern' ? dayPattern : null,
      aggregateType: timeMode === 'aggregate' ? aggregateType : null,
      visualizationMode,
      is3D: visualizationMode === 'map' ? is3D : null,
      selectedVehicles
    });
  }, [timeMode, specificDate, currentTime, estimatedCost, dayPattern, aggregateType, visualizationMode, is3D, selectedVehicles]);
  
  // Handle vehicle selection changes
  const handleVehicleSelectionChange = (newSelection) => {
    setSelectedVehicles(newSelection);
  };
  
  // Function to render the graph view
  const renderGraphView = () => {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <p className="text-gray-500">
          Graph View - 
          {timeMode === 'specificDay' 
            ? `Day: ${formatDate(specificDate)}` 
            : timeMode === 'dayPattern' 
              ? `Pattern: All ${dayPattern.charAt(0).toUpperCase() + dayPattern.slice(1)}s`
              : `Aggregate: ${aggregateType}`}
        </p>
        {/* Chart component would go here */}
      </div>
    );
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <header className="navy-blue text-white p-4 shadow-md z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">NYC Congestion Map</h1>
          
          <div className="flex items-center gap-4">
            <div className="aegean-blue rounded-lg p-2 flex items-center gap-2">
              <DollarSign size={18} />
              <div className="flex flex-col">
                <span className="text-xs">Toll Fee</span>
                <span className="font-bold">${estimatedCost}</span>
              </div>
            </div>
            
            <button className="aegean-blue rounded-lg p-2 flex items-center gap-1">
              <Info size={18} />
              <span>About</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-grow p-4">
        <div className="bg-white rounded-lg shadow-md mb-4 z-10">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Time & View Controls</h2>
            <button 
              className="p-1 rounded hover:bg-gray-100" 
              onClick={() => setShowControls(!showControls)}
            >
              {showControls ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          
          {showControls && (
            <div className="p-4">
              {/* Time Mode Selection */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Time Selection</h3>
                <div className="flex items-center gap-3 mb-4">
                  <button 
                    className={`flex items-center gap-1 p-2 rounded-md ${timeMode === 'specificDay' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                    onClick={() => setTimeMode('specificDay')}
                  >
                    <Calendar size={16} />
                    <span>Specific Day</span>
                  </button>
                  <button 
                    className={`flex items-center gap-1 p-2 rounded-md ${timeMode === 'dayPattern' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                    onClick={() => setTimeMode('dayPattern')}
                  >
                    <Clock size={16} />
                    <span>Day Pattern</span>
                  </button>
                  <button 
                    className={`flex items-center gap-1 p-2 rounded-md ${timeMode === 'aggregate' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
                    onClick={() => setTimeMode('aggregate')}
                  >
                    <BarChart2 size={16} />
                    <span>Aggregates</span>
                  </button>
                </div>
                
                {/* Specific Day Controls */}
                {timeMode === 'specificDay' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Date:</label>
                    <input 
                      type="date" 
                      value={specificDate.toISOString().split('T')[0]}
                      onChange={(e) => setSpecificDate(new Date(e.target.value))}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500 ml-2">{formatDate(specificDate)}</span>
                  </div>
                )}
                
                {/* Day Pattern Controls */}
                {timeMode === 'dayPattern' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Day:</label>
                    <select 
                      value={dayPattern}
                      onChange={(e) => setDayPattern(e.target.value)}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    >
                      <option value="monday">All Mondays</option>
                      <option value="tuesday">All Tuesdays</option>
                      <option value="wednesday">All Wednesdays</option>
                      <option value="thursday">All Thursdays</option>
                      <option value="friday">All Fridays</option>
                      <option value="saturday">All Saturdays</option>
                      <option value="sunday">All Sundays</option>
                    </select>
                  </div>
                )}
                
                {/* Aggregate Controls */}
                {timeMode === 'aggregate' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Pattern:</label>
                    <select 
                      value={aggregateType}
                      onChange={(e) => setAggregateType(e.target.value)}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    >
                      <option value="weekdays">Weekdays (Mon-Fri)</option>
                      <option value="weekends">Weekends (Sat-Sun)</option>
                      <option value="allDays">All Days</option>
                      <option value="rushHours">Rush Hours Only</option>
                    </select>
                  </div>
                )}
                
                {/* Time Slider - always visible */}
                <div className="flex flex-col gap-1 mb-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium min-w-[80px]">Time:</label>
                    <input
                      type="range"
                      min="0"
                      max="1439"
                      step="15"
                      value={currentTime}
                      onChange={(e) => setCurrentTime(parseInt(e.target.value))}
                      className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm font-medium min-w-[60px] text-center">
                      {formatTime(currentTime)}
                    </span>
                  </div>
                  <div className="flex justify-between px-1 text-xs text-gray-500 mt-1">
                    <span>12AM</span>
                    <span>6AM</span>
                    <span>12PM</span>
                    <span>6PM</span>
                    <span>12AM</span>
                  </div>
                </div>
              </div>
              
              {/* Visualization Controls - Main mode and 3D toggle */}
              <div className="flex flex-wrap items-center gap-6">
                <VisualizationModeSelector 
                  selectedMode={visualizationMode} 
                  setSelectedMode={setVisualizationMode} 
                />
                
                {/* Only show 3D toggle when in map mode */}
                {visualizationMode === 'map' && (
                  <MapDimensionToggle 
                    is3D={is3D} 
                    setIs3D={setIs3D} 
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Visualization Area */}
        <div className="relative flex-grow bg-white rounded-lg shadow-md overflow-hidden">
          {/* Visualization content changes based on mode */}
          <div className="absolute inset-0">
            {visualizationMode === 'map' ? (
              <Map 
                currentTime={currentTime}
                timeMode={timeMode}
                specificDate={specificDate}
                dayPattern={dayPattern}
                aggregateType={aggregateType}
                is3D={is3D}
                selectedVehicles={selectedVehicles}
                onVehicleSelectionChange={handleVehicleSelectionChange}
              />
            ) : (
              renderGraphView()
            )}
          </div>
          
          {/* Information sidebar - always visible */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64 z-10">
            <h3 className="font-semibold mb-2">Current View</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Mode:</span> {
                  timeMode === 'specificDay' 
                    ? 'Specific Day' 
                    : timeMode === 'dayPattern' 
                      ? 'Day Pattern' 
                      : 'Aggregate'
                }
              </p>
              
              {timeMode === 'specificDay' && (
                <p>
                  <span className="font-medium">Date:</span> {formatDate(specificDate)}
                </p>
              )}
              
              {timeMode === 'dayPattern' && (
                <p>
                  <span className="font-medium">Day:</span> All {dayPattern.charAt(0).toUpperCase() + dayPattern.slice(1)}s
                </p>
              )}
              
              {timeMode === 'aggregate' && (
                <p>
                  <span className="font-medium">Pattern:</span> {aggregateType}
                </p>
              )}
              
              <p>
                <span className="font-medium">Time:</span> {formatTime(currentTime)}
              </p>
              
              <p>
                <span className="font-medium">View:</span> {
                  visualizationMode === 'map' 
                    ? `${is3D ? '3D' : '2D'} Map` 
                    : 'Graph'
                }
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="font-medium mb-2">Statistics</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Current Congestion:</span>
                  <span className="font-medium">76%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Peak Time:</span>
                  <span className="font-medium">8:45 AM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg. Travel Delay:</span>
                  <span className="font-medium">+12 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white p-4 text-center text-sm z-10">
        NYC Congestion Map - A visualization tool for exploring traffic patterns
      </footer>
    </div>
  );
}

export default App;