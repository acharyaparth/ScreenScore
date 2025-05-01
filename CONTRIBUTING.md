# Contributing to ScreenScore

Thank you for your interest in contributing to ScreenScore! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the [Issues](https://github.com/your-username/screenscore/issues) section
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node.js version, etc.)

### Suggesting Features

1. Check if the feature has already been suggested in the [Issues](https://github.com/your-username/screenscore/issues) section
2. If not, create a new issue with:
   - A clear, descriptive title
   - Detailed description of the feature
   - Use cases and benefits
   - Any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Run tests and ensure they pass
5. Update documentation if necessary
6. Submit a pull request

### Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/screenscore.git
   cd screenscore
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Ollama:
   ```bash
   ollama run mistral:7b-instruct-q4_K_M
   ```

4. Start the development server:
   ```bash
   npm start
   ```

### Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Write tests for new features

### Testing

- Write unit tests for new features
- Ensure all tests pass before submitting PR
- Add integration tests for API endpoints
- Test on different platforms if applicable

### Documentation

- Update README.md if necessary
- Add JSDoc comments for new functions
- Update API documentation
- Add examples for new features

## Pull Request Process

1. Update the README.md with details of changes if necessary
2. Update the documentation with details of any new features
3. The PR will be merged once you have the sign-off of at least one maintainer

## Development Workflow

1. Create a new branch for your feature/fix
2. Make your changes
3. Run tests and ensure they pass
4. Update documentation
5. Submit a pull request
6. Address any review comments
7. Once approved, your PR will be merged

## Questions?

Feel free to:
- Open an issue
- Join our [Discord community](https://discord.gg/your-server)
- Contact the maintainers

Thank you for contributing to ScreenScore! 🎬 