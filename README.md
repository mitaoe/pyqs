# MITAOE Previous Year Question Papers

A modern interface for accessing MITAOE's previous year question papers. This project provides an enhanced user experience while accessing the existing question paper repository.

## Tech Stack

- **Next.js** (v15.1.7) - React framework
- **Node.js** (v23.8.0) - Runtime environment
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **TypeScript** (v5.7+) - Type safety
- **TailwindCSS** (v4.0) - Styling

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
- MongoDB Atlas account

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

3. Set up environment variables:
   Create a `.env` file in the root directory with your MongoDB connection string:
   ```env
   MONGODB_URI="your_mongodb_connection_string"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/
│   ├── db.ts     # MongoDB connection
│   └── crawler.ts # Directory crawler
├── models/        # Mongoose models
│   └── Paper.ts   # Paper schema
└── types/        # TypeScript types
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Deployment

This project can be deployed on Vercel:

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables (add MONGODB_URI)
4. Deploy!

## Legal Notice

This project serves as an enhanced interface for MITAOE's question paper repository. We do not host any question papers directly - all papers are served from the original MITAOE servers. This is purely a metadata service to improve discovery and access.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
