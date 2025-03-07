import mongoose from 'mongoose';
import type { DirectoryNode, DirectoryMeta } from '@/types/paper';

// Define metadata schema for paper files
const PaperMetadataSchema = new mongoose.Schema({
  year: { type: String },
  branch: { type: String },
  examType: { type: String },
  semester: { type: String },
  subject: { type: String, default: 'Unknown' },
  standardSubject: { type: String, default: 'Unknown' },
  fileName: { type: String },
  url: { type: String }
}, { _id: false });

// Schema for directory stats
const StatsSchema = new mongoose.Schema({
  totalFiles: { type: Number, default: 0 },
  totalDirectories: { type: Number, default: 0 }
}, { _id: false });

// Schema for metadata collections
const MetaSchema = new mongoose.Schema({
  papers: [PaperMetadataSchema],
  years: [{ type: String }],
  branches: [{ type: String }],
  examTypes: [{ type: String }],
  semesters: [{ type: String }],
  subjects: [{ type: String }],
  standardSubjects: [{ type: String }]
}, { _id: false });

// Main Directory document schema
const DirectorySchema = new mongoose.Schema({
  structure: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v: unknown): v is DirectoryNode {
        return typeof v === 'object' && v !== null && 'children' in v;
      },
      message: 'Invalid directory structure'
    }
  },
  meta: {
    type: MetaSchema,
    required: true,
    validate: {
      validator: function(v: unknown): v is DirectoryMeta {
        return typeof v === 'object' && v !== null && 'papers' in v;
      },
      message: 'Invalid directory metadata'
    }
  },
  stats: {
    type: StatsSchema,
    required: true
  },
  lastUpdated: {
    type: Date,
    required: true
  }
});

// Create indexes for common queries
DirectorySchema.index({ 'structure.path': 1 });
DirectorySchema.index({ 'meta.years': 1 });
DirectorySchema.index({ 'meta.branches': 1 });
DirectorySchema.index({ 'meta.examTypes': 1 });
DirectorySchema.index({ 'meta.semesters': 1 });
DirectorySchema.index({ 'meta.subjects': 1 });
DirectorySchema.index({ 'meta.standardSubjects': 1 });

// Create text index for search
DirectorySchema.index({
  'structure.metadata.fileName': 'text',
  'structure.metadata.subject': 'text',
  'structure.metadata.standardSubject': 'text'
});

const Directory = mongoose.models.Directory || mongoose.model('Directory', DirectorySchema);

export default Directory;