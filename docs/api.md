# ScreenScore API Documentation

This document provides details about the ScreenScore API endpoints, request/response formats, and usage examples.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Currently, no authentication is required as the API runs locally.

## Endpoints

### Upload Screenplay

Upload a screenplay file for analysis.

```http
POST /upload
```

#### Request

- **Content-Type**: `multipart/form-data`
- **Body**:
  - `screenplay`: File (PDF or TXT)

#### Response

```json
{
  "success": true,
  "message": "Analysis complete",
  "analysis": {
    "genres": [
      {
        "name": "string",
        "confidence": "number"
      }
    ],
    "tone": "string",
    "themes": ["string"],
    "characters": [
      {
        "name": "string",
        "role": "string",
        "description": "string"
      }
    ],
    "production": {
      "complexity": "string",
      "requirements": ["string"]
    },
    "audience": {
      "target": "string",
      "rating": "string"
    },
    "greenlight": {
      "recommendation": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "risks": ["string"]
    }
  }
}
```

#### Error Response

```json
{
  "error": "string"
}
```

### Get Analysis Progress

Get the current progress of an analysis.

```http
GET /progress/:id
```

#### Parameters

- `id`: Analysis ID (filename)

#### Response

```json
{
  "status": "string"
}
```

#### Error Response

```json
{
  "error": "string"
}
```

## Error Codes

- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

No rate limiting is currently implemented as the API runs locally.

## File Requirements

- Maximum file size: 10MB
- Supported formats: PDF, TXT
- PDF files must be text-based (not scanned images)

## Example Usage

### Upload a Screenplay

```javascript
const formData = new FormData();
formData.append('screenplay', file);

const response = await fetch('http://localhost:3001/api/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

### Check Analysis Progress

```javascript
const response = await fetch(`http://localhost:3001/api/progress/${analysisId}`);
const data = await response.json();
```

## Response Types

### Analysis Response

```typescript
interface Analysis {
  genres: Array<{
    name: string;
    confidence: number;
  }>;
  tone: string;
  themes: string[];
  characters: Array<{
    name: string;
    role: string;
    description: string;
  }>;
  production: {
    complexity: string;
    requirements: string[];
  };
  audience: {
    target: string;
    rating: string;
  };
  greenlight: {
    recommendation: string;
    strengths: string[];
    weaknesses: string[];
    risks: string[];
  };
}
```

## Best Practices

1. **Error Handling**
   - Always check for error responses
   - Implement proper error handling in your application
   - Display user-friendly error messages

2. **File Upload**
   - Validate file size before upload
   - Check file format
   - Show upload progress

3. **Progress Tracking**
   - Implement progress tracking UI
   - Handle timeouts gracefully
   - Provide user feedback

## Troubleshooting

### Common Issues

1. **File Upload Failures**
   - Check file size and format
   - Ensure server is running
   - Verify file permissions

2. **Analysis Errors**
   - Check Ollama status
   - Verify file content
   - Check server logs

### Getting Help

For API-related issues:
1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Open a [GitHub Issue](https://github.com/your-username/screenscore/issues)
3. Join our [Discord Community](https://discord.gg/your-server) 