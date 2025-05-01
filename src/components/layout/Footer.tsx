import React from 'react';
import { Film, Github } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="flex items-center mb-4 md:mb-0">
            <Film className="h-6 w-6 text-accent-400 mr-2" />
            <span className="font-heading font-bold text-xl text-white">ScreenScore</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <a 
              href="https://github.com/your-username/screenscore"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <Github className="h-5 w-5 mr-2" />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-gray-400 mb-4">
            ScreenScore is an open-source screenplay analysis tool that runs entirely on your local machine.
            No data leaves your computer, ensuring complete privacy for your screenplays.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Use</a>
            <a href="#" className="hover:text-white transition-colors">License</a>
          </div>
          
          <p className="mt-6 text-gray-500">
            © {new Date().getFullYear()} ScreenScore. Released under the MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;