import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FileUploadPage, AnalysisPage, NotFoundPage } from './pages';
import { Navbar, Footer } from './components/layout';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<FileUploadPage />} />
            <Route path="/analysis/:id" element={<AnalysisPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;