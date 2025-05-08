import { ScreenplayAnalysis } from '../types';
import { analysisCache } from './cache';
import { analysisValidator } from './validation';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'mistral:7b-instruct-q4_K_M';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface AnalysisPrompt {
  screenplay: string;
  analysisType: 'genre' | 'tone' | 'characters' | 'production' | 'audience' | 'greenlight';
}

interface AnalysisProgress {
  currentStep: number;
  totalSteps: number;
  currentType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

const generatePrompt = ({ screenplay, analysisType }: AnalysisPrompt): string => {
  const basePrompt = `[INST] You are an expert screenplay analyst with extensive experience in film and television production. Your task is to analyze the following screenplay excerpt and provide detailed, professional insights. Focus on the following aspects:

${screenplay}

Please provide a detailed analysis in JSON format with the following structure. Be specific and provide concrete examples from the text where possible. Use industry-standard terminology and consider both commercial and artistic aspects.

Respond ONLY with valid JSON matching the schema below. Do not include any extra commentary or explanation. Do not add any keys not present in the schema.

`;

  const analysisPrompts = {
    genre: `{
  "primaryGenre": "string (e.g., 'Action', 'Drama', 'Comedy', 'Thriller')",
  "secondaryGenres": ["string (list of supporting genres that enhance the primary genre)"],
  "confidence": "number (0-1, indicating confidence in genre classification)",
  "keyElements": ["string (specific scenes, dialogue, or plot points that define the genre)"],
  "reasoning": "string (detailed explanation of genre classification, including tone, themes, and narrative structure)",
  "subgenre": "string (if applicable, e.g., 'Psychological Thriller', 'Romantic Comedy')",
  "genreConventions": ["string (how the screenplay follows or subverts genre conventions)"],
  "originalityScore": "number (0-1, how fresh/unique is the concept)",
  "socialCommentary": "string (does the script address social issues? How?)",
  "narrativeEngagement": "string (is the story compelling? Where does it drag or shine?)",
  "keyOriginalElements": ["string (concrete examples of originality or twist)"]
}`,
    tone: `{
  "overallTone": "string (the dominant emotional quality of the screenplay)",
  "themes": ["string (major thematic elements and their development)"],
  "mood": "string (the emotional atmosphere created)",
  "style": "string (writing style, pacing, and narrative approach)",
  "keyScenes": ["string (scenes that best exemplify the tone and themes)"],
  "emotionalArc": "string (how the emotional tone evolves throughout the story)",
  "dialogueStyle": "string (characteristic features of the dialogue)",
  "visualStyle": "string (suggested visual approach based on tone)"
}`,
    characters: `{
  "mainCharacters": [{
    "name": "string",
    "role": "string (protagonist, antagonist, etc.)",
    "arc": "string (character development and transformation)",
    "significance": "string (importance to the story)",
    "motivations": ["string (key driving forces)"],
    "conflicts": ["string (internal and external conflicts)"],
    "relationships": ["string (key relationships with other characters)"],
    "relatabilityScore": "number (0-1, how relatable is the character)",
    "emotionalInvestmentScore": "number (0-1, how much does the script make the audience care)",
    "arcCompleteness": "string (is the arc earned and satisfying?)",
    "notableDialogue": ["string (1-2 lines that exemplify character strengths/weaknesses)"]
  }],
  "supportingCharacters": [{
    "name": "string",
    "role": "string (function in the story)",
    "significance": "string (how they support the main narrative)",
    "relationships": ["string (connections to main characters)"]
  }],
  "characterDynamics": ["string (key interactions and relationships)"],
  "characterDevelopment": "string (overall character growth and evolution)",
  "castingConsiderations": ["string (suggested actor types or qualities)"]
}`,
    production: `{
  "locations": ["string (specific settings and their requirements)"],
  "specialEffects": ["string (VFX, practical effects, etc.)"],
  "stunts": ["string (action sequences and safety considerations)"],
  "setPieces": ["string (major set pieces and their complexity)"],
  "budgetConsiderations": ["string (cost implications of various elements)"],
  "technicalRequirements": ["string (specialized equipment or expertise needed)"],
  "productionChallenges": ["string (potential difficulties in production)"],
  "resourceNeeds": ["string (crew, equipment, and other resources required)"],
  "budgetEstimateBracket": "string (Low, Medium, High)",
  "highRiskElements": ["string (scenes or requirements that are costly or risky)"],
  "productionFeasibilityScore": "number (0-1, how realistic is the script to produce)"
}`,
    audience: `{
  "targetDemographic": "string (primary and secondary audience groups)",
  "marketPotential": "string (commercial viability and market appeal)",
  "comparables": ["string (similar successful projects)"],
  "uniqueSellingPoints": ["string (distinctive features that appeal to audiences)"],
  "audienceAppeal": "string (why audiences would be drawn to this project)",
  "marketingAngles": ["string (potential marketing approaches)"],
  "distributionChannels": ["string (suggested platforms or venues)"],
  "culturalRelevance": "string (contemporary cultural connections)"
}`,
    greenlight: `{
  "recommendation": "string (clear yes/no/maybe with reasoning)",
  "strengths": ["string (key positive aspects)"],
  "concerns": ["string (potential issues or risks)"],
  "suggestedImprovements": ["string (specific recommendations)"],
  "confidence": "number (0-1, indicating confidence in recommendation)",
  "budgetEstimate": "string (rough budget range)",
  "timelineEstimate": "string (estimated production timeline)",
  "riskAssessment": "string (evaluation of potential risks)",
  "commercialPotential": "string (box office or viewership potential)"
}`
  };

  return `${basePrompt}${analysisPrompts[analysisType]}[/INST]`;
};

class OllamaService {
  private progress: AnalysisProgress = {
    currentStep: 0,
    totalSteps: 6,
    currentType: '',
    status: 'pending'
  };

