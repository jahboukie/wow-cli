#!/usr/bin/env node
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Use an async-friendly exec wrapper
function run(command) {
  return new Promise((resolve) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        // Don't crash the script, just log the error
        console.error(stderr);
        resolve(false);
        return;
      }
      console.log(stdout);
      resolve(true);
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

async function main() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  let hasLintScript = false;
  try {
    const pkgContent = await fs.readFile(packageJsonPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    if (pkg.scripts && pkg.scripts.lint) {
      hasLintScript = true;
    }
  } catch (e) {
    // Ignore errors if package.json is missing or invalid
  }

  if (hasLintScript) {
    console.log('Running `npm run lint`...');
    await run('npm run -s lint');
    return;
  }

  const eslintConfigs = [
    'eslint.config.js',
    'eslint.config.cjs',
    'eslint.config.mjs',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.mjs',
    '.eslintrc.json'
  ];

  let hasEslintConfig = false;
  for (const file of eslintConfigs) {
    try {
      await fs.access(path.join(process.cwd(), file));
      hasEslintConfig = true;
      break;
    } catch {
      // file doesn't exist
    }
  }

  if (hasEslintConfig) {
    console.log('ESLint config found, running `npx eslint . --fix`...');
    await run('npx -y eslint . --fix');
  } else {
    console.log('No lint script or ESLint config found. Skipping lint.');
  }
}

main();
