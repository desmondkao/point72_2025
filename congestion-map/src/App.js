<<<<<<< Updated upstream
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Info, Clock, Calendar, BarChart2 } from 'lucide-react';
import VisualizationModeSelector from './components/VisualizationModeSelector';
import MapDimensionToggle from './components/MapDimensionToggle';
import Map from './components/Map';
import './App.css'; // We'll create this for additional styling

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

  // Update data based on time selection
  useEffect(() => {
    // This would be where you fetch or filter data based on the current selections
    console.log('Selection changed:', {
      timeMode,
      specificDate: timeMode === 'specificDay' ? specificDate : null,
      currentTime: formatTime(currentTime),
      dayPattern: timeMode === 'dayPattern' ? dayPattern : null,
      aggregateType: timeMode === 'aggregate' ? aggregateType : null,
      visualizationMode,
      is3D: visualizationMode === 'map' ? is3D : null
    });
    
    // Simulate updating the cost based on time
    const hour = Math.floor(currentTime / 60);
    if (hour >= 7 && hour <= 9) {
      setEstimatedCost('23.00'); // Higher during morning rush
    } else if (hour >= 16 && hour <= 18) {
      setEstimatedCost('21.00'); // Higher during evening rush
    } else if (hour >= 22 || hour <= 5) {
      setEstimatedCost('15.00'); // Lower at night
    } else {
      setEstimatedCost('18.00'); // Regular daytime
    }
  }, [timeMode, specificDate, currentTime, dayPattern, aggregateType, visualizationMode, is3D]);
  
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
            
            <button className="aegean-blue hover:light-grey-blue rounded-lg p-2 flex items-center gap-1">
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
=======
// src/App.js
import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Info,
  Clock,
  Calendar,
  BarChart2
} from 'lucide-react';
import VisualizationModeSelector from './components/VisualizationModeSelector';
import MapDimensionToggle from './components/MapDimensionToggle';
import Map from './components/Map';
import './App.css';

