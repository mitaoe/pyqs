import mongoose from 'mongoose';

const PaperSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    index: true
  },
  branch: {
    type: String,
    index: true
  },
  semester: {
    type: String,
    index: true
  },
  subject: {
    type: String,
    index: true
  },
  examType: {
    type: String,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalUrl: {
    type: String,
    required: true,
    unique: true
  }
}, {
  timestamps: true,
  collection: 'pyqs'
});

// Create indexes for search
PaperSchema.index({ 
  year: 'text', 
  branch: 'text', 
  semester: 'text',
  subject: 'text',
  fileName: 'text'
});

export default mongoose.models.Paper || mongoose.model('Paper', PaperSchema); 