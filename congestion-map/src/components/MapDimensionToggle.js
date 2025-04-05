// for changing whether it appears in 2d or 3d
import React from 'react';
import { Layers, Square } from 'lucide-react';

const MapDimensionToggle = ({ is3D, setIs3D }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-500">Map Type:</span>
      <div className="flex bg-gray-100 rounded-md">
        <button
          className={`flex items-center gap-1 px-3 py-1 rounded-md ${!is3D ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={() => setIs3D(false)}
        >
          <Square size={16} />
          <span className="text-sm">2D</span>
        </button>
        <button
          className={`flex items-center gap-1 px-3 py-1 rounded-md ${is3D ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={() => setIs3D(true)}
        >
          <Layers size={16} />
          <span className="text-sm">3D</span>
        </button>
      </div>
    </div>
  );
};

export default MapDimensionToggle;