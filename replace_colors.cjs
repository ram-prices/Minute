const fs = require('fs');
const path = require('path');

const files = [
  'src/index.css',
  'src/App.tsx',
  'src/components/PostCard.tsx',
  'src/components/PostDetail.tsx',
  'src/components/Sidebar.tsx',
  'src/components/UserProfile.tsx'
];

const replacements = [
  { from: /bg-\[\#030303\]/g, to: 'bg-bg-primary' },
  { from: /bg-\[\#1A1A1B\]/g, to: 'bg-bg-secondary' },
  { from: /bg-\[\#272729\]/g, to: 'bg-bg-tertiary' },
  { from: /text-\[\#D7DADC\]/g, to: 'text-text-primary' },
  { from: /text-\[\#818384\]/g, to: 'text-text-secondary' },
  { from: /border-white\/5/g, to: 'border-border-color' },
  { from: /border-white\/10/g, to: 'border-border-color' },
  { from: /hover:bg-white\/5/g, to: 'hover:bg-hover-bg' },
  { from: /bg-white\/5/g, to: 'bg-hover-bg' },
  { from: /hover:bg-white\/\[0\.02\]/g, to: 'hover:bg-hover-bg' },
  { from: /bg-white\/\[0\.02\]/g, to: 'bg-hover-bg' },
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