function App() {
  // ── Time & View State ───────────────────────────────────────────────
  const [timeMode, setTimeMode] = useState('specificDay');
  const [specificDate, setSpecificDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(12 * 60); // in minutes
  const [dayPattern, setDayPattern] = useState('monday');
  const [aggregateType, setAggregateType] = useState('weekdays');

  const [visualizationMode, setVisualizationMode] = useState('map');
  const [is3D, setIs3D] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // ── Toll Fee State ─────────────────────────────────────────────────
  const [estimatedCost, setEstimatedCost] = useState('18.00');

  // ── Vehicle Selector State ─────────────────────────────────────────
  const vehicleOptions = [
    { id: 1, label: "Cars, Pickups & Vans" },
    { id: 2, label: "Single‑Unit Trucks" },
    { id: 3, label: "Multi‑Unit Trucks" },
    { id: 4, label: "Buses" },
    { id: 5, label: "Motorcycles" },
    { id: 6, label: "TLC Taxi/FHV" },
    { id: 7, label: "Subway" }
  ];
  const [selectedVehicles, setSelectedVehicles] = useState(
    vehicleOptions.map(o => o.id) // default: all selected
  );

  // ── Helpers ─────────────────────────────────────────────────────────
  const formatTime = minutes => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };
  const formatDate = date =>
    date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

  // ── 1) Logging effect (no state writes) ─────────────────────────────
  useEffect(() => {
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
  }, [
    timeMode,
    specificDate,
    currentTime,
    dayPattern,
    aggregateType,
    visualizationMode,
    is3D,
    selectedVehicles
  ]);

  // ── 2) Toll‑fee calculator effect ────────────────────────────────────
  useEffect(() => {
    const hour = Math.floor(currentTime / 60);
    let newCost;
    if (hour >= 7 && hour <= 9)         newCost = '23.00';
    else if (hour >= 16 && hour <= 18)  newCost = '21.00';
    else if (hour >= 22 || hour <= 5)   newCost = '15.00';
    else                                newCost = '18.00';

    if (newCost !== estimatedCost) {
      setEstimatedCost(newCost);
    }
  }, [currentTime, estimatedCost]);

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
        {/* ── Controls Panel ──────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-md mb-4 z-10">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Time & View Controls</h2>
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={() => setShowControls(!showControls)}
            >
              {showControls ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
            </button>
          </div>

          {showControls && (
            <div className="p-4">
              {/* Time Mode Buttons */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Time Selection</h3>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    className={`flex items-center gap-1 p-2 rounded-md ${
                      timeMode === 'specificDay'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100'
                    }`}
                    onClick={() => setTimeMode('specificDay')}
                  >
                    <Calendar size={16}/>
                    <span>Specific Day</span>
                  </button>
                  <button
                    className={`flex items-center gap-1 p-2 rounded-md ${
                      timeMode === 'dayPattern'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100'
                    }`}
                    onClick={() => setTimeMode('dayPattern')}
                  >
                    <Clock size={16}/>
                    <span>Day Pattern</span>
                  </button>
                  <button
                    className={`flex items-center gap-1 p-2 rounded-md ${
                      timeMode === 'aggregate'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100'
                    }`}
                    onClick={() => setTimeMode('aggregate')}
                  >
                    <BarChart2 size={16}/>
                    <span>Aggregates</span>
                  </button>
                </div>

                {/* Specific Day */}
                {timeMode === 'specificDay' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Date:</label>
                    <input
                      type="date"
                      value={specificDate.toISOString().split('T')[0]}
                      onChange={e => setSpecificDate(new Date(e.target.value))}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    />
                    <span className="text-sm text-gray-500 ml-2">
                      {formatDate(specificDate)}
                    </span>
                  </div>
                )}

                {/* Day Pattern */}
                {timeMode === 'dayPattern' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Day:</label>
                    <select
                      value={dayPattern}
                      onChange={e => setDayPattern(e.target.value)}
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

                {/* Aggregates */}
                {timeMode === 'aggregate' && (
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm font-medium min-w-[80px]">Pattern:</label>
                    <select
                      value={aggregateType}
                      onChange={e => setAggregateType(e.target.value)}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    >
                      <option value="weekdays">Weekdays (Mon-Fri)</option>
                      <option value="weekends">Weekends (Sat-Sun)</option>
                      <option value="allDays">All Days</option>
                      <option value="rushHours">Rush Hours Only</option>
                    </select>
                  </div>
                )}

                {/* Time Slider */}
                <div className="flex flex-col gap-1 mb-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium min-w-[80px]">Time:</label>
                    <input
                      type="range"
                      min="0"
                      max="1439"
                      step="15"
                      value={currentTime}
                      onChange={e => setCurrentTime(+e.target.value)}
                      className="flex-grow h-2 bg-gray-200 rounded-lg cursor-pointer"
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

              {/* ── Vehicle Type Selector ─────────────────────────────── */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Vehicle Types</h3>
                <div className="grid grid-cols-2 gap-2">
                  {vehicleOptions.map(opt => (
                    <label key={opt.id} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4"
                        checked={selectedVehicles.includes(opt.id)}
                        onChange={() =>
                          setSelectedVehicles(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(id => id !== opt.id)
                              : [...prev, opt.id]
                          )
                        }
                      />
                      <span className="ml-2 text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Visualization Controls ───────────────────────────── */}
              <div className="flex flex-wrap items-center gap-6">
                <VisualizationModeSelector
                  selectedMode={visualizationMode}
                  setSelectedMode={setVisualizationMode}
                />
                {visualizationMode === 'map' && (
                  <MapDimensionToggle is3D={is3D} setIs3D={setIs3D} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Main Visualization Area ───────────────────────────────── */}
        <div className="relative flex-grow bg-white rounded-lg shadow-md overflow-hidden">
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
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <p className="text-gray-500">
                  Graph View –{' '}
                  {timeMode === 'specificDay'
                    ? `Day: ${formatDate(specificDate)}`
                    : timeMode === 'dayPattern'
                    ? `Pattern: All ${dayPattern.charAt(0).toUpperCase() + dayPattern.slice(1)}s`
                    : `Aggregate: ${aggregateType}`}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar Stats */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-64 z-10">
            <h3 className="font-semibold mb-2">Current View</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Mode:</span>{' '}
                {timeMode === 'specificDay'
                  ? 'Specific Day'
                  : timeMode === 'dayPattern'
                  ? 'Day Pattern'
                  : 'Aggregate'}
              </p>
              {timeMode === 'specificDay' && (
                <p>
                  <span className="font-medium">Date:</span> {formatDate(specificDate)}
                </p>
              )}
              {timeMode === 'dayPattern' && (
                <p>
                  <span className="font-medium">Day:</span>{' '}
                  All {dayPattern.charAt(0).toUpperCase() + dayPattern.slice(1)}s
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
                <span className="font-medium">View:</span>{' '}
                {visualizationMode === 'map'
                  ? `${is3D ? '3D' : '2D'} Map`
                  : 'Graph'}
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
        NYC Congestion Map – A visualization tool for exploring traffic patterns
      </footer>
    </div>
  );
}

export default App;
>>>>>>> Stashed changes
