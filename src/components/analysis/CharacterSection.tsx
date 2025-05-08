import React from 'react';
import { Users, UserCircle, Meh, UserCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Text } from 'recharts';
import { CharacterAnalysis } from '../../types';

interface CharacterSectionProps {
  data: CharacterAnalysis;
}

const CharacterSection: React.FC<CharacterSectionProps> = ({ data }) => {
  // Character count by gender chart data
  const genderData = [
    { name: 'Male', value: data.genderBreakdown.male },
    { name: 'Female', value: data.genderBreakdown.female },
    { name: 'Other/Unknown', value: data.genderBreakdown.other }
  ].filter(item => item.value > 0);

  const COLORS = ['#0284c7', '#14b8a6', '#f59e0b', '#ef4444'];
  
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    index: number;
    name: string;
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.7;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={13}
        fontWeight={500}
        style={{ pointerEvents: 'none' }}
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="report-section">
      <div className="flex items-center mb-6">
        <Users className="w-5 h-5 text-accent-400 mr-2" />
        <h2 className="text-xl font-bold text-white">Character Analysis</h2>
      </div>
      <p className="text-gray-400 mb-6">A strong cast of characters is essential for compelling storytelling. This section breaks down your script's character diversity, gender balance, and the depth of main character arcs—key factors for both creative and commercial success.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
              <UserCircle className="w-4 h-4 mr-2" />
              Character Counts
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Total Characters</p>
                <p className="text-2xl font-bold text-white">{data.totalCharacters}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Speaking Roles</p>
                <p className="text-2xl font-bold text-white">{data.speakingRoles}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Main Characters</p>
                <p className="text-2xl font-bold text-white">{data.mainCharacters}</p>
              </div>
              <div className="bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Supporting Roles</p>
                <p className="text-2xl font-bold text-white">{data.supportingRoles}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
              <Meh className="w-4 h-4 mr-2" />
              Diversity Assessment
            </h3>
            <p className="text-gray-300 mb-4">{data.diversityAssessment}</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
            <UserCheck className="w-4 h-4 mr-2" />
            Gender Breakdown
          </h3>
          
          <div className="h-[200px] mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={renderCustomLabel}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, 'Count']}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.375rem' }}
                  labelStyle={{ color: 'white' }}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconType="circle" wrapperStyle={{ marginTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Main Character Arcs</h3>
            {data.characterArcs.map((arc, index) => (
              <div key={index} className="mb-4 p-3 bg-gray-700/30 rounded-md">
                <p className="font-medium text-white mb-1">{arc.character}</p>
                <p className="text-gray-400 text-sm mb-1">{arc.arc}</p>
                {typeof arc.relatabilityScore === 'number' && (
                  <p className="text-gray-300 text-xs mb-1">Relatability Score: {(arc.relatabilityScore * 100).toFixed(0)} / 100</p>
                )}
                {typeof arc.emotionalInvestmentScore === 'number' && (
                  <p className="text-gray-300 text-xs mb-1">Emotional Investment: {(arc.emotionalInvestmentScore * 100).toFixed(0)} / 100</p>
                )}
                {arc.arcCompleteness && (
                  <p className="text-gray-300 text-xs mb-1">Arc Completeness: {arc.arcCompleteness}</p>
                )}
                {arc.notableDialogue && arc.notableDialogue.length > 0 && (
                  <div className="mt-1">
                    <p className="text-gray-300 text-xs font-semibold">Notable Dialogue:</p>
                    <ul className="list-disc list-inside text-gray-300 text-xs">
                      {arc.notableDialogue.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSection;