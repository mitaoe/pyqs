# MITAOE Previous Year Question Papers

A modern interface for accessing MITAOE's previous year question papers. This project provides an enhanced user experience while accessing the existing question paper repository.

## Tech Stack

- **Next.js** (v15.1.7) - React framework
- **Node.js** (v23.8.0) - Runtime environment
- **Prisma** (v6.4.1) - ORM for database operations
- **TypeScript** (v5.7+) - Type safety
- **TailwindCSS** (v4.0) - Styling
- **SQLite** - Database (via Prisma)

## Features

- 📚 Browse question papers by year, branch, and semester
- 🔍 Advanced search functionality
- 📱 Responsive design
- 🚀 Fast and efficient
- 🔄 Real-time updates
- 📊 Metadata-based organization

## Getting Started

### Prerequisites

- Node.js v18.18 or later
- npm v10 or later

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mitaoe-pyqs.git
   cd mitaoe-pyqs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npx prisma migrate dev
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the root directory:
```env
# Database URL for Prisma
DATABASE_URL="file:./dev.db"
```

## Project Structure

```
src/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/          # Utility functions
└── types/        # TypeScript types

prisma/
└── schema.prisma # Database schema
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx prisma studio` - Open Prisma database GUI

## Deployment

This project can be deployed on Vercel:

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy!

## Legal Notice

This project serves as an enhanced interface for MITAOE's question paper repository. We do not host any question papers directly - all papers are served from the original MITAOE servers. This is purely a metadata service to improve discovery and access.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
