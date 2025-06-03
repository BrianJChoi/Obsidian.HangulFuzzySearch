const typescript = require('rollup-plugin-typescript2');

/** 퍼지 검색 플러그인용 Rollup 설정 */
module.exports = {
  input: 'src/main.ts',
  output: {
    file: 'main.js',
    format: 'cjs',        // Obsidian은 CommonJS 번들이 가장 호환성이 좋습니다
    exports: 'default',
    sourcemap: 'inline'
  },
  /* 런타임에 Obsidian이 제공하거나 CDN으로 불러올 라이브러리 */
  external: ['obsidian'],
  plugins: [
    typescript({
      typescript: require('typescript'),
      tsconfig: 'tsconfig.json'
    })
  ]
};