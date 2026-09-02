import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-[hsl(221,83%,53%)] via-[hsl(221,83%,48%)] to-[hsl(221,83%,43%)] z-50 flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center space-y-8">
        {/* Logo animatsiyasi */}
        <div className="flex justify-center animate-bounce">
          <div className="bg-[hsl(43,96%,56%)] p-6 rounded-2xl shadow-2xl">
            <Scale className="h-20 w-20 text-[hsl(221,83%,53%)]" />
          </div>
        </div>

        {/* Akademiya nomi */}
        <div className="space-y-3 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-2xl">
            JurisMind
          </h1>
          <p className="text-xl md:text-2xl font-medium text-blue-100 drop-shadow-lg animate-fade-in-delay">
            Bilimingizni sun'iy intellekt bilan yuksaltiring
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-80 max-w-md mx-auto">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-[hsl(43,96%,56%)] rounded-full transition-all duration-300 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/80 text-sm mt-3 font-medium">{progress}%</p>
        </div>

        {/* Rotating circles */}
        <div className="flex justify-center gap-3">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-150" />
          <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-300" />
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }

        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.2s backwards;
        }

        .animate-fade-in-delay-2 {
          animation: fade-in 0.8s ease-out 0.4s backwards;
        }

        .delay-150 {
          animation-delay: 150ms;
        }

        .delay-300 {
          animation-delay: 300ms;
        }
      `}</style>
    </div>
  );
}
