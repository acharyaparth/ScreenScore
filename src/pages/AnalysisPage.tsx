import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, AlertTriangle } from 'lucide-react';
import { 
  GenreSection,
  ToneThemesSection,
  CharacterSection,
  ProductionSection,
  AudienceSection,
  GreenlightSection
} from '../components/analysis';
import { ExportMenu } from '../components/export';
import { apiClient } from '../services/api';
import { ScreenplayAnalysis } from '../types';
import { Alert, Button, Card, LoadingSpinner, Progress } from '../components/shared';
import { analysisValidator } from '../services/validation';

interface AnalysisProgress {
  currentStep: number;
  totalSteps: number;
  currentType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

const AnalysisPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [analysis, setAnalysis] = useState<ScreenplayAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    currentStep: 0,
    totalSteps: 6,
    currentType: '',
    status: 'pending'
  });
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  useEffect(() => {
    const handleProgress = (event: CustomEvent<AnalysisProgress>) => {
      setProgress(event.detail);
    };

    window.addEventListener('analysisProgress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('analysisProgress', handleProgress as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        console.log('Fetching analysis with ID:', id);
        
        const data = await apiClient.getAnalysis(id.toString());
        console.log('Analysis data received:', data);
        
        // Check if data has the expected structure
        if (!data || typeof data !== 'object') {
          console.error('Invalid analysis data received', { data });
          setError('Invalid analysis data received from server');
          setLoading(false);
          return;
        }

        // Check for nested 'analysis' property
        const analysisData = 'analysis' in data && data.analysis ? data.analysis : data;
        console.log('Using analysis data:', analysisData);
        
        // Validate the required fields
        const requiredFields = ['genre', 'toneThemes', 'characters', 'production', 'audience', 'greenlight'];
        const missingFields = requiredFields.filter(field => 
          !analysisData || typeof analysisData !== 'object' || !(field in analysisData)
        );
        
        if (missingFields.length > 0) {
          console.error('Analysis data missing required fields', { 
            missingFields, 
            availableFields: analysisData && typeof analysisData === 'object' ? Object.keys(analysisData) : []
          });
          setError(`Analysis data is incomplete. Missing: ${missingFields.join(', ')}`);
          setLoading(false);
          return;
        }
        
        setAnalysis(analysisData as ScreenplayAnalysis);
        
        // Validate the analysis and show warnings
        const validation = analysisValidator.validateAnalysis(analysisData as ScreenplayAnalysis);
        setValidationWarnings(validation.warnings);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching analysis:', err);
        setError('Failed to load analysis data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-xl text-gray-300 mb-4">Loading analysis...</p>
        <Progress
          value={progress.currentStep}
          max={progress.totalSteps}
          className="w-full max-w-md"
        />
        <p className="text-sm text-gray-400 mt-2">
          {progress.currentType ? `Processing ${progress.currentType}...` : 'Retrieving data...'}
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="max-w-md mx-auto text-center py-12">
        <Alert
          type="error"
          title="Error Loading Analysis"
          message={error || 'Analysis data could not be loaded'}
          className="mb-6"
        />
        <Button
          variant="primary"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/')}
        >
          Return to Upload
        </Button>
      </Card>
    );
  }

  console.log('Rendering analysis:', { 
    title: analysis.title,
    fields: Object.keys(analysis),
    genre: analysis.genre,
    hasAllSections: Boolean(
      analysis.genre && 
      analysis.toneThemes && 
      analysis.characters && 
      analysis.production && 
      analysis.audience && 
      analysis.greenlight
    )
  });

  const missingNewFields =
    !analysis.genre?.originalityScore ||
    !analysis.characters?.characterArcs?.some(arc => arc.relatabilityScore) ||
    !analysis.production?.budgetEstimateBracket;

  return (
    <div className="animate-fade-in">
      {validationWarnings.length > 0 && (
        <Card className="mb-6 bg-yellow-900/20 border-yellow-500/20">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-yellow-500 font-medium mb-2">Analysis Warnings</h3>
              <ul className="list-disc list-inside space-y-1 text-yellow-400/80">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {missingNewFields && (
        <Alert type="warning" className="mb-4" message="Some advanced analysis fields are missing. This may be due to incomplete LLM output or a fallback template being used. Try re-running the analysis or check your LLM configuration." />
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <Button
            variant="outline"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/')}
            className="mb-4"
          >
            Back to Upload
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {analysis.title || 'Screenplay Analysis'}
          </h1>
          {analysis.author && (
            <p className="text-gray-400 mt-1">By {analysis.author}</p>
          )}
        </div>
        <div className="relative">
          <Button
            variant="primary"
            leftIcon={<Download size={16} />}
            onClick={() => setShowExportMenu(!showExportMenu)}
          >
            Export
          </Button>
          {showExportMenu && (
            <ExportMenu 
              analysis={analysis} 
              onClose={() => setShowExportMenu(false)}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <GenreSection data={analysis.genre} />
        </Card>
        <Card>
          <ToneThemesSection data={analysis.toneThemes} />
        </Card>
      </div>

      <div className="my-6">
        <Card>
          <CharacterSection data={analysis.characters} />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        <Card>
          <ProductionSection data={analysis.production} />
        </Card>
        <Card>
          <AudienceSection data={analysis.audience} />
        </Card>
      </div>

      <div className="my-6">
        <Card>
          <GreenlightSection data={analysis.greenlight} />
        </Card>
      </div>
    </div>
  );
};

export default AnalysisPage;