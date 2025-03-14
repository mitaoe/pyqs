# MITAOE PYQs

Enhanced interface for accessing MITAOE's previous year question papers, designed with a subject-focused approach for easier navigation and better user experience.

## 📚 For Students

### Quick Access
Simply visit [mitaoe-pyqs.vercel.app](https://mitaoe-pyqs.vercel.app) and:
1. Search by subject name (e.g., "DBMS", "Computer Networks")
2. Browse papers organized by subjects
3. Download single papers or multiple papers at once

### Features

- 📖 Subject-focused organization
- 🔍 Smart search with subject abbreviations (e.g., DBMS, CN)
- ⬇️ Batch download capability
- 📱 Mobile-friendly interface
- ⚡ Fast loading experience
- 🎯 Simple, intuitive navigation

### How to Use

1. **Find Papers**
   - Search by subject name
   - Use filters for specific years/branches (optional)
   - Papers are sorted by recency by default

2. **Download Options**
   - Single click to download individual papers
   - Select multiple papers for batch download
   - Progress indicators show download status

---

## 💻 For Developers

### Tech Stack

- **Frontend**: Next.js 15
- **Backend**: MongoDB/Mongoose
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Package Manager**: pnpm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mitaoe-pyqs.git
cd mitaoe-pyqs

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Add your MongoDB URI to .env

# Run development server
pnpm dev
```

### Project Structure

```
mitaoe-pyqs/
├── app/                # Next.js app directory
│   ├── api/           # API routes
│   ├── papers/        # Subject-focused paper view
│   └── browse/        # Developer paper browser
├── components/        # React components
├── lib/              # Utility functions
├── models/           # MongoDB models
└── scripts/          # Crawler and data processing
```

### Key Features Implementation

- **Subject Extraction**: Automated subject identification from paper names
- **Data Caching**: Optimized loading with client-side caching
- **Batch Downloads**: Server-side ZIP creation for multiple papers
- **Search System**: Enhanced search with subject abbreviation support

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Legal

We don't store any papers - all content is served directly from MITAOE servers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
