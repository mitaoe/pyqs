# PDF Preview Modal - Refactored Architecture

This directory contains the refactored PDF Preview Modal component, broken down into smaller, more maintainable pieces.

## Architecture Overview

The original 1131-line component has been split into:

### Custom Hooks (`/hooks`)

- **`usePDFDocument.ts`** - Handles PDF document loading and PDF.js library initialization
- **`usePDFZoom.ts`** - Manages zoom state, scale calculations, and zoom controls
- **`usePDFNavigation.ts`** - Handles page and document navigation logic
- **`usePDFGestures.ts`** - Manages touch and mouse interactions (pan, pinch-to-zoom)
- **`usePDFRenderer.ts`** - Handles PDF page rendering, canvas management, and lazy loading

### UI Components (`/components`)

- **`PDFToolbar.tsx`** - The top toolbar with navigation and zoom controls
- **`PDFLoadingState.tsx`** - Loading animation and progress indicators
- **`PDFErrorState.tsx`** - Error display component
- **`PDFPage.tsx`** - Individual PDF page canvas wrapper

### Context (`/context`)

- **`PDFContext.tsx`** - React context for sharing state between components, avoiding prop drilling

### Main Component

- **`PDFPreviewModalRefactored.tsx`** - The main orchestrating component that uses all hooks and renders the UI

## Benefits of This Architecture

### 1. **Separation of Concerns**

- Each hook has a single responsibility
- UI components are focused on presentation
- Business logic is separated from presentation logic

### 2. **Improved Testability**

- Individual hooks can be tested in isolation
- Components can be unit tested separately
- Easier to mock dependencies

### 3. **Better Maintainability**

- Smaller, focused files are easier to understand and modify
- Changes to one concern don't affect others
- Clear boundaries between different functionalities

### 4. **Reusability**

- Hooks can be reused in other PDF-related components
- UI components can be composed differently if needed
- Context can be extended for additional PDF viewers

### 5. **Performance**

- Better optimization opportunities with focused hooks
- Easier to identify and fix performance bottlenecks
- More granular re-rendering control

## Usage

```tsx
import PDFPreviewModal from "@/components/pdf/PDFPreviewModal";

// The component interface remains the same
<PDFPreviewModal
  isOpen={isOpen}
  onClose={onClose}
  paper={paper}
  papers={papers}
  onNavigate={onNavigate}
/>;
```

## Migration Notes

- The public API remains unchanged - existing usage will continue to work
- All original functionality is preserved
- Performance characteristics should be similar or improved
- The original implementation is available for reference if needed

## Future Enhancements

This modular architecture makes it easier to add new features:

- Additional zoom modes
- Annotation support
- Different viewing layouts
- Accessibility improvements
- Performance optimizations
