import React from 'react';
import { Map, LineChart } from 'lucide-react';

// Select the view mode - map or graph (data stuff - TBD if doing or not)
const VisualizationModeSelector = ({ selectedMode, setSelectedMode }) => {
  const modes = [
    { id: 'map', name: 'Map View', icon: <Map size={18} />, description: 'Congestion heatmap' },
    { id: 'graph', name: 'Graph View', icon: <LineChart size={18} />, description: 'Time analysis' }
  ];

  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-gray-500 mb-2">View Mode</h3>
      <div className="flex gap-2">
        {modes.map(mode => (
          <button
            key={mode.id}
            className={`flex items-center gap-2 p-2 rounded-md ${
              selectedMode === mode.id 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-white border border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedMode(mode.id)}
          >
            {mode.icon}
            <span className="text-sm font-medium">{mode.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VisualizationModeSelector;