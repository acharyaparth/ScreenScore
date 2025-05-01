import React from 'react';
import { File as FilePdf, FileText, FileType, X, FileDown, Globe } from 'lucide-react';
import { exportToPdf, exportToMarkdown, exportToDocx, exportToHtml } from '../../services/export';
import { ScreenplayAnalysis } from '../../types';

interface ExportMenuProps {
  analysis: ScreenplayAnalysis;
  onClose: () => void;
}

const ExportMenu: React.FC<ExportMenuProps> = ({ analysis, onClose }) => {
  const handleExportPdf = async () => {
    await exportToPdf(analysis);
    onClose();
  };

  const handleExportMarkdown = async () => {
    await exportToMarkdown(analysis);
    onClose();
  };

  const handleExportDocx = async () => {
    await exportToDocx(analysis);
    onClose();
  };

  const handleExportHtml = async () => {
    await exportToHtml(analysis);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 bg-gray-800 shadow-lg rounded-md w-64 p-2 z-10 animate-fade-in">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
        <h3 className="text-white font-medium">Export Options</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <button
        onClick={handleExportPdf}
        className="w-full flex items-center p-3 rounded-md hover:bg-gray-700 text-left transition-colors mb-1"
      >
        <FilePdf className="w-5 h-5 text-red-400 mr-3" />
        <div>
          <p className="text-white">Export as PDF</p>
          <p className="text-xs text-gray-400">Formatted document for sharing</p>
        </div>
      </button>
      
      <button
        onClick={handleExportDocx}
        className="w-full flex items-center p-3 rounded-md hover:bg-gray-700 text-left transition-colors mb-1"
      >
        <FileType className="w-5 h-5 text-blue-400 mr-3" />
        <div>
          <p className="text-white">Export as DOCX</p>
          <p className="text-xs text-gray-400">Microsoft Word document</p>
        </div>
      </button>
      
      <button
        onClick={handleExportMarkdown}
        className="w-full flex items-center p-3 rounded-md hover:bg-gray-700 text-left transition-colors"
      >
        <FileText className="w-5 h-5 text-green-400 mr-3" />
        <div>
          <p className="text-white">Export as Markdown</p>
          <p className="text-xs text-gray-400">Plain text format for editing</p>
        </div>
      </button>
      
      <button
        onClick={handleExportHtml}
        className="w-full flex items-center p-3 rounded-md hover:bg-gray-700 text-left transition-colors"
      >
        <Globe className="w-5 h-5 text-purple-400 mr-3" />
        <div>
          <p className="text-white">Export as HTML</p>
          <p className="text-xs text-gray-400">Web page format for sharing</p>
        </div>
      </button>
    </div>
  );
};

export default ExportMenu;