import React from 'react';
import { MessageCircle } from 'lucide-react';
import { ToneThemesAnalysis } from '../../types';

interface ToneThemesSectionProps {
  data: ToneThemesAnalysis;
}

const ToneThemesSection: React.FC<ToneThemesSectionProps> = ({ data }) => {
  return (
    <div className="report-section">
      <div className="flex items-center mb-4">
        <MessageCircle className="w-5 h-5 text-accent-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Tone & Themes</h2>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Emotional Tone</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.emotionalTones.map((tone, index) => (
            <span 
              key={index}
              className="px-3 py-1 bg-gray-700 rounded-full text-sm"
            >
              {tone}
            </span>
          ))}
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Major Themes</h3>
        <ul className="space-y-2">
          {data.majorThemes.map((theme, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-400 mt-2 mr-2"></span>
              <span className="text-gray-300">{theme}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Tone Analysis</h3>
        <p className="text-gray-300">{data.toneAnalysis}</p>
      </div>
    </div>
  );
};

export default ToneThemesSection;