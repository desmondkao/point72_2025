import React, { useState } from 'react';
import { Calendar, Clock, BarChart } from 'lucide-react';

const TimePatternSelector = ({ onSelectionChange }) => {
  const [viewMode, setViewMode] = useState('specificDay'); // specificDay, dayPattern, aggregate
  const [specificDate, setSpecificDate] = useState(new Date());
  const [timeValue, setTimeValue] = useState(720); // 12:00 in minutes
  const [dayPattern, setDayPattern] = useState('monday');
  const [aggregateType, setAggregateType] = useState('weekdays');
  
  // conv minutes to formatted time
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // handle changes and propagate to parent
  const handleChange = (type, value) => {
    switch(type) {
      case 'viewMode':
        setViewMode(value);
        break;
      case 'specificDate':
        setSpecificDate(new Date(value));
        break;
      case 'timeValue':
        setTimeValue(parseInt(value));
        break;
      case 'dayPattern':
        setDayPattern(value);
        break;
      case 'aggregateType':
        setAggregateType(value);
        break;
      default:
        break;
    }
    
    // Create data object to send to parent
    const selection = {
      viewMode,
      specificDate: viewMode === 'specificDay' ? specificDate : null,
      timeValue: formatTime(timeValue),
      dayPattern: viewMode === 'dayPattern' ? dayPattern : null,
      aggregateType: viewMode === 'aggregate' ? aggregateType : null
    };
    
    onSelectionChange(selection);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center gap-4 mb-4">
        <button 
          className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'specificDay' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
          onClick={() => handleChange('viewMode', 'specificDay')}
        >
          <Calendar size={18} />
          <span>Specific Day</span>
        </button>
        <button 
          className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'dayPattern' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
          onClick={() => handleChange('viewMode', 'dayPattern')}
        >
          <Clock size={18} />
          <span>Day Pattern</span>
        </button>
        <button 
          className={`flex items-center gap-2 p-2 rounded-md ${viewMode === 'aggregate' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}
          onClick={() => handleChange('viewMode', 'aggregate')}
        >
          <BarChart size={18} />
          <span>Aggregates</span>
        </button>
      </div>
      
      {/* Specific day selector */}
      {viewMode === 'specificDay' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[80px]">Date:</label>
            <input 
              type="date" 
              value={specificDate.toISOString().split('T')[0]}
              onChange={(e) => handleChange('specificDate', e.target.value)}
              className="border rounded-md p-2"
            />
            <span className="text-sm text-gray-500">
              {specificDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <label className="min-w-[80px]">Time:</label>
              <input
                type="range"
                min="0"
                max="1439"
                step="15"
                value={timeValue}
                onChange={(e) => handleChange('timeValue', e.target.value)}
                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="min-w-[60px] text-center">{formatTime(timeValue)}</span>
            </div>
            <div className="flex justify-between px-1 text-xs text-gray-500">
              <span>12AM</span>
              <span>6AM</span>
              <span>12PM</span>
              <span>6PM</span>
              <span>12AM</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Day pattern selector */}
      {viewMode === 'dayPattern' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[80px]">Day:</label>
            <select 
              value={dayPattern}
              onChange={(e) => handleChange('dayPattern', e.target.value)}
              className="border rounded-md p-2"
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
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <label className="min-w-[80px]">Time:</label>
              <input
                type="range"
                min="0"
                max="1439"
                step="15"
                value={timeValue}
                onChange={(e) => handleChange('timeValue', e.target.value)}
                className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="min-w-[60px] text-center">{formatTime(timeValue)}</span>
            </div>
            <div className="flex justify-between px-1 text-xs text-gray-500">
              <span>12AM</span>
              <span>6AM</span>
              <span>12PM</span>
              <span>6PM</span>
              <span>12AM</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Aggregate selector */}
      {viewMode === 'aggregate' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[80px]">Pattern:</label>
            <select 
              value={aggregateType}
              onChange={(e) => handleChange('aggregateType', e.target.value)}
              className="border rounded-md p-2"
            >
              <option value="weekdays">Weekdays (Mon-Fri)</option>
              <option value="weekends">Weekends (Sat-Sun)</option>
              <option value="allDays">All Days</option>
              <option value="mornings">Morning Hours (6AM-9AM)</option>
              <option value="evenings">Evening Hours (4PM-7PM)</option>
            </select>
          </div>
          
          {(aggregateType !== 'mornings' && aggregateType !== 'evenings') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <label className="min-w-[80px]">Time:</label>
                <input
                  type="range"
                  min="0"
                  max="1439"
                  step="15"
                  value={timeValue}
                  onChange={(e) => handleChange('timeValue', e.target.value)}
                  className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="min-w-[60px] text-center">{formatTime(timeValue)}</span>
              </div>
              <div className="flex justify-between px-1 text-xs text-gray-500">
                <span>12AM</span>
                <span>6AM</span>
                <span>12PM</span>
                <span>6PM</span>
                <span>12AM</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimePatternSelector;