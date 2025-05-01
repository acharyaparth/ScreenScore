# ScreenScore User Guide

Welcome to ScreenScore! This guide will help you get started with using our screenplay analysis tool.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Uploading Screenplays](#uploading-screenplays)
3. [Understanding Analysis](#understanding-analysis)
4. [Exporting Results](#exporting-results)
5. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

Before using ScreenScore, ensure you have:

1. [Ollama](https://ollama.ai) installed and running
2. [Node.js](https://nodejs.org) v18 or later installed
3. The Mistral model pulled and running:
   ```bash
   ollama pull mistral:7b-instruct-q4_K_M
   ollama run mistral:7b-instruct-q4_K_M
   ```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/screenscore.git
   cd screenscore
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open http://localhost:5173 in your browser

## Uploading Screenplays

ScreenScore supports the following file formats:
- PDF (.pdf)
- Text (.txt)

To upload a screenplay:

1. Click the "Upload Screenplay" button
2. Select your file
3. Wait for the upload to complete
4. The analysis will start automatically

### File Requirements

- Maximum file size: 10MB
- PDF files should be text-based (not scanned images)
- Text files should be properly formatted

## Understanding Analysis

ScreenScore provides a comprehensive analysis of your screenplay, including:

### Genre Analysis
- Primary and secondary genres
- Confidence levels for each genre
- Genre-specific insights

### Character Analysis
- Main character profiles
- Character relationships
- Diversity assessment
- Character arc analysis

### Production Analysis
- Budget complexity
- Location requirements
- Special effects needs
- Technical requirements

### Audience Analysis
- Target demographic
- Content rating assessment
- Market potential
- Audience appeal factors

### Greenlight Assessment
- Overall recommendation
- Strengths and weaknesses
- Risk factors
- Market potential

## Exporting Results

You can export your analysis in two formats:

### PDF Export
1. Click the "Export" button
2. Select "PDF"
3. Choose your desired options
4. Click "Download"

### Markdown Export
1. Click the "Export" button
2. Select "Markdown"
3. Choose your desired options
4. Click "Download"

## Troubleshooting

### Common Issues

1. **Ollama Not Running**
   - Ensure Ollama is installed
   - Check if the Mistral model is running
   - Restart Ollama if necessary

2. **Upload Failures**
   - Check file size (max 10MB)
   - Verify file format
   - Ensure file is not corrupted

3. **Analysis Errors**
   - Check internet connection
   - Verify Ollama is running
   - Try uploading a different file

### Getting Help

If you encounter any issues:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Search [GitHub Issues](https://github.com/your-username/screenscore/issues)
3. Join our [Discord Community](https://discord.gg/your-server)
4. Contact support at [support email]

## Privacy

ScreenScore processes all data locally on your machine. Your screenplays are never uploaded to external servers. The only external communication is with your local Ollama instance for analysis.

## Support

For additional support:
- Join our [Discord Community](https://discord.gg/your-server)
- Open a [GitHub Issue](https://github.com/your-username/screenscore/issues)
- Email us at [support email] 