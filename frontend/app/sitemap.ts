import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://workforce-platform.vercel.app';
  const routes = [
    '',
    '/login',
    '/dashboard',
    '/projects',
    '/tasks',
    '/matching',
    '/workload',
    '/insights',
    '/reports',
    '/presentation',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' || route === '/dashboard' ? 1.0 : 0.8,
  }));
}
