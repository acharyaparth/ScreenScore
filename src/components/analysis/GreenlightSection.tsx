import React from 'react';
import { Check, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { GreenlightAnalysis } from '../../types';

interface GreenlightSectionProps {
  data: GreenlightAnalysis;
}

const GreenlightSection: React.FC<GreenlightSectionProps> = ({ data }) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  
  const toggleDetails = () => {
    setDetailsOpen(!detailsOpen);
  };
  
  return (
    <div className="report-section">
      <h2 className="text-xl font-bold text-white mb-6">Greenlight Assessment</h2>
      <p className="text-gray-400 mb-6">The Greenlight Assessment brings together all aspects of your screenplay—story, characters, production, and audience—to provide a clear, actionable recommendation. Use this section to guide your next steps, whether it's moving forward, revising, or seeking further feedback.</p>
      
      <div className="mb-8">
        <div className={`
          p-6 rounded-lg mb-4 flex flex-col md:flex-row items-center justify-between
          ${getScoreBackgroundColor(data.score)}
        `}>
          <div className="flex items-center mb-4 md:mb-0">
            {getScoreIcon(data.score)}
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-white">{data.score} Potential</h3>
              <p className="text-gray-200">{getScoreMessage(data.score)}</p>
            </div>
          </div>
          
          <div className="text-center md:text-right">
            <div className="text-4xl font-bold text-white">{data.scorePercentage}%</div>
            <p className="text-gray-200">Greenlight Score</p>
          </div>
        </div>
        
        <p className="text-gray-300">{data.summary}</p>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Key Strengths</h3>
        <ul className="space-y-2">
          {data.strengths.map((strength, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-5 h-5 rounded-full bg-green-600 flex-shrink-0 flex items-center justify-center mt-0.5 mr-2">
                <Check className="w-3 h-3 text-white" />
              </span>
              <span className="text-gray-300">{strength}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Key Concerns</h3>
        <ul className="space-y-2">
          {data.concerns.map((concern, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-block w-5 h-5 rounded-full bg-red-600 flex-shrink-0 flex items-center justify-center mt-0.5 mr-2">
                <AlertTriangle className="w-3 h-3 text-white" />
              </span>
              <span className="text-gray-300">{concern}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <button
        className="w-full text-left py-3 text-gray-300 flex items-center justify-between border-t border-gray-700"
        onClick={toggleDetails}
      >
        <span className="font-semibold">Additional Assessment Details</span>
        {detailsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      
      {detailsOpen && (
        <div className="pt-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Market Potential</h4>
              <div className="flex items-center">
                <div className="w-full bg-gray-700 rounded-full h-2.5 mr-2">
                  <div
                    className="bg-primary-500 h-2.5 rounded-full"
                    style={{ width: `${data.marketPotential}%` }}
                  ></div>
                </div>
                <span className="text-white font-medium">{data.marketPotential}%</span>
              </div>
            </div>
            
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Budget Considerations</h4>
              <div className="flex items-center">
                <div className="w-full bg-gray-700 rounded-full h-2.5 mr-2">
                  <div
                    className="bg-secondary-500 h-2.5 rounded-full"
                    style={{ width: `${data.budgetConsiderations}%` }}
                  ></div>
                </div>
                <span className="text-white font-medium">{data.budgetConsiderations}%</span>
              </div>
            </div>
            
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Execution Complexity</h4>
              <div className="flex items-center">
                <div className="w-full bg-gray-700 rounded-full h-2.5 mr-2">
                  <div
                    className="bg-accent-500 h-2.5 rounded-full"
                    style={{ width: `${data.executionComplexity}%` }}
                  ></div>
                </div>
                <span className="text-white font-medium">{data.executionComplexity}%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700/30 p-4 rounded-lg mb-6">
            <h4 className="text-white font-medium mb-2">Recommendations</h4>
            <p className="text-gray-300">{data.recommendations}</p>
          </div>
        </div>
      )}
    </div>
  );
};

function getScoreBackgroundColor(score: string): string {
  switch (score.toLowerCase()) {
    case 'high':
      return 'bg-green-900/20 border border-green-700';
    case 'medium':
      return 'bg-yellow-900/20 border border-yellow-700';
    case 'low':
      return 'bg-red-900/20 border border-red-700';
    default:
      return 'bg-gray-800 border border-gray-700';
  }
}

function getScoreIcon(score: string): React.ReactNode {
  switch (score.toLowerCase()) {
    case 'high':
      return (
        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
          <Check className="w-6 h-6 text-white" />
        </div>
      );
    case 'medium':
      return (
        <div className="w-12 h-12 rounded-full bg-yellow-600 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
      );
    case 'low':
      return (
        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
          <X className="w-6 h-6 text-white" />
        </div>
      );
    default:
      return null;
  }
}

function getScoreMessage(score: string): string {
  switch (score.toLowerCase()) {
    case 'high':
      return 'Strong candidate for production';
    case 'medium':
      return 'Consider with revisions';
    case 'low':
      return 'Significant challenges identified';
    default:
      return '';
  }
}

export default GreenlightSection;