import { Suspense } from 'react';
import Layout from '@/components/layout/Layout';
import SearchContentClient from '@/components/papers/SearchContentClient';
import { generateMetadata } from './generateMetadata';

export { generateMetadata };

function SearchLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-primary">
      <div className="text-content/60">Loading subjects...</div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Layout>
      <Suspense fallback={<SearchLoadingFallback />}>
        <SearchContentClient />
      </Suspense>
    </Layout>
  );
}
