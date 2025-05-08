import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-cinema-dark shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Film className="h-8 w-8 text-accent-400" />
            <span className="font-heading font-bold text-xl md:text-2xl text-white">ScreenScore</span>
          </Link>
          
          <div className="hidden md:flex space-x-6 items-center">
            <Link to="/" className="text-gray-300 hover:text-accent-400 transition-colors">
              Home
            </Link>
            <a href="#how-it-works" className="text-gray-300 hover:text-accent-400 transition-colors">
              How It Works
            </a>
            <a 
              href="https://github.com/acharyaparth/ScreenScore"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent shadow-none border border-accent-400 hover:bg-accent-400/80 hover:text-cinema-dark transition-colors"
            >
              View on GitHub
            </a>
          </div>
          
          <button 
            className="md:hidden text-white"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
      
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-gray-900 animate-fade-in">
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors py-2">
              Home
            </Link>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors py-2">
              How It Works
            </a>
            <a 
              href="https://github.com/acharyaparth/ScreenScore"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent w-full"
            >
              View on GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;