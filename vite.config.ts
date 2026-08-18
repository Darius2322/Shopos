import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ShopOS — Business Management',
        short_name: 'ShopOS',
        description: 'Offline-first POS and business management for small and medium retail businesses.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f6f2',
        theme_color: '#146b4a',
        lang: 'en',
        scope: '/',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkFirst',
            options: { cacheName: 'shopos-api-cache', networkTimeoutSeconds: 4 }
          }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
