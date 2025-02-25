interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const maxVisiblePages = 5;

  let visiblePages = pages;
  if (totalPages > maxVisiblePages) {
    const start = Math.max(
      Math.min(
        currentPage - Math.floor(maxVisiblePages / 2),
        totalPages - maxVisiblePages + 1
      ),
      1
    );
    visiblePages = pages.slice(start - 1, start + maxVisiblePages - 1);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        Previous
      </button>

      {visiblePages[0] > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className={`rounded-md px-3 py-1 text-sm ${
              currentPage === 1
                ? 'bg-gray-900 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            1
          </button>
          {visiblePages[0] > 2 && (
            <span className="text-gray-500">...</span>
          )}
        </>
      )}

      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`rounded-md px-3 py-1 text-sm ${
            currentPage === page
              ? 'bg-gray-900 text-white'
              : 'hover:bg-gray-100'
          }`}
        >
          {page}
        </button>
      ))}

      {visiblePages[visiblePages.length - 1] < totalPages && (
        <>
          {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
            <span className="text-gray-500">...</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`rounded-md px-3 py-1 text-sm ${
              currentPage === totalPages
                ? 'bg-gray-900 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
} 