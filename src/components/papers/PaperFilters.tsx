import type { FilterOption } from '@/utils/search';

interface PaperFiltersProps {
  years: FilterOption[];
  branches: FilterOption[];
  semesters: FilterOption[];
  examTypes: FilterOption[];
  subjects: FilterOption[];
  selectedYear: string;
  selectedBranch: string;
  selectedSemester: string;
  selectedExamType: string;
  selectedSubject: string;
  onYearChange: (year: string) => void;
  onBranchChange: (branch: string) => void;
  onSemesterChange: (semester: string) => void;
  onExamTypeChange: (examType: string) => void;
  onSubjectChange: (subject: string) => void;
}

export default function PaperFilters({
  years,
  branches,
  semesters,
  examTypes,
  subjects,
  selectedYear,
  selectedBranch,
  selectedSemester,
  selectedExamType,
  selectedSubject,
  onYearChange,
  onBranchChange,
  onSemesterChange,
  onExamTypeChange,
  onSubjectChange,
}: PaperFiltersProps) {
  const selectClasses = "w-full rounded-lg border border-accent bg-secondary px-3 py-2 text-sm text-content transition-colors hover:border-accent/80 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClasses = "block text-sm font-medium text-content/80 mb-1.5";

  return (
    <div className="rounded-lg border border-accent bg-secondary">
      <div className="border-b border-accent px-4 py-3">
        <h3 className="font-medium text-content">Filter Papers</h3>
      </div>
      
      <div className="space-y-4 p-4">
        <div>
          <label className={`${labelClasses} text-base`}>Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className={`${selectClasses} text-base`}
          >
            <option value="">All Subjects</option>
            {subjects.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </select>
        </div>

        <div className="border-t border-accent/20 pt-4">
          <h4 className="mb-3 text-sm font-medium text-content/60">Advanced Filters</h4>
          
          <div className="space-y-3">
            <div>
              <label className={labelClasses}>Academic Year</label>
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(e.target.value)}
                className={selectClasses}
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => onBranchChange(e.target.value)}
                className={selectClasses}
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.value} value={branch.value}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => onSemesterChange(e.target.value)}
                className={selectClasses}
              >
                <option value="">All Semesters</option>
                {semesters.map((semester) => (
                  <option key={semester.value} value={semester.value}>
                    {semester.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClasses}>Exam Type</label>
              <select
                value={selectedExamType}
                onChange={(e) => onExamTypeChange(e.target.value)}
                className={selectClasses}
              >
                <option value="">All Exam Types</option>
                {examTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 