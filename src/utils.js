const fs = require('fs');
const chalk = require('chalk');
const exec = require('child_process').exec;
const request = require('request');

function printWarning(text) {
    console.log('\n' + chalk.bold.yellow(text));
}

function printError(text) {
    console.log('\n' + chalk.bold.red(text) + chalk.magenta('\n\nIf the problem persists, please contact us at support@mobiscroll.com'));
    process.exit();
}

function printFeedback(text) {
    console.log('\n' + chalk.bold.cyan(text));
}

function runCommand(cmd, skipWarning, skipError) {
    console.log(`${chalk.green('>')} ${cmd}`);
    return new Promise((resolve, reject) => {
        exec(cmd, function (error, stdout, stderr) {
            if (stderr && !skipError && !skipWarning) {
                printWarning('There was an stderror during executing the following command ' + chalk.gray(cmd) + '. \n\nHere is the warning message: \n\n' + stderr);
            }
            if (error && !skipError) {
                //printError('Could not run command ' + chalk.gray(cmd) + '. \n\n' + error);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

function writeToFile(location, data) {
    fs.writeFile(location, data, function (err) {
        if (err) {
            printError('Could not write to file ' + chalk.gray(location) + '. \n\n' + err);
        }
    });
}

function importModule(moduleName, location, data, mobiscrollGlobal) {
    if (data.indexOf(moduleName) == -1) { // check if module is not loaded
        data = "import { " + moduleName + (mobiscrollGlobal ? ", mobiscroll" : '') + " } from '" + location + "';\n" + data;
        data = data.replace('imports: [', 'imports: [ \n' + '    ' + moduleName + ',');
    }
    return data;
}

module.exports = {
    run: runCommand,
    writeToFile: writeToFile,
    installMobiscroll: function (framework, userName, isTrial, callback) {
        var pkgName = (framework.indexOf('ionic') > -1 ? 'angular' : framework) + (isTrial ? '-trial' : ''),
            command;

        // TODO: modify the url before publishing !!!
        request('http://api.mobiscrollprod.com/api/getmobiscrollversion', function (error, response, body) {
            if (error) {
                printError(error);
            }

            if (!error && response.statusCode === 200) {
                body = JSON.parse(body);

                if (isTrial) {
                    command = `npm install https://npm.mobiscroll.com/@mobiscroll/${pkgName}/-/${pkgName}-${body.Version}.tgz --registry=https://npm.mobiscroll.com`;
                } else {
                    command = `npm install @mobiscroll/${pkgName}@latest --save`;
                }

                console.log('install command', command);

                // Skip node warnings
                printFeedback(`Installing packages via npm...`);
                runCommand(command, true).then(() => {
                    printFeedback(`Mobiscroll for ${framework} installed.`);
                    callback();
                }).catch((reason) => {
                    if (/403 Forbidden/.test(reason)) {
                        reason = `User ${userName} has no access to package @mobiscroll/${pkgName}.`;
                    }
                    printError('Could not install Mobiscroll.\n\n' + reason);
                });
            }
        });
    },
    importModules: function (currDir, jsFileName, apiKey) {
        console.log(`  Adding module loading scripts to ${chalk.grey('src/app/app.module.ts')}`);
        // Modify app.module.ts add necesarry modules
        fs.readFile(currDir + '/src/app/app.module.ts', 'utf8', function (err, data) {
            if (err) {
                printError('There was an error during reading app.module.ts. \n\nHere is the error message:\n\n' + err);
                return;
            }

            // Remove previous module load
            data = data.replace(/import \{ MbscModule(?:, mobiscroll)? \} from '[^']*';\s*/, '');
            data = data.replace(/[ \t]*MbscModule,[ \t\r]*\n/, '');

            // Add angular module imports which are needed for mobscroll
            data = importModule('MbscModule', jsFileName, data, apiKey);
            data = importModule('FormsModule', '@angular/forms', data);

            // Remove previous api key if present
            data = data.replace(/mobiscroll.apiKey = ['"][a-z0-9]{8}['"];\n\n?/, '');

            // Inject api key if trial
            if (apiKey) {
                data = data.replace('@NgModule', 'mobiscroll.apiKey = \'' + apiKey + '\';\n\n@NgModule');
            }

            writeToFile(currDir + '/src/app/app.module.ts', data);
        });
    },
    printFeedback: printFeedback,
    printWarning: printWarning,
    printError: printError
};