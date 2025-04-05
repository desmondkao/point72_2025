import React from 'react';
import { Calendar } from 'lucide-react';

const DateSelector = ({ selectedDate, setSelectedDate }) => {
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    setSelectedDate(newDate);
  };

  // format date to YYYY-MM-DD for input
  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  // format date to display format
  const formatDateForDisplay = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar size={16} />
      <div className="relative">
        <input
          type="date"
          value={formatDateForInput(selectedDate)}
          onChange={handleDateChange}
          className="border border-gray-300 rounded-md p-1 text-sm"
        />
        <div className="absolute -bottom-6 left-0 text-xs text-gray-600">
          {formatDateForDisplay(selectedDate)}
        </div>
      </div>
    </div>
  );
};

export default DateSelector;