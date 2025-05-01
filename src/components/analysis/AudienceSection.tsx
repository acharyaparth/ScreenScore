import React from 'react';
import { Users, Info } from 'lucide-react';
import { AudienceAnalysis } from '../../types';

interface AudienceSectionProps {
  data: AudienceAnalysis;
}

const AudienceSection: React.FC<AudienceSectionProps> = ({ data }) => {
  return (
    <div className="report-section">
      <div className="flex items-center mb-4">
        <Users className="w-5 h-5 text-accent-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Audience Fit</h2>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Suggested Rating</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`
              w-12 h-12 flex items-center justify-center rounded-md font-bold text-lg mr-3
              ${getRatingColor(data.contentRating)}
            `}>
              {data.contentRating}
            </div>
            <div>
              <p className="text-white font-medium">{getRatingName(data.contentRating)}</p>
              <p className="text-gray-400 text-sm">{getRatingDescription(data.contentRating)}</p>
            </div>
          </div>
          
          <button className="text-gray-400 hover:text-white p-1" aria-label="Rating info">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Target Demographics</h3>
        
        <div className="space-y-3">
          <div>
            <p className="text-gray-400 mb-1">Age Groups</p>
            <div className="flex flex-wrap gap-2">
              {data.targetDemographics.ageGroups.map((age, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm text-white"
                >
                  {age}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-gray-400 mb-1">Gender Appeal</p>
            <div className="flex flex-wrap gap-2">
              {data.targetDemographics.genderAppeal.map((gender, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm text-white"
                >
                  {gender}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <p className="text-gray-400 mb-1">Interest Groups</p>
            <div className="flex flex-wrap gap-2">
              {data.targetDemographics.interestGroups.map((interest, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm text-white"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Content Notes</h3>
        
        {data.contentWarnings.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-400 mb-2">Content Warnings:</p>
            <div className="flex flex-wrap gap-2">
              {data.contentWarnings.map((warning, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-sm"
                >
                  {warning}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-gray-300">{data.audienceAppealSummary}</p>
      </div>
    </div>
  );
};

function getRatingColor(rating: string): string {
  switch (rating) {
    case 'G':
      return 'bg-green-600 text-white';
    case 'PG':
      return 'bg-blue-600 text-white';
    case 'PG-13':
      return 'bg-yellow-600 text-black';
    case 'R':
      return 'bg-red-600 text-white';
    case 'NC-17':
      return 'bg-red-800 text-white';
    default:
      return 'bg-gray-600 text-white';
  }
}

function getRatingName(rating: string): string {
  switch (rating) {
    case 'G':
      return 'General Audiences';
    case 'PG':
      return 'Parental Guidance Suggested';
    case 'PG-13':
      return 'Parents Strongly Cautioned';
    case 'R':
      return 'Restricted';
    case 'NC-17':
      return 'Adults Only';
    default:
      return 'Not Rated';
  }
}

function getRatingDescription(rating: string): string {
  switch (rating) {
    case 'G':
      return 'All ages admitted';
    case 'PG':
      return 'Some material may not be suitable for children';
    case 'PG-13':
      return 'Some material may be inappropriate for children under 13';
    case 'R':
      return 'Under 17 requires accompanying parent or adult guardian';
    case 'NC-17':
      return 'No one 17 and under admitted';
    default:
      return 'Not officially rated';
  }
}

export default AudienceSection;