  private updateProgress(step: number, type: string, status: 'pending' | 'in_progress' | 'completed' | 'error', error?: string) {
    this.progress = {
      currentStep: step,
      totalSteps: 6,
      currentType: type,
      status,
      error
    };
    // Dispatch progress event
    window.dispatchEvent(new CustomEvent('analysisProgress', { detail: this.progress }));
  }

  async analyzeScreenplay(screenplay: string): Promise<ScreenplayAnalysis> {
    try {
      // Check cache first
      const cached = await analysisCache.get(screenplay);
      if (cached) {
        this.updateProgress(6, 'all', 'completed');
        return cached;
      }

      const analysisTypes: Array<'genre' | 'tone' | 'characters' | 'production' | 'audience' | 'greenlight'> = [
        'genre',
        'tone',
        'characters',
        'production',
        'audience',
        'greenlight'
      ];

      const analysisResults = await Promise.all(
        analysisTypes.map(async (type, index) => {
          this.updateProgress(index + 1, type, 'in_progress');
          try {
            const prompt = generatePrompt({ screenplay, analysisType: type });
            const response = await this.generateResponse(prompt);
            const parsedData = JSON.parse(response);
            this.updateProgress(index + 1, type, 'completed');
            return { type, data: parsedData };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateProgress(index + 1, type, 'error', errorMessage);
            throw error;
          }
        })
      );

      const analysis: ScreenplayAnalysis = {
        id: Date.now().toString(),
        title: 'Screenplay Analysis',
        timestamp: new Date().toISOString(),
        genre: analysisResults.find(r => r.type === 'genre')?.data,
        toneThemes: analysisResults.find(r => r.type === 'tone')?.data,
        characters: analysisResults.find(r => r.type === 'characters')?.data,
        production: analysisResults.find(r => r.type === 'production')?.data,
        audience: analysisResults.find(r => r.type === 'audience')?.data,
        greenlight: analysisResults.find(r => r.type === 'greenlight')?.data,
      };

      // Validate the analysis
      const validation = analysisValidator.validateAnalysis(analysis);
      if (!validation.isValid) {
        console.warn('Analysis validation warnings:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`Analysis validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Cache the results
      await analysisCache.set(screenplay, analysis);
      this.updateProgress(6, 'all', 'completed');
      return analysis;
    } catch (error) {
      console.error('Error analyzing screenplay:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress(0, 'all', 'error', errorMessage);
      throw new Error('Failed to analyze screenplay');
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate analysis');
    }
  }

  async checkModelAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.models.some((model: { name: string }) => model.name === MODEL_NAME);
    } catch (error) {
      console.error('Error checking model availability:', error);
      return false;
    }
  }

  getProgress(): AnalysisProgress {
    return this.progress;
  }
}

export const ollamaService = new OllamaService(); 