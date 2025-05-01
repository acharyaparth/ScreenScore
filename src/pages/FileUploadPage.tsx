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
      icon: <FileText className="w-8 h-8 text-primary-400" />,
      title: 'Genre Detection',
      description: 'Identify the most likely genre based on language, tone, and scene content.'
    },
    {
      icon: <Film className="w-8 h-8 text-primary-400" />,
      title: 'Character Analysis',
      description: 'Count speaking roles, estimate diversity, and highlight character arcs.'
    },
    {
      icon: <Clapperboard className="w-8 h-8 text-primary-400" />,
      title: 'Production Complexity',
      description: 'Analyze locations, VFX needs, stunts, and set pieces required.'
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
        title="Analyze Your Screenplay for Success" 
        subtitle="Get insights that help make informed greenlighting decisions"
        features={features}
      />
    </div>
  );
};

export default FileUploadPage;