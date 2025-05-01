import React from 'react';
import { ChevronRight } from 'lucide-react';

interface HeroProps {
  title: string;
  subtitle: string;
  ctaText?: string;
}

const Hero: React.FC<HeroProps> = ({ title, subtitle, ctaText }) => {
  return (
    <div className="text-center py-12 md:py-20">
      <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
        <span className="text-accent-400">Script</span>
        <span className="text-primary-400">Analysis</span>
      </h1>
      <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
        {subtitle}
      </p>
      {ctaText && (
        <button className="btn btn-accent text-lg px-8 py-3">
          {ctaText}
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
};

export default Hero;