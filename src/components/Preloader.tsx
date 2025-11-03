import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const Preloader = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Hide preloader after initial content loads
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary animate-fade-out">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-white border-t-primary/50 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-8 h-8 text-white" />
        </div>
      </div>
    </div>
  );
};

import { Shield } from 'lucide-react';
