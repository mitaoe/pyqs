import mongoose from 'mongoose';
import type { DirectoryStructure, DirectoryMeta, DirectoryStats } from '@/types/paper';

const DirectoryNodeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  type: { type: String, enum: ['directory', 'file'], required: true },
  stats: {
    totalFiles: { type: Number, default: 0 },
    totalDirectories: { type: Number, default: 0 }
  },
  children: { type: Map, of: this },
  metadata: {
    year: String,
    branch: String,
    examType: String,
    semester: String,
    fileName: String,
    url: String
  },
  meta: {
    years: [{ type: String }],
    branches: [{ type: String }],
    examTypes: [{ type: String }],
    semesters: [{ type: String }]
  }
}, { _id: false });

const PYQSchema = new mongoose.Schema({
  lastUpdated: { type: Date, required: true },
  stats: {
    totalFiles: { type: Number, required: true },
    totalDirectories: { type: Number, required: true }
  },
  structure: {
    type: DirectoryNodeSchema,
    required: true
  },
  meta: {
    years: [{ type: String }],
    branches: [{ type: String }],
    examTypes: [{ type: String }],
    semesters: [{ type: String }]
  }
}, {
  strict: false // Allow mixed type for nested children
});

// Create indexes for common queries
PYQSchema.index({ 'structure.path': 1 });
PYQSchema.index({ 'meta.years': 1 });
PYQSchema.index({ 'meta.branches': 1 });
PYQSchema.index({ 'meta.examTypes': 1 });
PYQSchema.index({ 'meta.semesters': 1 });

// Create text index for search
PYQSchema.index({
  'structure.metadata.fileName': 'text',
  'structure.metadata.year': 'text',
  'structure.metadata.branch': 'text',
  'structure.metadata.semester': 'text',
  'structure.metadata.examType': 'text'
});

export interface PYQDocument extends mongoose.Document {
  lastUpdated: Date;
  stats: DirectoryStats;
  structure: DirectoryStructure;
  meta: DirectoryMeta;
}

const PYQ = mongoose.models.PYQ || mongoose.model<PYQDocument>('PYQ', PYQSchema);

export default PYQ; 