const path = require('node:path');
module.exports = { output:'export', distDir:(process.env.PIPFORGE_BUILD || process.argv.includes('build')) ? '.next-build' : '.next', trailingSlash:true, basePath:'/apps/rise-fall', images:{unoptimized:true}, transpilePackages:['@deriv/core'], turbopack:{root:path.resolve(__dirname,'../..')} };
