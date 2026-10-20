"use client"

import { CheckSquare, X } from "@phosphor-icons/react"
import FadeIn from "@/components/animations/FadeIn"

interface SelectModeControlProps {
  isSelectMode: boolean
  onToggle: () => void
  buttonClassName: string
  showTutorial: boolean
  onDismissTutorial: () => void
  tutorialPosition: { popover: string; arrow: string }
}

export const DESKTOP_TUTORIAL_POSITION = { popover: "right-7", arrow: "right-7" }
export const MOBILE_TUTORIAL_POSITION = { popover: "right-12", arrow: "right-10" }

export default function SelectModeControl({
  isSelectMode,
  onToggle,
  buttonClassName,
  showTutorial,
  onDismissTutorial,
  tutorialPosition,
}: SelectModeControlProps) {
  return (
    <>
      <button
        onClick={onToggle}
        className={`${buttonClassName} rounded-lg transition-colors ${
          isSelectMode ? "bg-brand text-white" : "bg-secondary text-content/80 hover:text-brand"
        }`}
        aria-label={isSelectMode ? "Exit selection mode" : "Enter selection mode"}
      >
        {isSelectMode ? <X size={16} weight="bold" /> : <CheckSquare size={16} weight="bold" />}
      </button>
      {showTutorial && (
        <FadeIn
          duration={0.3}
          className={`absolute top-full ${tutorialPosition.popover} mt-2 w-60 z-50`}
        >
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-brand/20 relative">
            <div
              className={`absolute -top-2 ${tutorialPosition.arrow} w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-t-2 border-brand/20 transform rotate-45`}
            ></div>

            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 w-6 h-6 bg-brand/10 rounded-full flex items-center justify-center">
                <CheckSquare size={14} weight="bold" className="text-brand" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-content mb-2 leading-relaxed">
                  <span className="text-brand font-semibold">Pro Tip:</span> Select multiple papers
                  and download them all at once for convenience!
                </p>
                <button
                  onClick={onDismissTutorial}
                  className="w-full bg-brand text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-brand/90 transition-colors duration-200 shadow-sm"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </>
  )
}
