# ScreenScore Development Guide

> **License & Privacy:** ScreenScore is GPLv3-licensed, privacy-first, and all analysis is performed locally—no data leaves your machine.

This guide provides information for developers who want to contribute to or modify ScreenScore.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Architecture](#architecture)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Deployment](#deployment)

## Development Setup

### Prerequisites

1. [Node.js](https://nodejs.org) v18 or later
2. [Ollama](https://ollama.ai)
3. Git
4. A code editor (VS Code recommended)

### Initial Setup

1. Clone the repository:
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
   ollama pull mistral:7b-instruct-q4_K_M
   ollama run mistral:7b-instruct-q4_K_M
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

```
screenscore/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   │   ├── analysis/      # Analysis-related components
│   │   ├── export/        # Export-related components
│   │   ├── layout/        # Layout components
│   │   ├── marketing/     # Marketing components
│   │   └── upload/        # Upload-related components
│   ├── pages/             # Page components
│   ├── services/          # API and other services
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── server/                 # Backend source code
│   ├── index.js           # Express server
│   ├── llm.js             # LLM integration
│   └── uploads/           # Temporary file storage
├── docs/                   # Documentation
└── public/                # Static assets
```

## Architecture

### Frontend

- **React**: UI framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Router**: Navigation
- **Vite**: Build tool

### Backend

- **Express**: Web server
- **Ollama**: LLM integration
- **Multer**: File upload handling
- **PDF.js**: PDF text extraction

### Data Flow

1. User uploads screenplay
2. File is processed (PDF extraction if needed)
3. Text is sent to Ollama for analysis
4. Results are processed and returned
5. UI updates with analysis

## Development Workflow

### Branching Strategy

1. `main`: Production-ready code
2. `develop`: Development branch
3. Feature branches: `feature/feature-name`
4. Bug fix branches: `fix/bug-name`

### Code Style

- Follow TypeScript best practices
- Use ESLint for code linting
- Follow existing code style
- Write meaningful commit messages

### Commit Messages

Format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Testing
- `chore`: Maintenance

## Testing

### Unit Tests

Run tests:
```bash
npm test
```

### Integration Tests

Run integration tests:
```bash
npm run test:integration
```

### End-to-End Tests

Run E2E tests:
```bash
npm run test:e2e
```

## Deployment

### Local Development

1. Start Ollama:
   ```bash
   ollama run mistral:7b-instruct-q4_K_M
   ```

2. Start the application:
   ```bash
   npm start
   ```

### Production Build

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm run server
   ```

## Best Practices

### Code Quality

1. **TypeScript**
   - Use strict type checking
   - Define interfaces for data structures
   - Avoid `any` type

2. **React**
   - Use functional components
   - Implement proper error boundaries
   - Follow React hooks best practices

3. **Testing**
   - Write unit tests for components
   - Test edge cases
   - Maintain good test coverage

### Performance

1. **Frontend**
   - Implement code splitting
   - Optimize bundle size
   - Use proper caching

2. **Backend**
   - Implement proper error handling
   - Use efficient file processing
   - Implement proper cleanup

### Security

1. **File Handling**
   - Validate file types
   - Implement size limits
   - Clean up temporary files

2. **API Security**
   - Validate input
   - Handle errors properly
   - Implement rate limiting if needed

## Troubleshooting

### Common Issues

1. **Ollama Issues**
   - Check if Ollama is running
   - Verify model is loaded
   - Check Ollama logs

2. **Build Issues**
   - Clear node_modules
   - Update dependencies
   - Check TypeScript errors

3. **Runtime Issues**
   - Check browser console
   - Check server logs
   - Verify file permissions

### Getting Help

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Search [GitHub Issues](https://github.com/your-username/screenscore/issues)
3. Join our [Discord Community](https://discord.gg/your-server)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contribution guidelines. 