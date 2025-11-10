'use client';

import { useServerStatus } from '@/contexts/ServerStatusContext';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';

export default function ServerStatusBanner() {
  const { isServerDown, isChecking, checkServerStatus } = useServerStatus();

  if (!isServerDown) {
    return null;
  }

  const handleRecheck = async () => {
    await checkServerStatus();
  };

  return (
    <div className="relative bg-yellow-500 dark:bg-yellow-600 text-yellow-950 dark:text-yellow-50 px-4 py-3 shadow-lg border-b-2 border-yellow-600 dark:border-yellow-700">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Warning size={24} weight="fill" className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm sm:text-base">
              MITAoE Library Servers Are Currently Down
            </p>
            <p className="text-xs sm:text-sm mt-0.5 opacity-90">
              Just like how Moodle goes down sometimes, the library servers are temporarily unavailable. 
              Download and preview features are disabled until servers are back online.
            </p>
          </div>
        </div>
        <button
          onClick={handleRecheck}
          disabled={isChecking}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-yellow-950/20 dark:bg-yellow-50/20 hover:bg-yellow-950/30 dark:hover:bg-yellow-50/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          aria-label="Recheck server status"
        >
          <ArrowClockwise 
            size={16} 
            weight="bold" 
            className={isChecking ? 'animate-spin' : ''}
          />
          <span className="hidden sm:inline">
            {isChecking ? 'Checking...' : 'Recheck'}
          </span>
        </button>
      </div>
    </div>
  );
}
