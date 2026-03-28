import { defineConfig } from 'vite';
//import babel from 'vite-plugin-babel';
//import tsDecorators from 'vite-plugin-ts-decorators';
import ts from 'vite-plugin-ts';

export default defineConfig({
  plugins: [ts()]
});

// export default defineConfig({
//   plugins: [//babel(),
//     // tsDecorators({
//     //     // Ensure TypeScript processes metadata for decorators
//     //     emitDecoratorMetadata: true,
//     // }),
//   ],
//   optimizeDeps: {
//     esbuildOptions: {
//       tsconfig: './tsconfig.json'
//     }
//   },
// });
