import Link from 'next/link';
import Layout from '@/components/layout/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center pt-32">
        <h1 className="text-6xl font-bold tracking-tighter text-white">
          PYQs
        </h1>
        <p className="mt-2 text-lg text-content/80">
          MITAOE Question Papers
        </p>
        <div className="mt-16 flex items-center gap-6">
          <Link
            href="/browse"
            className="group rounded-lg border border-accent bg-secondary px-6 py-2.5 text-sm font-medium"
          >
            <span className="bg-gradient-to-r from-content to-white bg-clip-text text-transparent transition-all group-hover:text-white">
              Browse Directory
            </span>
          </Link>
          <Link
            href="/papers"
            className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-content"
          >
            Search Papers
          </Link>
        </div>
      </div>
    </Layout>
  );
}
