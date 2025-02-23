import mongoose from 'mongoose';

const DirectorySchema = new mongoose.Schema({
  path: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: String,
  parent: String,  // parent path
  type: {
    type: String,
    enum: ['year', 'academicYear', 'branch', 'exam'],
    required: true
  },
  papers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper'
  }]
}, {
  timestamps: true
});

// Create indexes for other fields
DirectorySchema.index({ parent: 1 });
DirectorySchema.index({ type: 1 });

export default mongoose.models.Directory || mongoose.model('Directory', DirectorySchema); 