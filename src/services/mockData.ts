import { ScreenplayAnalysis } from '../types';

export const mockAnalysisData: ScreenplayAnalysis = {
  title: "The Last Sunset",
  author: "Jane Doe",
  
  genre: {
    primaryGenre: "Thriller",
    subGenres: ["Mystery", "Drama"],
    genreConfidence: {
      "Thriller": 0.75,
      "Mystery": 0.62,
      "Drama": 0.58,
      "Crime": 0.42,
      "Action": 0.35
    },
    genreInsights: "This screenplay blends elements of psychological thriller with mystery, featuring a strong investigative narrative with emotional character arcs that add dramatic weight."
  },
  
  toneThemes: {
    emotionalTones: ["Suspenseful", "Melancholic", "Introspective"],
    majorThemes: [
      "Identity and self-discovery",
      "Justice vs. revenge",
      "Trauma and healing",
      "Family secrets"
    ],
    toneAnalysis: "The screenplay maintains a consistent atmosphere of tension and unease, punctuated by moments of reflection and emotional revelation. The tone shifts from suspenseful to contemplative as the protagonist uncovers deeper truths."
  },
  
  characters: {
    totalCharacters: 24,
    speakingRoles: 18,
    mainCharacters: 3,
    supportingRoles: 8,
    genderBreakdown: {
      male: 10,
      female: 7,
      other: 1
    },
    diversityAssessment: "The screenplay features a diverse cast with representation across different ethnic backgrounds, ages, and socioeconomic statuses. The protagonist is a woman in her 40s, which adds a refreshing perspective to the thriller genre.",
    characterArcs: [
      {
        character: "Detective Sarah Reeves",
        arc: "From emotionally detached investigator to confronting her own past trauma"
      },
      {
        character: "Michael Thorne",
        arc: "From suspected perpetrator to complex ally revealing hidden depths"
      },
      {
        character: "Elena Cortez",
        arc: "From victim's sister seeking justice to questioning her own motives and ethics"
      }
    ]
  },
  
  production: {
    locations: {
      interior: 14,
      exterior: 9
    },
    topLocations: ["Detective's Office", "Abandoned Lighthouse", "Cliffside Beach"],
    vfxShots: 12,
    stuntScenes: 5,
    largeSetPieces: 2,
    specialRequirements: [
      "Underwater filming sequence",
      "Lighthouse storm scene",
      "Car chase through narrow streets"
    ],
    notableSetPieces: [
      "Climactic confrontation at lighthouse during a storm",
      "Flashback sequence requiring period-accurate 1990s small town setting"
    ]
  },
  
  audience: {
    contentRating: "R",
    targetDemographics: {
      ageGroups: ["25-34", "35-44", "45-54"],
      genderAppeal: ["Balanced", "Slight female skew"],
      interestGroups: ["Mystery fans", "Crime drama enthusiasts", "Psychological thriller viewers"]
    },
    contentWarnings: ["Violence", "Strong language", "Brief sexual content"],
    audienceAppealSummary: "This screenplay would appeal to mature audiences who enjoy complex, character-driven thrillers with emotional depth. The strong female protagonist and ethical questions raised would resonate with viewers who appreciate nuanced storytelling."
  },
  
  greenlight: {
    score: "High",
    scorePercentage: 78,
    summary: "This screenplay shows strong commercial and artistic potential with its compelling narrative, well-developed characters, and manageable production requirements.",
    strengths: [
      "Strong, complex female protagonist in a marketable genre",
      "Twist-filled plot with good pacing and escalating tension",
      "Emotionally resonant themes with contemporary relevance",
      "Majority of locations are practical and reusable"
    ],
    concerns: [
      "Storm sequence at lighthouse presents technical challenges",
      "Some dialogue in the third act could be tightened",
      "Flashback sequences add to production complexity"
    ],
    marketPotential: 75,
    budgetConsiderations: 65,
    executionComplexity: 70,
    recommendations: "Recommend proceeding with development. Consider script revisions to reduce production complexity of the lighthouse storm sequence. The strong character work and marketable genre make this a promising project that could attract established talent."
  }
};