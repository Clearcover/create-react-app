/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const spawnSync = require('cross-spawn').sync;
const chalk = require('chalk');
const paths = require('../config/paths');
const createJestConfig = require('./utils/createJestConfig');
const inquirer = require('react-dev-utils/inquirer');

const green = chalk.green;
const cyan = chalk.cyan;

function getGitStatus() {
  try {
    let stdout = execSync(`git status --porcelain`, {
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    return stdout.trim();
  } catch (e) {
    return '';
  }
}

inquirer
  .prompt({
    type: 'confirm',
    name: 'shouldEject',
    message: 'Are you sure you want to eject? This action is permanent.',
    default: false,
  })
  .then(answer => {
    if (!answer.shouldEject) {
      console.log(cyan('Close one! Eject aborted.'));
      return;
    }

    const gitStatus = getGitStatus();
    if (gitStatus) {
      console.error(
        chalk.red(
          `This git repository has untracked files or uncommitted changes:\n\n` +
            gitStatus.split('\n').map(line => '  ' + line) +
            '\n\n' +
            'Remove untracked files, stash or commit any changes, and try again.'
        )
      );
      process.exit(1);
    }
  }

  var folders = [
    'config',
    path.join('config', 'jest'),
    'scripts'
  ];

  var files = [
    path.join('config', 'env.js'),
    path.join('config', 'paths.js'),
    path.join('config', 'polyfills.js'),
    path.join('config', 'webpack.config.dev.js'),
    path.join('config', 'webpack.config.prod.js'),
    path.join('config', 'jest', 'cssTransform.js'),
    path.join('config', 'jest', 'fileTransform.js'),
    path.join('scripts', 'build.js'),
    path.join('scripts', 'start.js'),
    path.join('scripts', 'test.js')
  ];

  // Ensure that the app folder is clean and we won't override any files
  folders.forEach(verifyAbsent);
  files.forEach(verifyAbsent);

  // Copy the files over
  folders.forEach(function(folder) {
    fs.mkdirSync(path.join(appPath, folder))
  });

  console.log();
  console.log(cyan('Copying files into ' + appPath));
  files.forEach(function(file) {
    console.log('  Adding ' + cyan(file) + ' to the project');
    var content = fs
      .readFileSync(path.join(ownPath, file), 'utf8')
      // Remove dead code from .js files on eject
      .replace(/\/\/ @remove-on-eject-begin([\s\S]*?)\/\/ @remove-on-eject-end/mg, '')
      // Remove dead code from .applescript files on eject
      .replace(/-- @remove-on-eject-begin([\s\S]*?)-- @remove-on-eject-end/mg, '')
      .trim() + '\n';
    fs.writeFileSync(path.join(appPath, file), content);
  });
  console.log();

  var ownPackage = require(path.join(ownPath, 'package.json'));
  var appPackage = require(path.join(appPath, 'package.json'));
  var babelConfig = JSON.parse(fs.readFileSync(path.join(ownPath, 'babelrc'), 'utf8'));
  var eslintConfig = JSON.parse(fs.readFileSync(path.join(ownPath, 'eslintrc'), 'utf8'));

  console.log(cyan('Updating the dependencies'));
  var ownPackageName = ownPackage.name;
  if (appPackage.devDependencies[ownPackageName]) {
    console.log('  Removing ' + cyan(ownPackageName) + ' from devDependencies');
    delete appPackage.devDependencies[ownPackageName];
  }
  if (appPackage.dependencies[ownPackageName]) {
    console.log('  Removing ' + cyan(ownPackageName) + ' from dependencies');
    delete appPackage.dependencies[ownPackageName];
  }

  Object.keys(ownPackage.dependencies).forEach(function (key) {
    // For some reason optionalDependencies end up in dependencies after install
    if (ownPackage.optionalDependencies[key]) {
      return;
    }

    const folders = ['config', 'config/jest', 'scripts'];

    // Make shallow array of files paths
    const files = folders.reduce(
      (files, folder) => {
        return files.concat(
          fs
            .readdirSync(path.join(ownPath, folder))
            // set full path
            .map(file => path.join(ownPath, folder, file))
            // omit dirs from file list
            .filter(file => fs.lstatSync(file).isFile())
        );
      },
      []
    );

    // Ensure that the app folder is clean and we won't override any files
    folders.forEach(verifyAbsent);
    files.forEach(verifyAbsent);

    // Prepare Jest config early in case it throws
    const jestConfig = createJestConfig(
      filePath => path.posix.join('<rootDir>', filePath),
      null,
      true
    );

    console.log();
    console.log(cyan(`Copying files into ${appPath}`));

    folders.forEach(folder => {
      fs.mkdirSync(path.join(appPath, folder));
    });

    files.forEach(file => {
      let content = fs.readFileSync(file, 'utf8');

      // Skip flagged files
      if (content.match(/\/\/ @remove-file-on-eject/)) {
        return;
      }
      content = content
        // Remove dead code from .js files on eject
        .replace(
          /\/\/ @remove-on-eject-begin([\s\S]*?)\/\/ @remove-on-eject-end/mg,
          ''
        )
        // Remove dead code from .applescript files on eject
        .replace(
          /-- @remove-on-eject-begin([\s\S]*?)-- @remove-on-eject-end/mg,
          ''
        )
        .trim() + '\n';
      console.log(`  Adding ${cyan(file.replace(ownPath, ''))} to the project`);
      fs.writeFileSync(file.replace(ownPath, appPath), content);
    });
  });

  console.log();
  console.log(cyan('Configuring package.json'));
  // Add Jest config
  console.log('  Adding ' + cyan('Jest') + ' configuration');
  appPackage.jest = createJestConfig(
    filePath => path.posix.join('<rootDir>', filePath),
    null,
    true
  );

  // Add Babel config
  console.log('  Adding ' + cyan('Babel') + ' preset');
  appPackage.babel = babelConfig;

  // Add ESlint config
  console.log('  Adding ' + cyan('ESLint') +' configuration');
  appPackage.eslintConfig = eslintConfig;

  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.stringify(appPackage, null, 2) + '\n'
  );
  console.log();

  // "Don't destroy what isn't ours"
  if (ownPath.indexOf(appPath) === 0) {
    try {
      // remove react-scripts and react-scripts binaries from app node_modules
      Object.keys(ownPackage.bin).forEach(function(binKey) {
        fs.removeSync(path.join(appPath, 'node_modules', '.bin', binKey));
      });
      fs.removeSync(ownPath);
    } catch(e) {
      // It's not essential that this succeeds
    }
  }

  if (fs.existsSync(paths.yarnLockFile)) {
    console.log(cyan('Running yarn...'));
    spawnSync('yarnpkg', [], {stdio: 'inherit'});
  } else {
    console.log(cyan('Running npm install...'));
    spawnSync('npm', ['install'], {stdio: 'inherit'});
  }
  console.log(green('Ejected successfully!'));
  console.log();

  console.log(green('Please consider sharing why you ejected in this survey:'));
  console.log(green('  http://goo.gl/forms/Bi6CZjk1EqsdelXk1'));
  console.log()
})
