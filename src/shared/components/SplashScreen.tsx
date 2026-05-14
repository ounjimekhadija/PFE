import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 9000; // 9 seconds of active loading
    const interval = 100;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Wait for progress to be seen at 100% then start fade out
          setTimeout(() => setIsVisible(false), 500);
          // Complete after fade out duration (1000ms)
          setTimeout(onComplete, 1500);
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f0f0e] transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="relative flex flex-col items-center">
        {/* Animated Background Glow */}
        <div className="absolute -inset-20 bg-[#765b00] opacity-10 blur-[100px] animate-pulse"></div>
        
        {/* Logo / Brand Name */}
        <div className="mb-12 relative">
          <h1 className="text-6xl font-bold tracking-tighter text-white animate-fade-in-up">
            Bar<span className="text-[#765b00]">Oun</span>
          </h1>
          <div className="absolute -bottom-2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#765b00] to-transparent animate-expand"></div>
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden relative backdrop-blur-sm">
          <div 
            className="h-full bg-gradient-to-r from-[#765b00] to-[#b88c00] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Subtitle */}
        <p className="mt-4 text-[#7f7664] text-sm tracking-[0.2em] uppercase animate-pulse">
          Initialisation de votre espace
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes expand {
          from { width: 0; left: 50%; }
          to { width: 100%; left: 0; }
        }
        .animate-fade-in-up {
          animation: fade-in-up 1.5s ease-out forwards;
        }
        .animate-expand {
          animation: expand 2s ease-out forwards;
        }
      ` }} />
    </div>
  );
};

export default SplashScreen;
