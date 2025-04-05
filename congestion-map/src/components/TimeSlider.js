import React from 'react';

const TimeSlider = ({ selectedTime, setSelectedTime }) => {
  // conv time string (HH:MM) to minutes for the slider
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // conv minutes back to time string (HH:MM)
  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const minutes = parseInt(e.target.value, 10);
    setSelectedTime(minutesToTime(minutes));
  };

  return (
    <div className="flex items-center gap-4 flex-grow max-w-md">
      <span className="text-sm font-medium">Time:</span>
      <input
        type="range"
        min="0"
        max="1439"
        step="10"
        value={timeToMinutes(selectedTime)}
        onChange={handleChange}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      <span className="text-sm font-semibold min-w-[60px]">{selectedTime}</span>
    </div>
  );
};

export default TimeSlider;