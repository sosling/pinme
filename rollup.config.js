const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const typescript = require('@rollup/plugin-typescript');
const { terser } = require('rollup-plugin-terser');
const copy = require('rollup-plugin-copy');
const path = require('path');
const fs = require('fs');

// 确保dist目录存在
const distDir = path.resolve(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}


module.exports = {
  input: 'bin/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    banner: '#!/usr/bin/env node',
    sourcemap: false,
  },
  // 将所有npm依赖项设为外部依赖，不打包进最终文件
  external: [
    ...Object.keys(require('./package.json').dependencies || {}),
    ...require('module').builtinModules,
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: false
    }),
    // 解析第三方模块
    nodeResolve({
      preferBuiltins: true,
    }),
    // 转换CommonJS模块为ES模块
    commonjs(),
    // 支持导入JSON文件
    json(),
    // 压缩代码
    terser({
      format: {
        comments: false,
      },
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    }),
    // 自定义插件：确保生成的文件有执行权限
    {
      name: 'make-executable',
      writeBundle() {
        const outputFile = path.resolve(__dirname, 'dist/index.js');
        try {
          fs.chmodSync(outputFile, '755');
          console.log('Added executable permissions to output file');
        } catch (error) {
          console.error('Failed to add executable permissions:', error);
        }
      }
    }
  ],
  onwarn(warning, warn) {
    // 忽略某些警告
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'UNRESOLVED_IMPORT' && warning.source.startsWith('node:')) return;
    warn(warning);
  }
};