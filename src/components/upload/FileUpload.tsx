import React, { useState, useRef } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api';

interface FileUploadProps {
  onUploadStart: () => void;
  onUploadSuccess: (response: { analysis: any; analysisId: string }) => void;
  onUploadError: (error: string) => void;
  isUploading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadStart,
  onUploadSuccess,
  onUploadError,
  isUploading
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };
  
  const validateFile = (file: File): boolean => {
    const validTypes = ['application/pdf', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or TXT file.');
      return false;
    }
    
    if (file.size > maxSize) {
      setError('File size should be less than 10MB.');
      return false;
    }
    
    return true;
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setError(null);
      }
    }
  };
  
  const handleClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedFile) return;
    
    try {
      setError(null);
      onUploadStart();
      
      const formData = new FormData();
      formData.append('screenplay', selectedFile);
      
      const response = await apiClient.uploadScreenplay(formData);
      onUploadSuccess(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      onUploadError(errorMessage);
    }
  };
  
  return (
    <div className="card max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Upload Your Screenplay</h2>
        <p className="text-gray-400">Drag and drop your file or click to browse</p>
      </div>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          dragActive ? 'border-primary-400 bg-primary-900/10' : 'border-gray-600 hover:border-gray-500'
        } ${selectedFile ? 'bg-gray-700/30' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={selectedFile ? undefined : handleClick}
        style={{ cursor: selectedFile ? 'default' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt"
          onChange={handleChange}
        />
        
        {selectedFile ? (
          <div className="flex items-center justify-between bg-gray-700 rounded-md p-3">
            <div className="flex items-center">
              <File className="h-10 w-10 text-primary-400 mr-3" />
              <div className="text-left">
                <p className="text-white font-medium truncate max-w-xs">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="text-gray-400 hover:text-white p-1"
              aria-label="Remove file"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="py-8">
            <Upload className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-300 font-medium mb-1">
              PDF or TXT files only
            </p>
            <p className="text-gray-500 text-sm">
              Maximum file size: 10MB
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="flex items-center mt-4 p-3 bg-red-900/20 text-red-400 rounded">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={!selectedFile || isUploading}
          className={`btn btn-primary w-full ${
            isUploading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              Analyze Screenplay
            </>
          )}
        </button>
      </div>
      
      <div className="mt-4 text-center text-gray-500 text-sm">
        <p>
          By uploading, you agree to our{' '}
          <a href="#" className="text-primary-400 hover:text-primary-300">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
};

export default FileUpload;