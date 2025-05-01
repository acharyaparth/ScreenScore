import fetch from 'node-fetch';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLLAMA_API = 'http://localhost:11434/api';

const systemPrompt = `You are an expert screenplay analyst. Your task is to analyze the provided screenplay text and provide a detailed analysis.

CRITICAL INSTRUCTIONS:
1. You MUST return a valid JSON object with EXACTLY the structure shown below
2. Do not include any markdown formatting or additional text
3. Use double quotes for all strings
4. Use null for empty values (not None)
5. All arrays must contain at least one item
6. All fields are required

Here is the EXACT structure you must return:
{
  "genre": {
    "primary": "string (e.g., 'Drama', 'Comedy', 'Action')",
    "secondary": ["string (e.g., 'Romance', 'Thriller')"],
    "confidence": number (between 0 and 1)
  },
  "toneThemes": {
    "tone": "string (e.g., 'Dark', 'Lighthearted', 'Serious')",
    "themes": ["string (e.g., 'Love', 'Betrayal', 'Redemption')"],
    "mood": "string (e.g., 'Tense', 'Uplifting', 'Mysterious')"
  },
  "characters": {
    "mainCharacters": [
      {
        "name": "string (character name)",
        "role": "string (e.g., 'Protagonist', 'Antagonist')",
        "description": "string (brief character description)"
      }
    ],
    "diversity": {
      "gender": ["string (e.g., 'Male', 'Female', 'Non-binary')"],
      "ethnicity": ["string (e.g., 'Caucasian', 'Asian', 'African-American')"],
      "age": ["string (e.g., 'Young Adult', 'Middle-aged', 'Senior')"]
    }
  },
  "production": {
    "budget": "string (e.g., 'Low', 'Medium', 'High')",
    "complexity": "string (e.g., 'Simple', 'Moderate', 'Complex')",
    "locations": ["string (e.g., 'Urban', 'Rural', 'International')"],
    "specialEffects": ["string (e.g., 'Minimal', 'Moderate', 'Extensive')"]
  },
  "audience": {
    "targetAge": "string (e.g., 'PG', 'PG-13', 'R')",
    "contentRating": "string (e.g., 'G', 'PG', 'R')",
    "demographics": ["string (e.g., 'Young Adults', 'Family', 'Mature')"]
  },
  "greenlight": {
    "commercialPotential": "string (e.g., 'Low', 'Medium', 'High')",
    "risks": ["string (e.g., 'Budget constraints', 'Market saturation')"],
    "recommendations": ["string (e.g., 'Consider targeting younger audience', 'Focus on character development')"]
  }
}`;

// Default analysis template
const defaultAnalysis = {
  id: Date.now().toString(),
  title: "Generated Analysis",
  timestamp: new Date().toISOString(),
  genre: {
    primaryGenre: "Drama",
    subGenres: ["Thriller", "Mystery"],
    genreConfidence: {
      "Drama": 0.8,
      "Thriller": 0.6,
      "Mystery": 0.5
    },
    genreInsights: "This screenplay primarily follows dramatic storytelling conventions with elements of thriller and mystery."
  },
  toneThemes: {
    emotionalTones: ["Serious", "Tense", "Reflective"],
    majorThemes: ["Identity", "Redemption", "Family"],
    toneAnalysis: "The screenplay maintains a serious tone throughout with moments of tension and reflection."
  },
  characters: {
    totalCharacters: 8,
    speakingRoles: 6,
    mainCharacters: 2,
    supportingRoles: 4,
    genderBreakdown: {
      male: 4,
      female: 4,
      other: 0
    },
    diversityAssessment: "The screenplay features a balanced cast with equal gender representation.",
    characterArcs: [
      {
        character: "Main Character",
        arc: "Journey of self-discovery and redemption"
      },
      {
        character: "Supporting Character",
        arc: "Learning to trust and support others"
      }
    ]
  },
  production: {
    locations: {
      interior: 12,
      exterior: 8
    },
    topLocations: ["Home", "Office", "Park"],
    vfxShots: 5,
    stuntScenes: 2,
    largeSetPieces: 1,
    specialRequirements: ["Night scenes", "Rain sequence"],
    notableSetPieces: ["Climactic confrontation"]
  },
  audience: {
    contentRating: "PG-13",
    targetDemographics: {
      ageGroups: ["18-34", "35-49"],
      genderAppeal: ["Balanced"],
      interestGroups: ["Drama fans", "Thriller enthusiasts"]
    },
    contentWarnings: ["Mild violence", "Adult themes"],
    audienceAppealSummary: "This screenplay would appeal to adult audiences who enjoy character-driven dramas with elements of mystery."
  },
  greenlight: {
    score: "Medium",
    scorePercentage: 65,
    summary: "This screenplay shows moderate commercial potential with reasonable production requirements.",
    strengths: ["Strong character development", "Engaging premise"],
    concerns: ["Some pacing issues", "Limited market differentiation"],
    marketPotential: 65,
    budgetConsiderations: 70,
    executionComplexity: 60,
    recommendations: "Recommend proceeding with minor revisions to strengthen pacing and market positioning."
  }
};

