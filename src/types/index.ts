// Genre Analysis Types
export interface GenreAnalysis {
  primaryGenre: string;
  subGenres?: string[];
  genreConfidence: Record<string, number>;
  genreInsights: string;
}

// Tone & Themes Analysis Types
export interface ToneThemesAnalysis {
  emotionalTones: string[];
  majorThemes: string[];
  toneAnalysis: string;
}

// Character Analysis Types
export interface CharacterArc {
  character: string;
  arc: string;
}

export interface GenderBreakdown {
  male: number;
  female: number;
  other: number;
}

export interface CharacterAnalysis {
  totalCharacters: number;
  speakingRoles: number;
  mainCharacters: number;
  supportingRoles: number;
  genderBreakdown: GenderBreakdown;
  diversityAssessment: string;
  characterArcs: CharacterArc[];
}

// Production Analysis Types
export interface LocationCount {
  interior: number;
  exterior: number;
}

export interface ProductionAnalysis {
  locations: LocationCount;
  topLocations: string[];
  vfxShots: number;
  stuntScenes: number;
  largeSetPieces: number;
  specialRequirements: string[];
  notableSetPieces: string[];
}

// Audience Analysis Types
export interface TargetDemographics {
  ageGroups: string[];
  genderAppeal: string[];
  interestGroups: string[];
}

export interface AudienceAnalysis {
  contentRating: string;
  targetDemographics: TargetDemographics;
  contentWarnings: string[];
  audienceAppealSummary: string;
}

// Greenlight Analysis Types
export interface GreenlightAnalysis {
  score: string;
  scorePercentage: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  marketPotential: number;
  budgetConsiderations: number;
  executionComplexity: number;
  recommendations: string;
}

// Complete Analysis Type
export interface ScreenplayAnalysis {
  id: string;
  title?: string;
  author?: string;
  timestamp: string;
  genre: GenreAnalysis;
  toneThemes: ToneThemesAnalysis;
  characters: CharacterAnalysis;
  production: ProductionAnalysis;
  audience: AudienceAnalysis;
  greenlight: GreenlightAnalysis;
}