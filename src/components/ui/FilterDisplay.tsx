interface FilterDisplayProps {
  years?: string[];
  branches?: string[];
  semesters?: string[];
  examTypes?: string[];
  className?: string;
}

export default function FilterDisplay({
  years = [],
  branches = [],
  semesters = [],
  examTypes = [],
  className = ''
}: FilterDisplayProps) {
  if (!years.length && !branches.length && !semesters.length && !examTypes.length) {
    return null;
  }

  return (
    <div className={`grid grid-cols-2 gap-4 text-sm md:grid-cols-4 ${className}`}>
      {years.length > 0 && (
        <div>
          <span className="text-content/60">Years:</span>
          <div className="mt-1 text-content">{years.join(', ')}</div>
        </div>
      )}
      {branches.length > 0 && (
        <div>
          <span className="text-content/60">Branches:</span>
          <div className="mt-1 text-content">{branches.join(', ')}</div>
        </div>
      )}
      {examTypes.length > 0 && (
        <div>
          <span className="text-content/60">Exam Types:</span>
          <div className="mt-1 text-content">{examTypes.join(', ')}</div>
        </div>
      )}
      {semesters.length > 0 && (
        <div>
          <span className="text-content/60">Semesters:</span>
          <div className="mt-1 text-content">{semesters.join(', ')}</div>
        </div>
      )}
    </div>
  );
} 