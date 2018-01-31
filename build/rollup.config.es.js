import base from './rollup.config.base';
var o = Object.assign(base('es'), {
    output: {
      format: 'es',
      file: 'lib/index.mjs',
    },
  });
export default o; 