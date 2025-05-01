import React from 'react';
import { Clapperboard, Map, Tv, Camera } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ProductionAnalysis } from '../../types';

interface ProductionSectionProps {
  data: ProductionAnalysis;
}

const ProductionSection: React.FC<ProductionSectionProps> = ({ data }) => {
  // Transform location data for chart
  const locationData = [
    { name: 'Interior', value: data.locations.interior },
    { name: 'Exterior', value: data.locations.exterior },
  ];
  
  return (
    <div className="report-section">
      <div className="flex items-center mb-4">
        <Clapperboard className="w-5 h-5 text-accent-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Production Complexity</h2>
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-200 flex items-center">
            <Map className="w-4 h-4 mr-2" />
            Locations
          </h3>
          <span className="text-gray-400 text-sm">
            Total: {data.locations.interior + data.locations.exterior}
          </span>
        </div>
        
        <div className="h-[150px] mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={locationData}
              margin={{
                top: 5,
                right: 5,
                bottom: 5,
                left: 5,
              }}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.375rem' }}
                labelStyle={{ color: 'white' }}
              />
              <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="text-sm text-gray-400 mb-4">
          Top locations: {data.topLocations.join(', ')}
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center">
          <Camera className="w-4 h-4 mr-2" />
          Special Requirements
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">VFX Shots</p>
            <p className="text-xl font-bold text-white">{data.vfxShots}</p>
          </div>
          <div className="bg-gray-700/50 p-3 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Stunt Scenes</p>
            <p className="text-xl font-bold text-white">{data.stuntScenes}</p>
          </div>
        </div>
        
        {data.specialRequirements.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-medium mb-2">Special Requirements:</h4>
            <ul className="space-y-1">
              {data.specialRequirements.map((req, index) => (
                <li key={index} className="flex items-start">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-400 mt-2 mr-2"></span>
                  <span className="text-gray-300">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2 flex items-center">
          <Tv className="w-4 h-4 mr-2" />
          Set Pieces
        </h3>
        
        <div className="mb-2">
          <p className="text-gray-300">
            Large set pieces: <span className="text-white font-medium">{data.largeSetPieces}</span>
          </p>
        </div>
        
        {data.notableSetPieces.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-medium mb-2">Notable Set Pieces:</h4>
            {data.notableSetPieces.map((piece, index) => (
              <div key={index} className="mb-2 p-2 bg-gray-700/30 rounded-md text-gray-300 text-sm">
                {piece}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionSection;