import { ScreenplayAnalysis, GenreAnalysis, ToneThemesAnalysis, CharacterAnalysis, ProductionAnalysis, AudienceAnalysis, GreenlightAnalysis } from '../types';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

class AnalysisValidator {
  private static instance: AnalysisValidator;

  private constructor() {}

  public static getInstance(): AnalysisValidator {
    if (!AnalysisValidator.instance) {
      AnalysisValidator.instance = new AnalysisValidator();
    }
    return AnalysisValidator.instance;
  }

  private validateGenre(genre: GenreAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!genre.primaryGenre) {
      errors.push('Primary genre is required');
    }

    if (!genre.genreConfidence || Object.keys(genre.genreConfidence).length === 0) {
      errors.push('Genre confidence scores are required');
    } else {
      const confidenceValues = Object.values(genre.genreConfidence);
      if (confidenceValues.some(score => score < 0 || score > 1)) {
        errors.push('Genre confidence scores must be between 0 and 1');
      }
    }

    if (!genre.genreInsights || genre.genreInsights.length < 50) {
      warnings.push('Genre insights should be more detailed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateToneThemes(toneThemes: ToneThemesAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!toneThemes.emotionalTones || toneThemes.emotionalTones.length === 0) {
      errors.push('At least one emotional tone is required');
    }

    if (!toneThemes.majorThemes || toneThemes.majorThemes.length === 0) {
      errors.push('At least one major theme is required');
    }

    if (!toneThemes.toneAnalysis || toneThemes.toneAnalysis.length < 100) {
      warnings.push('Tone analysis should be more detailed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateCharacters(characters: CharacterAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (characters.totalCharacters < 0) {
      errors.push('Total characters cannot be negative');
    }

    if (characters.speakingRoles > characters.totalCharacters) {
      errors.push('Speaking roles cannot exceed total characters');
    }

    if (!characters.genderBreakdown) {
      errors.push('Gender breakdown is required');
    } else {
      const { male, female, other } = characters.genderBreakdown;
      const total = male + female + other;
      if (total !== characters.totalCharacters) {
        warnings.push('Gender breakdown total does not match total characters');
      }
    }

    if (!characters.characterArcs || characters.characterArcs.length === 0) {
      warnings.push('No character arcs provided');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateProduction(production: ProductionAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!production.locations) {
      errors.push('Location counts are required');
    } else {
      if (production.locations.interior < 0 || production.locations.exterior < 0) {
        errors.push('Location counts cannot be negative');
      }
    }

    if (!production.topLocations || production.topLocations.length === 0) {
      warnings.push('No top locations provided');
    }

    if (production.vfxShots < 0) {
      errors.push('VFX shots cannot be negative');
    }

    if (production.stuntScenes < 0) {
      errors.push('Stunt scenes cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateAudience(audience: AudienceAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!audience.contentRating) {
      errors.push('Content rating is required');
    }

    if (!audience.targetDemographics) {
      errors.push('Target demographics are required');
    } else {
      if (!audience.targetDemographics.ageGroups || audience.targetDemographics.ageGroups.length === 0) {
        errors.push('At least one target age group is required');
      }
    }

    if (!audience.audienceAppealSummary || audience.audienceAppealSummary.length < 100) {
      warnings.push('Audience appeal summary should be more detailed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateGreenlight(greenlight: GreenlightAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!greenlight.score) {
      errors.push('Greenlight score is required');
    }

    if (greenlight.scorePercentage < 0 || greenlight.scorePercentage > 100) {
      errors.push('Score percentage must be between 0 and 100');
    }

    if (!greenlight.strengths || greenlight.strengths.length === 0) {
      warnings.push('No strengths identified');
    }

    if (!greenlight.concerns || greenlight.concerns.length === 0) {
      warnings.push('No concerns identified');
    }

    if (!greenlight.recommendations || greenlight.recommendations.length < 50) {
      warnings.push('Recommendations should be more detailed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  public validateAnalysis(analysis: ScreenplayAnalysis): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!analysis.id) {
      errors.push('Analysis ID is required');
    }

    if (!analysis.timestamp) {
      errors.push('Timestamp is required');
    }

    // Validate each section
    const genreValidation = this.validateGenre(analysis.genre);
    const toneThemesValidation = this.validateToneThemes(analysis.toneThemes);
    const charactersValidation = this.validateCharacters(analysis.characters);
    const productionValidation = this.validateProduction(analysis.production);
    const audienceValidation = this.validateAudience(analysis.audience);
    const greenlightValidation = this.validateGreenlight(analysis.greenlight);

    // Collect all errors and warnings
    errors.push(
      ...genreValidation.errors,
      ...toneThemesValidation.errors,
      ...charactersValidation.errors,
      ...productionValidation.errors,
      ...audienceValidation.errors,
      ...greenlightValidation.errors
    );

    warnings.push(
      ...genreValidation.warnings,
      ...toneThemesValidation.warnings,
      ...charactersValidation.warnings,
      ...productionValidation.warnings,
      ...audienceValidation.warnings,
      ...greenlightValidation.warnings
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export const analysisValidator = AnalysisValidator.getInstance(); 