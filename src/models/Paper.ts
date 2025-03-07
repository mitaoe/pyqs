import mongoose from 'mongoose';

// Define individual paper schema
const PaperSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  url: { type: String, required: true },
  year: { type: String, required: true },
  branch: { type: String, required: true },
  semester: { type: String, required: true },
  examType: { type: String, required: true },
  subject: { type: String, default: 'Unknown' },
  standardSubject: { type: String, default: 'Unknown' },
  isDirectory: { type: Boolean, default: false }
}, { _id: false });

// Main PYQ schema for collection of papers
const PYQSchema = new mongoose.Schema({
  papers: [PaperSchema],
  meta: {
    years: [{ type: String }],
    branches: [{ type: String }],
    examTypes: [{ type: String }],
    semesters: [{ type: String }],
    subjects: [{ type: String }],
    standardSubjects: [{ type: String }]
  },
  stats: {
    totalFiles: { type: Number, required: true },
    totalDirectories: { type: Number, required: true },
    lastUpdated: { type: Date, required: true }
  }
});

// Create indexes for improved query performance
PYQSchema.index({ 'papers.year': 1 });
PYQSchema.index({ 'papers.branch': 1 });
PYQSchema.index({ 'papers.semester': 1 });
PYQSchema.index({ 'papers.examType': 1 });
PYQSchema.index({ 'papers.subject': 1 });
PYQSchema.index({ 'papers.standardSubject': 1 });

// Create text index for search functionality
PYQSchema.index({
  'papers.fileName': 'text',
  'papers.subject': 'text',
  'papers.standardSubject': 'text'
});

// Use existing model or create a new one
const PYQ = mongoose.models.PYQ || mongoose.model('PYQ', PYQSchema);

export default PYQ; 