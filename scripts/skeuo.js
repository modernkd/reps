import fs from 'fs';
import path from 'path';

const stylesDir = path.join(process.cwd(), 'src/components/styles');
const files = fs.readdirSync(stylesDir).filter(f => f.endsWith('.module.css'));

files.forEach(file => {
  const filePath = path.join(stylesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace border on inputs, buttons, sliders
  content = content.replace(/border:\s*1px\s+solid\s+var\(--(ink-[0-9]+|surface-[0-9]+)\);/g, 'border: 1px solid transparent;');
  
  // Inject base skeuo shadow into primary, secondary, and standard buttons
  // Find rules for buttons:
  // We'll use a regex to find CSS blocks for .primary, .secondary, button, .panel, .item, .sliderField
  
  const rulesToMakeRaised = [
    /\.primary\s*\{/g,
    /\.secondary\s*\{/g,
    /\.panel\s*\{/g,
    /\.item\s*\{/g,
    /\.actions\s+button\s*\{/g,
    /\.monthButton\s*\{/g,
    /\.optionButton\s*\{/g,
    /\.referenceImageButton\s*\{/g,
    /\.uploadButton\s*\{/g,
    /\.detailImageButton\s*\{/g
  ];

  rulesToMakeRaised.forEach(regex => {
    content = content.replace(regex, (match) => {
      return match + '\n  box-shadow: var(--shadow-skeuo-base);\n  border-color: transparent;';
    });
  });

  const rulesToMakeInner = [
    /input\s*\{/g,
    /select\s*\{/g,
    /textarea\s*\{/g,
    /\.sliderField\s*\{/g,
    /\.form\s+input,\s*\.form\s+select,\s*\.form\s+textarea\s*\{/g
  ];

  rulesToMakeInner.forEach(regex => {
    content = content.replace(regex, (match) => {
      return match + '\n  box-shadow: var(--shadow-skeuo-inner);\n  border-color: transparent;\n  background: var(--surface-1);';
    });
  });

  // Active states for buttons
  const buttonActiveRules = [
    /\.primary:active\s*\{/g,
    /\.secondary:active\s*\{/g,
    /\.actions\s+button:active\s*\{/g,
    /\.monthButton:active\s*\{/g
  ];
  
  // If active states don't exist, we should probably append them.
  // Actually, to be safe, let's just do a global append at the end of the file for the active states of standard classes found in that file.
  let appendActive = '';
  if (content.includes('.primary') && content.includes('.secondary')) {
    appendActive += '\n.primary:active, .secondary:active { box-shadow: var(--shadow-skeuo-inner); transform: translateY(1px); }\n';
  }
  if (content.includes('.actions button')) {
    appendActive += '\n.actions button:active { box-shadow: var(--shadow-skeuo-inner); transform: translateY(1px); }\n';
  }
  if (content.includes('.panel')) {
    // If it has a shadow-1 or shadow-2, replace it
    content = content.replace(/box-shadow:\s*var\(--shadow-[1-3]\);/g, ''); 
  }

  content += appendActive;
  
  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Successfully injected skeuomorphic styles into ' + files.length + ' CSS modules.');
