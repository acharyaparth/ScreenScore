import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Film, Clapperboard } from 'lucide-react';
import { FileUpload } from '../components/upload';
import { Hero, FeatureList, HowItWorks } from '../components/marketing';
import { Alert, Card, LoadingSpinner } from '../components/shared';

const FileUploadPage: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUploadSuccess = (response: { analysis: any; analysisId: string }) => {
    navigate(`/analysis/${response.analysisId}`);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setIsUploading(false);
  };

  const features = [
    {
      icon: <FileText className="w-8 h-8 text-accent-400" />,
      title: 'Local, Private AI',
      description: 'All analysis is performed by a powerful AI model running entirely on your device. Your screenplay never leaves your computer.'
    },
    {
      icon: <Film className="w-8 h-8 text-primary-400" />,
      title: 'Comprehensive Story Insights',
      description: 'Get deep analysis of genre, tone, character arcs, and narrative structure—tailored for film and TV professionals.'
    },
    {
      icon: <Clapperboard className="w-8 h-8 text-secondary-400" />,
      title: 'Production & Market Readiness',
      description: 'Assess production complexity, budget range, and audience fit with actionable, industry-focused reporting.'
    }
  ];

  return (
    <div className="space-y-12 animate-fade-in">
      <Hero
        title="Screenplay Analysis Tool"
        subtitle="Upload your screenplay and get comprehensive analysis to help with greenlighting decisions"
        ctaText="Get Started"
      />

      <Card className="max-w-2xl mx-auto">
        {error && (
          <Alert
            type="error"
            title="Upload Error"
            message={error}
            onClose={() => setError(null)}
            className="mb-4"
          />
        )}
        
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <LoadingSpinner size="lg" className="mb-4" />
            <p className="text-gray-600">Analyzing your screenplay...</p>
          </div>
        ) : (
      <FileUpload 
        onUploadStart={() => setIsUploading(true)}
        onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
        isUploading={isUploading}
      />
        )}
      </Card>

      <div id="how-it-works">
        <HowItWorks />
      </div>

      <FeatureList 
        title="Analyze for Success—With Complete Privacy" 
        subtitle="ScreenScore runs 100% locally, using open-source AI. Your data stays private, and your creative work never leaves your machine."
        features={features}
      />
    </div>
  );
};

export default FileUploadPage;