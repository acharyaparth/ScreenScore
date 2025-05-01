import React from 'react';
import { Upload, Brain, FileText, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: <Upload className="w-8 h-8 text-primary-400" />,
    title: "Upload Screenplay",
    description: "Upload your screenplay in PDF or TXT format. Maximum file size is 10MB."
  },
  {
    icon: <Brain className="w-8 h-8 text-primary-400" />,
    title: "AI Analysis",
    description: "Our local AI model analyzes your screenplay for genre, tone, characters, and production requirements."
  },
  {
    icon: <FileText className="w-8 h-8 text-primary-400" />,
    title: "Detailed Report",
    description: "Receive a comprehensive analysis report with insights for greenlighting decisions."
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-primary-400" />,
    title: "Make Decisions",
    description: "Use the generated insights to evaluate production potential and requirements."
  }
];

const HowItWorks: React.FC = () => {
  return (
    <div className="py-16 bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="relative flex flex-col items-center text-center"
            >
              <div className="mb-4 p-4 bg-gray-800 rounded-full">
                {step.icon}
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary-400 to-transparent" />
              )}
              
              <h3 className="text-xl font-bold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-gray-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;