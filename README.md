# ScreenScore - Screenplay Analysis Tool

<div align="center">
  <img src="docs/assets/logo.png" alt="ScreenScore Logo" width="200"/>
  <br/>
  <p><em>AI-powered screenplay analysis for film and TV producers</em></p>
</div>

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

ScreenScore is an open-source tool that helps film and TV producers analyze screenplays for project greenlighting decisions. It runs entirely on your local machine, ensuring complete privacy for your screenplays.

## 🌟 Features

- 📝 Upload screenplays in PDF or TXT format
- 🤖 AI-powered analysis using local LLM (Mistral)
- 📊 Comprehensive analysis including:
  - Genre detection and confidence levels
  - Tone and themes
  - Character analysis and diversity
  - Production complexity assessment
  - Target audience and content rating
  - Overall greenlight recommendation
- 📈 Visual analysis reports
- 📤 Export to PDF or Markdown
- 🔒 Complete privacy - all processing happens locally

## 🚀 Quick Start

### Prerequisites

1. Install [Ollama](https://ollama.ai)
2. Install [Node.js](https://nodejs.org) (v18 or later)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/acharyaparth/ScreenScore.git
   cd screenscore
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Ollama and pull the Mistral model:
   ```bash
   ollama pull mistral:7b-instruct-q4_K_M
   ollama run mistral:7b-instruct-q4_K_M
   ```

4. Start the application:
   ```bash
   npm start
   ```

5. Open http://localhost:5173 in your browser

## 📚 Documentation

- [User Guide](docs/user-guide.md)
- [API Documentation](docs/api.md)
- [Development Guide](docs/development.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for the local LLM capabilities
- [Mistral AI](https://mistral.ai) for the language model
- All our contributors and users

## 📞 Support

- GitHub Issues: [https://github.com/acharyaparth/ScreenScore/issues](https://github.com/acharyaparth/ScreenScore/issues)
- Community/Discord: Coming soon
- Website: Coming soon
- Twitter: Coming soon

## 🔗 Links

- GitHub: [https://github.com/acharyaparth/ScreenScore](https://github.com/acharyaparth/ScreenScore)