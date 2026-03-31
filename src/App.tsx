import { Suspense, lazy } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import AdminGuard from './pages/AdminGuard';
import HomePage from './pages/HomePage';

// Helper to auto-reload page on chunk load error (deployment update)
type LazyImport = Promise<{ default: ComponentType<object> }>;

const isChunkLoadError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Failed to fetch dynamically imported module')
    || error.message.includes('Importing a module script failed')
  );
};

const lazyWithRetry = (importFn: () => LazyImport) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error: unknown) {
      // If the error confirms a missing chunk (version mismatch), reload the page
      if (isChunkLoadError(error)) {
        window.location.reload();
      }
      throw error;
    }
  });
};

// Lazy load pages with retry
const PostPage = lazyWithRetry(() => import('./pages/PostPage'));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage'));

const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
    <LoadingSpinner message="페이지 불러오는 중..." />
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />
  },
  {
    path: '/posts/:slug',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PostPage />
      </Suspense>
    )
  },
  {
    path: '/p/:slug',
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <PostPage />
      </Suspense>
    )
  },
  {
    path: '/admin',
    element: (
      <AdminGuard>
        <Suspense fallback={<LoadingFallback />}>
          <AdminPage />
        </Suspense>
      </AdminGuard>
    )
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
