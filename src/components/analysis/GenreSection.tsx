import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Tag } from 'lucide-react';
import { GenreAnalysis } from '../../types';

interface GenreSectionProps {
  data: GenreAnalysis;
}

const GenreSection: React.FC<GenreSectionProps> = ({ data }) => {
  // Transform genres into chart data
  const chartData = Object.entries(data.genreConfidence).map(([genre, confidence]) => ({
    name: genre,
    confidence: Math.round(confidence * 100)
  })).sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="report-section">
      <div className="flex items-center mb-4">
        <Tag className="w-5 h-5 text-accent-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Genre Detection</h2>
      </div>
      <p className="text-gray-400 mb-6">Genre analysis helps you understand how your screenplay will be perceived by industry professionals and audiences. This section identifies the primary and secondary genres, measures originality, and highlights unique narrative elements that set your script apart.</p>
      
      <div className="mb-4">
        <p className="text-gray-300">
          Primary Genre: <span className="font-semibold text-white">{data.primaryGenre}</span>
        </p>
        {Array.isArray(data.subGenres) && data.subGenres.length > 0 && (
          <p className="text-gray-300 mt-1">
            Sub-genres: <span className="text-white">{data.subGenres.join(', ')}</span>
          </p>
        )}
      </div>
      
      <div className="mt-6 h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Confidence']}
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.375rem' }}
              labelStyle={{ color: 'white' }}
            />
            <Bar 
              dataKey="confidence" 
              fill="#0ea5e9" 
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Genre Insights</h3>
        <p className="text-gray-300">{data.genreInsights}</p>
      </div>
      {typeof data.originalityScore === 'number' && (
        <div className="mt-4">
          <h4 className="text-md font-semibold text-accent-400 mb-1">Originality Score</h4>
          <p className="text-gray-300">{(data.originalityScore * 100).toFixed(0)} / 100</p>
        </div>
      )}
      {data.socialCommentary && (
        <div className="mt-2">
          <h4 className="text-md font-semibold text-accent-400 mb-1">Social Commentary</h4>
          <p className="text-gray-300">{data.socialCommentary}</p>
        </div>
      )}
      {data.narrativeEngagement && (
        <div className="mt-2">
          <h4 className="text-md font-semibold text-accent-400 mb-1">Narrative Engagement</h4>
          <p className="text-gray-300">{data.narrativeEngagement}</p>
        </div>
      )}
      {data.keyOriginalElements && data.keyOriginalElements.length > 0 && (
        <div className="mt-2">
          <h4 className="text-md font-semibold text-accent-400 mb-1">Key Original Elements</h4>
          <ul className="list-disc list-inside text-gray-300">
            {data.keyOriginalElements.map((el, i) => (
              <li key={i}>{el}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GenreSection;