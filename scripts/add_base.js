const fs = require('fs');
const path = require('path');

const docs_dist_index_path = path.join(__dirname, '../docs-dist/index.html');

const indexContent = fs.readFileSync(docs_dist_index_path, 'utf8');

// 简易方案加入 <base href="/bizify/" />
const newIndexContent = indexContent
  .replace(
    '<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n    <base href="/bizify/" />`,
  )
  .replace(
    '<link rel="stylesheet" href="/umi',
    '<link rel="stylesheet" href="umi',
  )
  .replace('<script src="/umi', '<script src="umi');

fs.writeFileSync(docs_dist_index_path, newIndexContent, 'utf8');