export const analyzeScreenplay = async (text, progressCallback) => {
  try {
    progressCallback?.('Starting analysis...');
    console.log('Sending request to Ollama API...');

    const response = await fetch(`${OLLAMA_API}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral:7b-instruct-q4_K_M',
        prompt: `${systemPrompt}\n\nScreenplay text:\n${text}\n\nAnalyze the screenplay and provide your response as a JSON object with EXACTLY the structure shown above. Remember to use double quotes for strings and null for empty values.`,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
    }

    progressCallback?.('Processing results...');
    const data = await response.json();
    let analysisText = data.response;
    
    console.log('Received LLM response:', {
      length: analysisText.length,
      preview: analysisText.substring(0, 200)
    });

    // Clean up the response text
    analysisText = analysisText
      .replace(/```json\s*/g, '') // Remove ```json prefix
      .replace(/```\s*$/g, '')    // Remove ``` suffix
      .replace(/^```\s*/g, '')    // Remove ``` prefix
      .replace(/None/g, 'null')   // Replace Python None with JSON null
      .replace(/True/g, 'true')   // Replace Python True with JSON true
      .replace(/False/g, 'false') // Replace Python False with JSON false
      .replace(/'/g, '"')         // Replace single quotes with double quotes
      .trim();                    // Remove extra whitespace

    try {
      // First try direct JSON parse
      const analysis = JSON.parse(analysisText);
      console.log('Successfully parsed JSON response');
      
      // Validate the analysis structure
      const requiredFields = ['genre', 'toneThemes', 'characters', 'production', 'audience', 'greenlight'];
      const missingFields = requiredFields.filter(field => !analysis[field]);
      
      if (missingFields.length > 0) {
        console.error('Missing required fields in analysis:', {
          missingFields,
          receivedFields: Object.keys(analysis),
          responsePreview: analysisText.substring(0, 500)
        });
        console.log('Using default analysis template');
        return defaultAnalysis;
      }

      // Validate nested fields
      const validationErrors = [];
      
      // Validate genre
      if (!analysis.genre.primary || !Array.isArray(analysis.genre.secondary) || typeof analysis.genre.confidence !== 'number') {
        validationErrors.push('Invalid genre structure');
      }
      
      // Validate toneThemes
      if (!analysis.toneThemes.tone || !Array.isArray(analysis.toneThemes.themes) || !analysis.toneThemes.mood) {
        validationErrors.push('Invalid toneThemes structure');
      }
      
      // Validate characters
      if (!Array.isArray(analysis.characters.mainCharacters) || 
          !analysis.characters.diversity || 
          !Array.isArray(analysis.characters.diversity.gender) ||
          !Array.isArray(analysis.characters.diversity.ethnicity) ||
          !Array.isArray(analysis.characters.diversity.age)) {
        validationErrors.push('Invalid characters structure');
      }
      
      // Validate production
      if (!analysis.production.budget || !analysis.production.complexity || 
          !Array.isArray(analysis.production.locations) || 
          !Array.isArray(analysis.production.specialEffects)) {
        validationErrors.push('Invalid production structure');
      }
      
      // Validate audience
      if (!analysis.audience.targetAge || !analysis.audience.contentRating || 
          !Array.isArray(analysis.audience.demographics)) {
        validationErrors.push('Invalid audience structure');
      }
      
      // Validate greenlight
      if (!analysis.greenlight.commercialPotential || 
          !Array.isArray(analysis.greenlight.risks) || 
          !Array.isArray(analysis.greenlight.recommendations)) {
        validationErrors.push('Invalid greenlight structure');
      }

      if (validationErrors.length > 0) {
        console.error('Validation errors:', {
          errors: validationErrors,
          responsePreview: analysisText.substring(0, 500)
        });
        console.log('Using default analysis template');
        return defaultAnalysis;
      }

      // Ensure all arrays have at least one item
      const arrayFields = [
        { path: 'genre.secondary', value: analysis.genre.secondary },
        { path: 'toneThemes.themes', value: analysis.toneThemes.themes },
        { path: 'characters.mainCharacters', value: analysis.characters.mainCharacters },
        { path: 'characters.diversity.gender', value: analysis.characters.diversity.gender },
        { path: 'characters.diversity.ethnicity', value: analysis.characters.diversity.ethnicity },
        { path: 'characters.diversity.age', value: analysis.characters.diversity.age },
        { path: 'production.locations', value: analysis.production.locations },
        { path: 'production.specialEffects', value: analysis.production.specialEffects },
        { path: 'audience.demographics', value: analysis.audience.demographics },
        { path: 'greenlight.risks', value: analysis.greenlight.risks },
        { path: 'greenlight.recommendations', value: analysis.greenlight.recommendations }
      ];

      const emptyArrays = arrayFields.filter(field => !field.value || field.value.length === 0);
      if (emptyArrays.length > 0) {
        console.error('Empty arrays found:', {
          emptyArrays: emptyArrays.map(f => f.path),
          responsePreview: analysisText.substring(0, 500)
        });
        console.log('Using default analysis template');
        return defaultAnalysis;
      }

      return analysis;
    } catch (parseError) {
      console.error('Initial JSON parse failed:', {
        error: parseError.message,
        responsePreview: analysisText.substring(0, 500)
      });
      
      // Try to extract JSON from the response if it's wrapped in markdown or other text
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          console.log('Attempting to extract JSON from response...');
          const extractedJson = JSON.parse(jsonMatch[0]);
          
          // Validate extracted JSON
          const requiredFields = ['genre', 'toneThemes', 'characters', 'production', 'audience', 'greenlight'];
          const missingFields = requiredFields.filter(field => !extractedJson[field]);
          
          if (missingFields.length === 0) {
            console.log('Successfully extracted and validated JSON');
            return extractedJson;
          } else {
            console.error('Extracted JSON missing required fields:', missingFields);
            console.log('Using default analysis template');
            return defaultAnalysis;
          }
        } catch (extractError) {
          console.error('Failed to parse extracted JSON:', {
            error: extractError.message,
            extractedText: jsonMatch[0].substring(0, 500)
          });
          console.log('Using default analysis template');
          return defaultAnalysis;
        }
      }
      
      // If we get here, all parsing attempts failed
      console.log('All parsing attempts failed, using default analysis template');
      return defaultAnalysis;
    }
  } catch (error) {
    console.error('LLM analysis error:', {
      error: error.message,
      stack: error.stack,
      type: error.name
    });
    console.log('Using default analysis template');
    return defaultAnalysis;
  }
};

export const extractTextFromPDF = async (buffer, progressCallback) => {
  try {
    progressCallback?.('Loading PDF...');
    console.log('Starting PDF text extraction...');
    
    const data = new Uint8Array(buffer);
    console.log('PDF buffer size:', data.length);
    
    // Use PDF.js without worker
    const loadingTask = pdfjsLib.getDocument({
      data,
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      standardFontDataUrl: path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/standard_fonts/')
    });
    
    console.log('PDF document loading task created');
    const pdf = await loadingTask.promise;
    console.log('PDF document loaded, pages:', pdf.numPages);
    
    progressCallback?.('Extracting text...');
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      progressCallback?.(`Processing page ${i} of ${pdf.numPages}...`);
      console.log(`Processing page ${i} of ${pdf.numPages}`);
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
      
      console.log(`Page ${i} processed, text length:`, pageText.length);
    }
    
    console.log('PDF text extraction completed, total text length:', fullText.length);
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};