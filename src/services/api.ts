import { ScreenplayAnalysis } from '../types';
import { ollamaService } from './ollama';

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = 'http://localhost:3001/api';

const handleApiError = async (response: Response, context: string) => {
  let errorMessage = `${context} failed`;
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorMessage;
  } catch {
    // If JSON parsing fails, try to get text content
    try {
      const errorText = await response.text();
      errorMessage = errorText || errorMessage;
    } catch {
      // If both JSON and text parsing fail, use status text
      errorMessage = response.statusText || errorMessage;
    }
  }

  switch (response.status) {
    case 404:
      throw new Error(`Server endpoint not found. Please verify the server is running at ${API_URL}`);
    case 413:
      throw new Error('File size too large. Please try a smaller file.');
    case 415:
      throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
    case 500:
      throw new Error('Server error occurred. Please try again later.');
    case 503:
      throw new Error('Analysis service unavailable. Please try again later.');
    default:
      throw new Error(errorMessage);
  }
};

/**
 * Upload a screenplay file for analysis
 */
const uploadScreenplay = async (formData: FormData): Promise<{analysis: ScreenplayAnalysis, analysisId: string}> => {
  const requestId = Date.now().toString();
  console.log('Starting upload request:', {
    requestId,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('Upload response received:', {
      requestId,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    });
    
    if (!response.ok) {
      const errorDetails = {
        requestId,
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString()
      };
      
      console.error('Upload request failed:', errorDetails);
      
      try {
        const errorData = await response.json();
        console.error('Error response data:', {
          ...errorDetails,
          errorData
        });
        throw new Error(errorData.message || `Upload failed: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        console.error('Failed to parse error response:', {
          ...errorDetails,
          parseError
        });
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    console.log('Upload successful:', {
      requestId,
      analysisId: data.analysisId,
      timestamp: new Date().toISOString()
    });
    
    // Ensure we return both the analysis data and the ID
    return {
      analysis: data.analysis,
      analysisId: data.analysisId
    };
  } catch (error) {
    const errorDetails = {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error('Upload request error:', errorDetails);
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Unable to connect to server at ${API_URL}. Please ensure the server is running and accessible.`);
    }
    throw error;
  }
};

/**
 * Get analysis progress
 */
const getProgress = async (analysisId: string): Promise<{ status: string }> => {
  try {
    const response = await fetch(`${API_URL}/progress/${analysisId}`);
    if (!response.ok) {
      await handleApiError(response, 'Progress check');
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Unable to connect to server at ${API_URL}. Please ensure the server is running.`);
    }
    throw error;
  }
};

/**
 * Get analysis results by ID
 */
const getAnalysis = async (params: string | Record<string, any>): Promise<ScreenplayAnalysis> => {
  const requestId = Date.now().toString();
  console.log('Making analysis request:', {
    requestId,
    params,
    paramsType: typeof params,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Handle different types of IDs
    let analysisId: string;
    
    // Case 1: String ID
    if (typeof params === 'string') {
      console.log('Handling string ID:', params);
      analysisId = params;
    } 
    // Case 2: Object with ID
    else if (params && typeof params === 'object') {
      console.log('Handling object ID:', JSON.stringify(params));
      
      // Try to extract ID from the object
      if ('id' in params && params.id !== undefined) {
        // If params.id is itself an object, extract from it or stringify it
        if (typeof params.id === 'object' && params.id !== null) {
          console.log('ID is a nested object:', JSON.stringify(params.id));
          if ('id' in params.id && params.id.id !== undefined) {
            analysisId = String(params.id.id);
          } else if ('analysisId' in params.id && params.id.analysisId !== undefined) {
            analysisId = String(params.id.analysisId);
          } else {
            // Last resort: use filename if available
            analysisId = params.id.filename || params.filename || JSON.stringify(params.id);
          }
        } else {
          analysisId = String(params.id);
        }
      } 
      // Try alternative property names
      else if ('analysisId' in params && params.analysisId !== undefined) {
        analysisId = String(params.analysisId);
      }
      // Try to use filename directly if present
      else if ('filename' in params && params.filename !== undefined) {
        analysisId = String(params.filename);
      } 
      else {
        // Last resort: stringify the whole object
        analysisId = JSON.stringify(params);
      }
    } else {
      throw new Error('Invalid parameters: expected string ID or object with id property');
    }

    console.log('Final analysisId:', analysisId);

    if (!analysisId || analysisId === '[object Object]' || analysisId === 'undefined') {
      console.error('Invalid analysis ID after processing:', { 
        params, 
        extractedId: analysisId 
      });
      throw new Error('Analysis ID is required and must be a valid string');
    }
    
    // Create a properly formatted request body with the string ID
    const requestBody = { id: analysisId };
    console.log('Request body:', JSON.stringify(requestBody));
    
    const response = await fetch(`${API_URL}/analysis`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Received response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url
    });
    
    if (!response.ok) {
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        timestamp: new Date().toISOString()
      };
      
      console.error('Analysis request failed:', errorDetails);
      
      try {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        throw new Error(errorData.error || errorData.message || `Analysis request failed: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        throw new Error(`Analysis request failed: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    console.log('Analysis request successful:', {
      responseData: data,
      url: response.url,
      timestamp: new Date().toISOString()
    });
    
    return data.analysis || data;
  } catch (error) {
    const errorDetails = {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: `${API_URL}/analysis`,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    console.error('Analysis request error:', errorDetails);
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Unable to connect to server at ${API_URL}. Please ensure the server is running.`);
    }
    throw error;
  }
};

export const apiClient = {
  uploadScreenplay,
  getProgress,
  getAnalysis,
  async analyzeScreenplay(screenplay: string): Promise<ScreenplayAnalysis> {
    try {
      // Check if Ollama is available and the model is installed
      const isModelAvailable = await ollamaService.checkModelAvailability();
      if (!isModelAvailable) {
        throw new ApiError('Ollama model not available. Please ensure Ollama is running and the Mistral model is installed.', 503);
      }

      // Analyze the screenplay using Ollama
      const analysis = await ollamaService.analyzeScreenplay(screenplay);
      return analysis;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to analyze screenplay');
    }
  },

  async exportAnalysis(analysis: ScreenplayAnalysis, format: 'pdf' | 'docx'): Promise<Blob> {
    try {
      const response = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysis),
      });

      if (!response.ok) {
        throw new ApiError('Failed to export analysis');
      }

      return response.blob();
    } catch (error) {
      throw new ApiError('Failed to export analysis');
    }
  },
};