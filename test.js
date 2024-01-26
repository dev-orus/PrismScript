const { runTests } = require('vscode-test');
const path = require('path');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');

  await runTests({ 
    extensionDevelopmentPath, 
    extensionTestsPath,
    launchArgs: [path.resolve(__dirname, '../Oisas')]
  });
}

main();
