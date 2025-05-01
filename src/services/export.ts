import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle } from 'docx';
import { ScreenplayAnalysis } from '../types';
import 'jspdf-autotable';

interface TableOfContentsItem {
  title: string;
  page: number;
}

/**
 * Export analysis data to PDF
 */
export const exportToPdf = async (analysis: ScreenplayAnalysis): Promise<void> => {
  // Create a new PDF document
  const doc = new jsPDF();
  const title = analysis.title || 'Screenplay Analysis';
  const tocItems: TableOfContentsItem[] = [];
  let currentPage = 1;

  // Add cover page
  doc.setFillColor(41, 45, 62); // Dark background
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text(title, 105, 100, { align: 'center' });
  
  if (analysis.author) {
    doc.setFontSize(18);
    doc.text(`By ${analysis.author}`, 105, 120, { align: 'center' });
  }
  
  doc.setFontSize(14);
  doc.text('Screenplay Analysis Report', 105, 140, { align: 'center' });
  
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(date, 105, 160, { align: 'center' });
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Add table of contents page
  doc.addPage();
  currentPage++;
  tocItems.push({ title: 'Table of Contents', page: currentPage });
  
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Table of Contents', 20, 20);
  
  doc.setFontSize(12);
  let yPos = 40;
  
  // Add TOC items
  const sections = [
    'Genre Detection',
    'Tone & Themes',
    'Character Analysis',
    'Production Complexity',
    'Audience Fit',
    'Greenlight Assessment'
  ];
  
  sections.forEach(section => {
    doc.text(section, 30, yPos);
    doc.text('...', 180, yPos);
    doc.text(currentPage.toString(), 190, yPos);
    tocItems.push({ title: section, page: currentPage });
    yPos += 10;
  });
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Genre Section
  doc.addPage();
  currentPage++;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Genre Detection', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Primary Genre: ${analysis.genre.primaryGenre}`, 20, 35);
  
  if (analysis.genre.subGenres?.length) {
    doc.text(`Sub-genres: ${analysis.genre.subGenres.join(', ')}`, 20, 45);
  }
  
  // Add genre confidence chart
  if (analysis.genre.genreConfidence) {
    const confidenceData = Object.entries(analysis.genre.genreConfidence)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    const tableData = confidenceData.map(([genre, confidence]) => [
      genre,
      `${(confidence * 100).toFixed(1)}%`
    ]);
    
    // Draw table manually
    let tableY = 55;
    const cellHeight = 10;
    const cellWidth = 85;
    
    // Draw header
    doc.setFillColor(41, 45, 62);
    doc.rect(20, tableY, cellWidth * 2, cellHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Genre', 25, tableY + 7);
    doc.text('Confidence', 105, tableY + 7);
    
    // Draw rows
    doc.setTextColor(0, 0, 0);
    tableData.forEach(([genre, confidence], index) => {
      tableY += cellHeight;
      doc.rect(20, tableY, cellWidth * 2, cellHeight);
      doc.text(genre, 25, tableY + 7);
      doc.text(confidence, 105, tableY + 7);
    });
    
    tableY += cellHeight;
  }
  
  // Add genre insights
  doc.setFontSize(12);
  doc.text('Genre Insights:', 20, 120);
  doc.setFontSize(10);
  const splitInsights = doc.splitTextToSize(analysis.genre.genreInsights, 170);
  doc.text(splitInsights, 20, 130);
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Tone & Themes
  currentPage++;
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Tone & Themes', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Emotional Tones: ${analysis.toneThemes.emotionalTones.join(', ')}`, 20, 35);
  
  // Major Themes (bullet points)
  doc.text('Major Themes:', 20, 45);
  analysis.toneThemes.majorThemes.forEach(theme => {
    doc.text(`• ${theme}`, 25, 55);
  });
  
  // Tone Analysis
  doc.setFontSize(12);
  doc.text('Tone Analysis:', 20, 65);
  doc.setFontSize(10);
  const splitAnalysis = doc.splitTextToSize(analysis.toneThemes.toneAnalysis, 170);
  doc.text(splitAnalysis, 20, 75);
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Characters
  currentPage++;
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Character Analysis', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Total Speaking Roles: ${analysis.characters.speakingRoles}`, 20, 35);
  doc.text(`Main Characters: ${analysis.characters.mainCharacters}`, 20, 45);
  doc.text(`Supporting Roles: ${analysis.characters.supportingRoles}`, 20, 55);
  
  // Gender Breakdown
  doc.setFontSize(12);
  doc.text('Gender Breakdown:', 20, 65);
  doc.text(`- Male: ${analysis.characters.genderBreakdown.male}`, 20, 75);
  doc.text(`- Female: ${analysis.characters.genderBreakdown.female}`, 20, 85);
  doc.text(`- Other/Unknown: ${analysis.characters.genderBreakdown.other}`, 20, 95);
  
  // Diversity Assessment
  doc.setFontSize(12);
  doc.text('Diversity Assessment:', 20, 105);
  doc.setFontSize(10);
  const splitAssessment = doc.splitTextToSize(analysis.characters.diversityAssessment, 170);
  doc.text(splitAssessment, 20, 115);
  
  // Character Arcs
  doc.setFontSize(12);
  doc.text('Character Arcs:', 20, 125);
  analysis.characters.characterArcs.forEach(arc => {
    doc.text(`- ${arc.character}: ${arc.arc}`, 25, 135);
  });
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Production Complexity
  currentPage++;
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Production Complexity', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Total Locations: ${analysis.production.locations.interior + analysis.production.locations.exterior}`, 20, 35);
  doc.text(`VFX Shots: ${analysis.production.vfxShots}`, 20, 45);
  doc.text(`Stunt Scenes: ${analysis.production.stuntScenes}`, 20, 55);
  
  // Top Locations
  doc.setFontSize(12);
  doc.text('Top Locations:', 20, 65);
  doc.setFontSize(10);
  const splitLocations = doc.splitTextToSize(analysis.production.topLocations.join(', '), 170);
  doc.text(splitLocations, 20, 75);
  
  // Large Set Pieces
  doc.setFontSize(12);
  doc.text('Large Set Pieces:', 20, 85);
  doc.setFontSize(10);
  const splitPieces = doc.splitTextToSize(analysis.production.largeSetPieces, 170);
  doc.text(splitPieces, 20, 95);
  
  // Special Requirements
  doc.setFontSize(12);
  doc.text('Special Requirements:', 20, 105);
  doc.setFontSize(10);
  const splitRequirements = doc.splitTextToSize(analysis.production.specialRequirements.join('\n'), 170);
  doc.text(splitRequirements, 20, 115);
  
  // Notable Set Pieces
  doc.setFontSize(12);
  doc.text('Notable Set Pieces:', 20, 125);
  doc.setFontSize(10);
  const splitNotablePieces = doc.splitTextToSize(analysis.production.notableSetPieces.join('\n'), 170);
  doc.text(splitNotablePieces, 20, 135);
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Audience
  currentPage++;
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Audience Fit', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Content Rating: ${analysis.audience.contentRating}`, 20, 35);
  doc.text(`Target Age Groups: ${analysis.audience.targetDemographics.ageGroups.join(', ')}`, 20, 45);
  
  // Gender Appeal
  doc.setFontSize(12);
  doc.text('Gender Appeal:', 20, 55);
  doc.setFontSize(10);
  const splitGenderAppeal = doc.splitTextToSize(analysis.audience.targetDemographics.genderAppeal.join(', '), 170);
  doc.text(splitGenderAppeal, 20, 65);
  
  // Interest Groups
  doc.setFontSize(12);
  doc.text('Interest Groups:', 20, 75);
  doc.setFontSize(10);
  const splitInterestGroups = doc.splitTextToSize(analysis.audience.targetDemographics.interestGroups.join(', '), 170);
  doc.text(splitInterestGroups, 20, 85);
  
  // Content Warnings
  doc.setFontSize(12);
  doc.text('Content Warnings:', 20, 95);
  doc.setFontSize(10);
  const splitWarnings = doc.splitTextToSize(analysis.audience.contentWarnings.join(', '), 170);
  doc.text(splitWarnings, 20, 105);
  
  // Audience Appeal
  doc.setFontSize(12);
  doc.text('Audience Appeal:', 20, 115);
  doc.setFontSize(10);
  const splitAppeal = doc.splitTextToSize(analysis.audience.audienceAppealSummary, 170);
  doc.text(splitAppeal, 20, 125);
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Greenlight
  currentPage++;
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text('Greenlight Assessment', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Greenlight Score: ${analysis.greenlight.scorePercentage}% (${analysis.greenlight.score} Potential)`, 20, 35);
  
  // Summary
  doc.setFontSize(12);
  doc.text('Summary:', 20, 45);
  doc.setFontSize(10);
  const splitSummary = doc.splitTextToSize(analysis.greenlight.summary, 170);
  doc.text(splitSummary, 20, 55);
  
  // Key Strengths
  doc.setFontSize(12);
  doc.text('Key Strengths:', 20, 65);
  doc.setFontSize(10);
  analysis.greenlight.strengths.forEach(strength => {
    doc.text(`- ${strength}`, 25, 75);
  });
  
  // Key Concerns
  doc.setFontSize(12);
  doc.text('Key Concerns:', 20, 85);
  doc.setFontSize(10);
  analysis.greenlight.concerns.forEach(concern => {
    doc.text(`- ${concern}`, 25, 95);
  });
  
  // Recommendations
  doc.setFontSize(12);
  doc.text('Recommendations:', 20, 105);
  doc.setFontSize(10);
  const splitRecommendations = doc.splitTextToSize(analysis.greenlight.recommendations, 170);
  doc.text(splitRecommendations, 20, 115);
  
  // Add page number
  doc.setFontSize(10);
  doc.text(`Page ${currentPage.toString()}`, 105, 287, { align: 'center' });
  
  // Save the PDF
  doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}-analysis.pdf`);
};

/**
 * Export analysis data to Markdown
 */
export const exportToMarkdown = async (analysis: ScreenplayAnalysis): Promise<void> => {
  const title = analysis.title || 'Screenplay Analysis';
  let markdown = `# ${title}\n\n`;
  
  if (analysis.author) {
    markdown += `By ${analysis.author}\n\n`;
  }
  
  // Genre Section
  markdown += `## Genre Detection\n\n`;
  markdown += `Primary Genre: ${analysis.genre.primaryGenre}\n`;
  
  if (analysis.genre.subGenres?.length) {
    markdown += `Sub-genres: ${analysis.genre.subGenres.join(', ')}\n`;
  }
  
  markdown += `\nGenre Insights: ${analysis.genre.genreInsights}\n\n`;
  
  // Tone & Themes
  markdown += `## Tone & Themes\n\n`;
  markdown += `Emotional Tones: ${analysis.toneThemes.emotionalTones.join(', ')}\n\n`;
  markdown += `Major Themes:\n`;
  analysis.toneThemes.majorThemes.forEach(theme => {
    markdown += `- ${theme}\n`;
  });
  
  markdown += `\nTone Analysis: ${analysis.toneThemes.toneAnalysis}\n\n`;
  
  // Characters
  markdown += `## Character Analysis\n\n`;
  markdown += `Total Characters: ${analysis.characters.totalCharacters}\n`;
  markdown += `Speaking Roles: ${analysis.characters.speakingRoles}\n`;
  markdown += `Main Characters: ${analysis.characters.mainCharacters}\n`;
  markdown += `Supporting Roles: ${analysis.characters.supportingRoles}\n\n`;
  
  markdown += `Gender Breakdown:\n`;
  markdown += `- Male: ${analysis.characters.genderBreakdown.male}\n`;
  markdown += `- Female: ${analysis.characters.genderBreakdown.female}\n`;
  markdown += `- Other/Unknown: ${analysis.characters.genderBreakdown.other}\n\n`;
  
  markdown += `Diversity Assessment: ${analysis.characters.diversityAssessment}\n\n`;
  
  markdown += `Character Arcs:\n`;
  analysis.characters.characterArcs.forEach(arc => {
    markdown += `- ${arc.character}: ${arc.arc}\n`;
  });
  
  // Production Complexity
  markdown += `\n## Production Complexity\n\n`;
  markdown += `Locations: ${analysis.production.locations.interior + analysis.production.locations.exterior} total (${analysis.production.locations.interior} interior, ${analysis.production.locations.exterior} exterior)\n`;
  markdown += `Top Locations: ${analysis.production.topLocations.join(', ')}\n\n`;
  
  markdown += `VFX Shots: ${analysis.production.vfxShots}\n`;
  markdown += `Stunt Scenes: ${analysis.production.stuntScenes}\n`;
  markdown += `Large Set Pieces: ${analysis.production.largeSetPieces}\n\n`;
  
  if (analysis.production.specialRequirements.length) {
    markdown += `Special Requirements:\n`;
    analysis.production.specialRequirements.forEach(req => {
      markdown += `- ${req}\n`;
    });
    markdown += `\n`;
  }
  
  if (analysis.production.notableSetPieces.length) {
    markdown += `Notable Set Pieces:\n`;
    analysis.production.notableSetPieces.forEach(piece => {
      markdown += `- ${piece}\n`;
    });
    markdown += `\n`;
  }
  
  // Audience
  markdown += `## Audience Fit\n\n`;
  markdown += `Content Rating: ${analysis.audience.contentRating}\n\n`;
  
  markdown += `Target Demographics:\n`;
  markdown += `- Age Groups: ${analysis.audience.targetDemographics.ageGroups.join(', ')}\n`;
  markdown += `- Gender Appeal: ${analysis.audience.targetDemographics.genderAppeal.join(', ')}\n`;
  markdown += `- Interest Groups: ${analysis.audience.targetDemographics.interestGroups.join(', ')}\n\n`;
  
  if (analysis.audience.contentWarnings.length) {
    markdown += `Content Warnings: ${analysis.audience.contentWarnings.join(', ')}\n\n`;
  }
  
  markdown += `Audience Appeal: ${analysis.audience.audienceAppealSummary}\n\n`;
  
  // Greenlight
  markdown += `## Greenlight Assessment\n\n`;
  markdown += `Greenlight Score: ${analysis.greenlight.scorePercentage}% (${analysis.greenlight.score} Potential)\n\n`;
  markdown += `Summary: ${analysis.greenlight.summary}\n\n`;
  
  markdown += `Key Strengths:\n`;
  analysis.greenlight.strengths.forEach(strength => {
    markdown += `- ${strength}\n`;
  });
  markdown += `\n`;
  
  markdown += `Key Concerns:\n`;
  analysis.greenlight.concerns.forEach(concern => {
    markdown += `- ${concern}\n`;
  });
  markdown += `\n`;
  
  markdown += `Recommendations: ${analysis.greenlight.recommendations}\n\n`;
  
  // Create and download the markdown file
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-analysis.md`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export analysis data to DOCX
 */
export const exportToDocx = async (analysis: ScreenplayAnalysis): Promise<void> => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          text: analysis.title || 'Screenplay Analysis',
          heading: HeadingLevel.TITLE,
          spacing: {
            after: 200
          }
        }),

        // Author
        analysis.author ? new Paragraph({
          text: `By ${analysis.author}`,
          spacing: {
            after: 200
          }
        }) : null,

        // Date
        new Paragraph({
          text: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          spacing: {
            after: 400
          }
        }),

        // Genre Section
        new Paragraph({
          text: 'Genre Detection',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Primary Genre: ${analysis.genre.primaryGenre}`,
          spacing: {
            after: 100
          }
        }),

        analysis.genre.subGenres?.length ? new Paragraph({
          text: `Sub-genres: ${analysis.genre.subGenres.join(', ')}`,
          spacing: {
            after: 200
          }
        }) : null,

        // Genre Confidence Table
        analysis.genre.genreConfidence ? new Table({
          width: {
            size: 100,
            type: 'pct'
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph('Genre')],
                  width: {
                    size: 50,
                    type: 'pct'
                  }
                }),
                new TableCell({
                  children: [new Paragraph('Confidence')],
                  width: {
                    size: 50,
                    type: 'pct'
                  }
                })
              ]
            }),
            ...Object.entries(analysis.genre.genreConfidence)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([genre, confidence]) => new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph(genre)],
                    width: {
                      size: 50,
                      type: 'pct'
                    }
                  }),
                  new TableCell({
                    children: [new Paragraph(`${(confidence * 100).toFixed(1)}%`)],
                    width: {
                      size: 50,
                      type: 'pct'
                    }
                  })
                ]
              }))
          ]
        }) : null,

        new Paragraph({
          text: 'Genre Insights:',
          spacing: {
            before: 200,
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.genre.genreInsights,
          spacing: {
            after: 400
          }
        }),

        // Tone & Themes Section
        new Paragraph({
          text: 'Tone & Themes',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Emotional Tones: ${analysis.toneThemes.emotionalTones.join(', ')}`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Major Themes:',
          spacing: {
            after: 100
          }
        }),

        ...analysis.toneThemes.majorThemes.map(theme => new Paragraph({
          text: `• ${theme}`,
          spacing: {
            after: 100
          }
        })),

        new Paragraph({
          text: 'Tone Analysis:',
          spacing: {
            before: 200,
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.toneThemes.toneAnalysis,
          spacing: {
            after: 400
          }
        }),

        // Character Section
        new Paragraph({
          text: 'Character Analysis',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Total Characters: ${analysis.characters.totalCharacters}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `Speaking Roles: ${analysis.characters.speakingRoles}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `Main Characters: ${analysis.characters.mainCharacters}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `Supporting Roles: ${analysis.characters.supportingRoles}`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Gender Breakdown:',
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `• Male: ${analysis.characters.genderBreakdown.male}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `• Female: ${analysis.characters.genderBreakdown.female}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `• Other/Unknown: ${analysis.characters.genderBreakdown.other}`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Diversity Assessment:',
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.characters.diversityAssessment,
          spacing: {
            after: 400
          }
        }),

        // Production Section
        new Paragraph({
          text: 'Production Complexity',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Total Locations: ${analysis.production.locations.interior + analysis.production.locations.exterior}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `VFX Shots: ${analysis.production.vfxShots}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `Stunt Scenes: ${analysis.production.stuntScenes}`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Top Locations:',
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.production.topLocations.join(', '),
          spacing: {
            after: 400
          }
        }),

        // Audience Section
        new Paragraph({
          text: 'Audience Fit',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Content Rating: ${analysis.audience.contentRating}`,
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: `Target Age Groups: ${analysis.audience.targetDemographics.ageGroups.join(', ')}`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Audience Appeal:',
          spacing: {
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.audience.audienceAppealSummary,
          spacing: {
            after: 400
          }
        }),

        // Greenlight Section
        new Paragraph({
          text: 'Greenlight Assessment',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: `Greenlight Score: ${analysis.greenlight.scorePercentage}% (${analysis.greenlight.score} Potential)`,
          spacing: {
            after: 200
          }
        }),

        new Paragraph({
          text: 'Key Strengths:',
          spacing: {
            after: 100
          }
        }),

        ...analysis.greenlight.strengths.map(strength => new Paragraph({
          text: `• ${strength}`,
          spacing: {
            after: 100
          }
        })),

        new Paragraph({
          text: 'Key Concerns:',
          spacing: {
            before: 200,
            after: 100
          }
        }),

        ...analysis.greenlight.concerns.map(concern => new Paragraph({
          text: `• ${concern}`,
          spacing: {
            after: 100
          }
        })),

        new Paragraph({
          text: 'Recommendations:',
          spacing: {
            before: 200,
            after: 100
          }
        }),

        new Paragraph({
          text: analysis.greenlight.recommendations,
          spacing: {
            after: 400
          }
        })
      ].filter(Boolean)
    }]
  });

  // Generate and download the document
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(analysis.title || 'Screenplay Analysis').replace(/\s+/g, '-').toLowerCase()}-analysis.docx`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export analysis data to HTML
 */
export const exportToHtml = async (analysis: ScreenplayAnalysis): Promise<void> => {
  const title = analysis.title || 'Screenplay Analysis';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Analysis</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1, h2, h3 {
      color: #2d3748;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      font-size: 1.8rem;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e2e8f0;
    }
    h3 {
      font-size: 1.4rem;
      margin: 1.5rem 0 1rem;
    }
    p {
      margin: 1rem 0;
    }
    .metadata {
      color: #718096;
      margin-bottom: 2rem;
    }
    .section {
      margin-bottom: 2rem;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    .table th, .table td {
      padding: 0.75rem;
      border: 1px solid #e2e8f0;
    }
    .table th {
      background-color: #f7fafc;
      font-weight: 600;
    }
    .list {
      list-style-type: none;
      padding: 0;
      margin: 1rem 0;
    }
    .list li {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;
    }
    .list li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #4a5568;
    }
    .score {
      font-size: 1.2rem;
      font-weight: 600;
      color: #2d3748;
    }
    .insights {
      background-color: #f7fafc;
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 1rem 0;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${analysis.author ? `<p class="metadata">By ${analysis.author}</p>` : ''}
  <p class="metadata">Analysis Date: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</p>

  <div class="section">
    <h2>Genre Detection</h2>
    <p><strong>Primary Genre:</strong> ${analysis.genre.primaryGenre}</p>
    ${analysis.genre.subGenres?.length ? `<p><strong>Sub-genres:</strong> ${analysis.genre.subGenres.join(', ')}</p>` : ''}
    
    ${analysis.genre.genreConfidence ? `
    <table class="table">
      <thead>
        <tr>
          <th>Genre</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(analysis.genre.genreConfidence)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([genre, confidence]) => `
          <tr>
            <td>${genre}</td>
            <td>${(confidence * 100).toFixed(1)}%</td>
          </tr>
          `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    <div class="insights">
      <h3>Genre Insights</h3>
      <p>${analysis.genre.genreInsights}</p>
    </div>
  </div>

  <div class="section">
    <h2>Tone & Themes</h2>
    <p><strong>Emotional Tones:</strong> ${analysis.toneThemes.emotionalTones.join(', ')}</p>
    
    <h3>Major Themes</h3>
    <ul class="list">
      ${analysis.toneThemes.majorThemes.map(theme => `<li>${theme}</li>`).join('')}
    </ul>
    
    <div class="insights">
      <h3>Tone Analysis</h3>
      <p>${analysis.toneThemes.toneAnalysis}</p>
    </div>
  </div>

  <div class="section">
    <h2>Character Analysis</h2>
    <p><strong>Total Characters:</strong> ${analysis.characters.totalCharacters}</p>
    <p><strong>Speaking Roles:</strong> ${analysis.characters.speakingRoles}</p>
    <p><strong>Main Characters:</strong> ${analysis.characters.mainCharacters}</p>
    <p><strong>Supporting Roles:</strong> ${analysis.characters.supportingRoles}</p>
    
    <h3>Gender Breakdown</h3>
    <ul class="list">
      <li>Male: ${analysis.characters.genderBreakdown.male}</li>
      <li>Female: ${analysis.characters.genderBreakdown.female}</li>
      <li>Other/Unknown: ${analysis.characters.genderBreakdown.other}</li>
    </ul>
    
    <div class="insights">
      <h3>Diversity Assessment</h3>
      <p>${analysis.characters.diversityAssessment}</p>
    </div>
    
    <h3>Character Arcs</h3>
    <ul class="list">
      ${analysis.characters.characterArcs.map(arc => `<li><strong>${arc.character}:</strong> ${arc.arc}</li>`).join('')}
    </ul>
  </div>

  <div class="section">
    <h2>Production Complexity</h2>
    <p><strong>Total Locations:</strong> ${analysis.production.locations.interior + analysis.production.locations.exterior}</p>
    <p><strong>VFX Shots:</strong> ${analysis.production.vfxShots}</p>
    <p><strong>Stunt Scenes:</strong> ${analysis.production.stuntScenes}</p>
    
    <h3>Top Locations</h3>
    <p>${analysis.production.topLocations.join(', ')}</p>
    
    <h3>Large Set Pieces</h3>
    <p>${analysis.production.largeSetPieces}</p>
    
    ${analysis.production.specialRequirements.length ? `
    <h3>Special Requirements</h3>
    <ul class="list">
      ${analysis.production.specialRequirements.map(req => `<li>${req}</li>`).join('')}
    </ul>
    ` : ''}
    
    ${analysis.production.notableSetPieces.length ? `
    <h3>Notable Set Pieces</h3>
    <ul class="list">
      ${analysis.production.notableSetPieces.map(piece => `<li>${piece}</li>`).join('')}
    </ul>
    ` : ''}
  </div>

  <div class="section">
    <h2>Audience Fit</h2>
    <p><strong>Content Rating:</strong> ${analysis.audience.contentRating}</p>
    
    <h3>Target Demographics</h3>
    <p><strong>Age Groups:</strong> ${analysis.audience.targetDemographics.ageGroups.join(', ')}</p>
    <p><strong>Gender Appeal:</strong> ${analysis.audience.targetDemographics.genderAppeal.join(', ')}</p>
    <p><strong>Interest Groups:</strong> ${analysis.audience.targetDemographics.interestGroups.join(', ')}</p>
    
    ${analysis.audience.contentWarnings.length ? `
    <h3>Content Warnings</h3>
    <p>${analysis.audience.contentWarnings.join(', ')}</p>
    ` : ''}
    
    <div class="insights">
      <h3>Audience Appeal</h3>
      <p>${analysis.audience.audienceAppealSummary}</p>
    </div>
  </div>

  <div class="section">
    <h2>Greenlight Assessment</h2>
    <p class="score">Greenlight Score: ${analysis.greenlight.scorePercentage}% (${analysis.greenlight.score} Potential)</p>
    
    <div class="insights">
      <h3>Summary</h3>
      <p>${analysis.greenlight.summary}</p>
    </div>
    
    <h3>Key Strengths</h3>
    <ul class="list">
      ${analysis.greenlight.strengths.map(strength => `<li>${strength}</li>`).join('')}
    </ul>
    
    <h3>Key Concerns</h3>
    <ul class="list">
      ${analysis.greenlight.concerns.map(concern => `<li>${concern}</li>`).join('')}
    </ul>
    
    <div class="insights">
      <h3>Recommendations</h3>
      <p>${analysis.greenlight.recommendations}</p>
    </div>
  </div>
</body>
</html>
  `;

  // Create and download the HTML file
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-analysis.html`;
  a.click();
  URL.revokeObjectURL(url);
};