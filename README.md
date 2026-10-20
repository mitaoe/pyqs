# MITAoE PYQs - Previous Year Question Papers

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?style=flat-square)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?style=flat-square)](https://tailwindcss.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)

Enhanced interface for accessing MIT Academy of Engineering (MITAoE) previous year question papers with a subject-focused approach for easier navigation.

![MITAoE PYQs Screenshot](https://mitaoe-pyqs.vercel.app/og-image.png)

## Contents

- [Key Features](#-key-features)
- [Quick Start](#-quick-start)
- [Supported Departments](#-supported-departments)
- [For Developers](#-for-developers)
- [Acknowledgements](#acknowledgements)
- [Legal Notice](#legal-notice)
- [License](#license)

## 🎯 Key Features

- **Subject-focused organization** - Find papers by subject name
- **Batch download capability** - Get multiple papers at once
- **Mobile-friendly interface** - Access on any device
- **Fast loading** with client-side caching
- **Advanced filtering** by year and exam type
- **Intelligent subject classification** with fuzzy matching
- **Free access** - No login required

## 📚 Quick Start

Visit [mitaoe-pyqs.vercel.app](https://mitaoe-pyqs.vercel.app) and:

1. Search by subject name (e.g., "Computer Networks")
2. Apply filters for specific years/exam types (optional)
3. Download individual papers or select multiple for batch download

## 🎓 Supported Departments

- 💻 Computer Engineering
- 🧪 Chemical Engineering
- ⚙️ Mechanical Engineering
- 🏗️ Civil Engineering
- ⚡ Electrical Engineering
- 📡 Electronics & Telecommunication
- ➕ and more.

## 💻 For Developers

Built with Next.js 16, React 19, TypeScript and Tailwind CSS, deployed on Vercel. Catalog data lives in MongoDB and the papers in Cloudflare R2 behind the worker in [`worker/`](worker/README.md).

- [CONTRIBUTING.md](CONTRIBUTING.md): local setup, checks, generating paper data, pull requests
- [AGENTS.md](AGENTS.md): how the app is put together, where code lives, free-tier rules

## Acknowledgements

We extend our sincere gratitude to:

- **MIT Academy of Engineering** for their educational resources that make this project possible
- **Our dedicated contributors** whose passion and expertise continue to enhance this platform
- **The open source community** for providing the remarkable tools that power this application
- **MITAoE students** whose feedback and suggestions help us improve continuously

This project stands as a testament to collaborative efforts in making educational resources more accessible.

## Legal Notice

All question paper PDFs are sourced from MITAoE and stored in Cloudflare R2 cloud storage. This project is maintained by students for educational purposes.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
