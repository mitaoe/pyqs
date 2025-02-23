import Link from 'next/link';
import Layout from '@/components/layout/Layout';

export default function HomePage() {
  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-16rem)] flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          MITAOE Question Papers
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Access previous year question papers from MITAOE. 
          Search by year, branch, or subject to find exactly what you need.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/papers"
            className="rounded-md bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            Browse Papers
          </Link>
          <Link
            href="/about"
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            Learn more <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
