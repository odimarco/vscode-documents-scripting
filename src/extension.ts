'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as reduce from 'reduce-for-promises';
import * as tsc from 'typescript-compiler';
import * as nodeDoc from 'node-documents-scripting';
import * as winattr from 'winattr';
import * as login from './login';
import * as helpers from './helpers';


const open = require('open');
const urlExists = require('url-exists');


const REQUIRED_DOCUMENTS_VERSION = '8034';











export function activate(context: vscode.ExtensionContext) {

    let myOutputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('documents-scripting-channel');

    // login data...

    let launchjson;
    if(vscode.workspace) {
        launchjson = path.join(vscode.workspace.rootPath, '.vscode', 'launch.json');
    }
    let loginData: nodeDoc.LoginData = new nodeDoc.LoginData(launchjson);
    loginData.getLoginData = login.createLoginData;
    // object loginData should be deleted on deactivation
    context.subscriptions.push(loginData);


    // register commands...

    // Upload script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.uploadScript', (param) => {
            commandUploadScript(loginData, param);
        })
    );

    // Download script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScript', (param) => {
            commandDownloadScript(loginData, param);
        })
    );

    // Run script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.runScript', (param) => {
            commandRunScript(loginData, param, myOutputChannel);
        })
    );

    // Compare script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.compareScript', (param) => {
            commandCompareScript(loginData, param);
        })
    );

    // Upload all
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.uploadScriptsFromFolder', (param) => {
            commandUploadAll(loginData, param);
        })
    );

    // Download all
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptsToFolder', (param) => {
            commandDownloadAll(loginData, param);
        })
    );

    // Download scriptnames
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptNames', (param) => {
            commandDownloadScriptnames(loginData, param);
        })
    );

    // Download script parameters
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptParameters', (param) => {
            commandDownloadScriptParameters(loginData, param);
        })
    );

    // Save login data
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.saveConfiguration', (param) => {
            commandSaveLoginData(loginData, param);
        })
    );



    if(vscode.workspace) {
        // register event commands...

        // Upload script on save
        let disposableOnSave: vscode.Disposable;
        disposableOnSave = vscode.workspace.onDidSaveTextDocument((textDocument) => {
            commandUploadScriptOnSave(loginData, textDocument);
        }, this);
        context.subscriptions.push(disposableOnSave);
    }


    // Check documents version
    nodeDoc.sdsSession(loginData, [], nodeDoc.getDocumentsVersion).then((value) => {
        let doc: nodeDoc.documentsT = value[0];
        if(Number(doc.version) < Number(REQUIRED_DOCUMENTS_VERSION)) {
            vscode.window.showInformationMessage(`It is recommended to use DOCUMENTS Build ${REQUIRED_DOCUMENTS_VERSION} you are using ${doc.version}`);
        }
    });


    // todo...
    // View documentation
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.viewDocumentation', (file) => {
            // file is not used, use active editor...
            viewDocumentation();
        })
    );

    vscode.window.setStatusBarMessage('vscode-documents-scripting is active');
}


/**
 * Is called on deactivation of the extension.
 */
export function deactivate() {
    console.log('The extension is deactivated');
}




/* --------------------------------------------------
 *       Registered command functions.
 * -------------------------------------------------- */

/**
 * Execute command 'Upload Script'
 */
function commandUploadScript(loginData: nodeDoc.LoginData, param: any) {
    let _param;
    if (param) {
        _param = param._fsPath;
    }
    helpers.ensureScript(_param).then((_script) => {

        helpers.readEncryptStates([_script]);
        helpers.readHashValues([_script]);
        return nodeDoc.sdsSession(loginData, [_script], nodeDoc.uploadScript).then((value) => {

            // in case of conflict (server-script changed by someone else)
            // returned script contains local and server code
            // otherwise returned script == input script
            let script:nodeDoc.scriptT = value[0];

            // in case of conflict, ask if script should be force-uploaded
            helpers.ensureUploadScripts([script]).then(([noConflict, forceUpload]) => {

                // if forceUpload is empty function resolves anyway
                nodeDoc.sdsSession(loginData, forceUpload, nodeDoc.uploadScript).then(() => {

                    // if script had conflict and was not force-uploaded
                    // conflict is true in this script
                    if(true !== script.conflict) {
                        helpers.updateHashValues([script]);
                        helpers.updateEncryptStates([script]);
                        vscode.window.setStatusBarMessage('uploaded: ' + script.name);
                    }
                }).catch((reason) => {
                    vscode.window.showErrorMessage('force upload ' + script.name + ' failed: ' + reason);
                });
            }); // no reject in upload scripts
            
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('upload script failed: ' + reason);
    });
}

/**
 * Execute command 'Download Script'
 */
function commandDownloadScript(loginData: nodeDoc.LoginData, param: any) {
    let _param;
    if(param) {
        _param = param._fsPath;
    }

    helpers.ensureScriptName(_param).then((scriptname) => {
        return helpers.ensurePath(_param, true).then((_path) => {
            let script: nodeDoc.scriptT = {name: scriptname, path: _path[0]};

            helpers.readConflictModes([script]);
            return nodeDoc.sdsSession(loginData, [script], nodeDoc.downloadScript).then((value) => {
                script = value[0];
                helpers.updateEncryptStates([script]);
                helpers.updateHashValues([script]);
                vscode.window.setStatusBarMessage('downloaded: ' + script.name);
            });
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('download script failed: ' + reason);
    });
}

/**
 * Execute command 'Run Script'
 */
function commandRunScript(loginData: nodeDoc.LoginData, param: any, myOutputChannel) {
    let _param;
    if(param) {
        _param = param._fsPath;
    }

    helpers.ensureScriptName(_param).then((scriptname) => {
        let script: nodeDoc.scriptT = {name: scriptname};
        return nodeDoc.sdsSession(loginData, [script], nodeDoc.runScript).then((value) => {
            script = value[0];
            myOutputChannel.append(script.output + os.EOL);
            myOutputChannel.show();
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('run script failed: ' + reason);
    });
}

/**
 * Execute command 'Compare Script'
 */
function commandCompareScript(loginData: nodeDoc.LoginData, param: any) {
    let _param;
    if(param) {
        _param = param._fsPath;
    }

    helpers.ensurePath(_param, false, true).then((_path) => {
        let scriptfolder = _path[0];
        let _scriptname = _path[1];
        return helpers.ensureScriptName(_scriptname).then((scriptname) => {
            let comparepath;
            if(vscode.workspace) {
                comparepath = path.join(vscode.workspace.rootPath, helpers.COMPARE_FOLDER);
            } else {
                comparepath = path.join(scriptfolder, helpers.COMPARE_FOLDER);
            }
            return helpers.createFolder(comparepath, true).then(() => {
                let script: nodeDoc.scriptT = { name: scriptname, path: comparepath, rename: helpers.COMPARE_FILE_PREFIX + scriptname };
                return nodeDoc.sdsSession(loginData, [script], nodeDoc.downloadScript).then((value) => {
                    script = value[0];
                    helpers.compareScript(scriptfolder, scriptname);
                });
            });
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('Compare script failed: ' + reason);
    });
}

/**
 * Execute command 'Upload All Scripts'
 */
function commandUploadAll(loginData: nodeDoc.LoginData, param: any) {
    let _param;
    if(param) {
        _param = param._fsPath;
    }

    helpers.ensurePath(_param).then((folder) => {
        return nodeDoc.getScriptsFromFolder(folder[0]).then((folderscripts) => {

            helpers.readEncryptStates(folderscripts);
            helpers.readHashValues(folderscripts);
            return nodeDoc.sdsSession(loginData, folderscripts, nodeDoc.uploadAll).then((value) => {
                let retscripts: nodeDoc.scriptT[] = value;
                
                helpers.ensureUploadScripts(retscripts).then(([noConflict, forceUpload]) => {

                    // forceUpload might be empty, function resolves anyway
                    nodeDoc.sdsSession(loginData, forceUpload, nodeDoc.uploadAll).then((value) => {
                        let retscripts2: nodeDoc.scriptT[] = value;

                        // retscripts2 might be empty
                        let uploaded = noConflict.concat(retscripts2);

                        helpers.updateHashValues(uploaded);
                        helpers.updateEncryptStates(uploaded);

                        vscode.window.setStatusBarMessage('uploaded ' + uploaded.length + ' scripts from ' + folder[0]);
                    }).catch((reason) => {
                        vscode.window.showErrorMessage('force upload of conflict scripts failed: ' + reason);
                    });
                });
            });
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('upload all failed: ' + reason);
    });
}

/**
 * Execute command 'Download All Scripts'
 */
function commandDownloadAll(loginData: nodeDoc.LoginData, param: any) {
    let _param;
    if(param) {
        _param = param._fsPath;
    }

    helpers.ensurePath(_param, true).then((_path) => {

        // get names of scripts that should be downloaded
        return helpers.getDownloadScriptNames(loginData).then((_scripts) => {

            // set download path to scripts
            _scripts.forEach(function(script) {
                script.path = _path[0];
            });

            helpers.readConflictModes(_scripts);

            // download scripts
            return nodeDoc.sdsSession(loginData, _scripts, nodeDoc.dwonloadAll).then((scripts) => {
                let numscripts = scripts.length;
                helpers.updateEncryptStates(scripts);
                helpers.updateHashValues(scripts);
                vscode.window.setStatusBarMessage('downloaded ' + numscripts + ' scripts');
            });
        });
    }).catch((reason) => {
        vscode.window.showErrorMessage('download all failed: ' + reason);
    });
}

/**
 * Execute command 'Download Scriptnames'
 */
function commandDownloadScriptnames(loginData: nodeDoc.LoginData, param: any) {
    nodeDoc.sdsSession(loginData, [], nodeDoc.getScriptNamesFromServer).then((_scripts) => {
        helpers.setServerScripts(_scripts);
        vscode.window.setStatusBarMessage('saved ' + _scripts.length + ' scriptnames to settings.json');
    }).catch((reason) => {
        vscode.window.showErrorMessage('download scriptnames failed: ' + reason);
    });
}

/**
 * Execute command 'Download Script Parameters'
 */
function commandDownloadScriptParameters(loginData: nodeDoc.LoginData, param: any) {
    console.log('commandDownloadScriptParameters');
    nodeDoc.sdsSession(loginData, [], nodeDoc.getScriptParameters).then((value) => {
        if(1 < value.length) {
            let scriptparams = value[1];
            console.log('script parameters: ' + scriptparams);
            vscode.window.setStatusBarMessage('Script parameters downloaded');
        } else {
            console.log('download script parameters failed: array.length: ' + value.length);
        }
    }).catch((reason) => {
        vscode.window.showErrorMessage('download script parameters failed: ' + reason);
    });
}



/**
 * Execute command 'Save Login Data'
 */
function commandSaveLoginData(loginData: nodeDoc.LoginData, param: any) {
    if(loginData) {
        login.createLoginData(loginData).then(() => {
            vscode.window.setStatusBarMessage('Saved login data');
        }).catch((reason) => {
            vscode.window.showWarningMessage(reason);
        });
    } else {
        vscode.window.showErrorMessage('unexpected error: login data object missing');
    }
}

/**
 * Execute command 'Upload Script' on event 'Save'
 */
function commandUploadScriptOnSave(loginData: nodeDoc.LoginData, textDocument: vscode.TextDocument) {
    if('.js' === path.extname(textDocument.fileName)) {

        helpers.ensureUploadOnSave(textDocument.fileName).then((value) => {
            if(value) {
                return helpers.ensureScript(textDocument.fileName).then((_script) => {
                    helpers.readEncryptStates([_script]);
                    return nodeDoc.sdsSession(loginData, [_script], nodeDoc.uploadScript).then((value) => {
                        let script = value[0];
                        vscode.window.setStatusBarMessage('uploaded: ' + script.name);
                    });
                });
            }
        }).catch((reason) => {
            vscode.window.showErrorMessage('upload script failed: ' + reason);
        });
    }
}







/* --------------------------------------------------
 *       Some more helper functions.
 * -------------------------------------------------- */













/* --------------------------------------------------
 *       todo...
 * -------------------------------------------------- */



function viewDocumentation() {
    let portalscriptdocu = 'http://doku.otris.de/api/portalscript/';
    urlExists(portalscriptdocu, function(err, exists) {
        if(!exists) {
            vscode.window.showInformationMessage('Documentation is not available!');
        } else {

            // current editor
            const editor = vscode.window.activeTextEditor;
            if(!editor || !vscode.workspace.rootPath) {
                return;
            }

            // skip import lines
            var cnt = 0;
            var currline:string = editor.document.lineAt(cnt).text;
            while(currline.startsWith('import')) {
                cnt ++;
                currline = editor.document.lineAt(cnt).text;
            }

            // first line after import should look like "export class Context {"
            var _words = currline.split(' ');
            if(_words.length != 4 || _words[0] !== 'export' || _words[1] !== 'class' || _words[3] != '{') {
                return;
            }


            var classname = _words[2];

            // the Position object gives you the line and character where the cursor is
            const pos = editor.selection.active;
            if(!pos) {
                return;
            }
            const line = editor.document.lineAt(pos.line).text;
            const words = line.split(' ');
            var member = '';

            if(words[0].trim() === 'public') {
                member = words[1].trim();
                var brace = member.indexOf('(');
                if(brace >= 0) {
                    member = member.substr(0, brace);
                }
            }

            const jsFileName = 'class' + classname + '.js';
            const htmlFileName = 'class' + classname + '.html';
            const jsFilePath = path.join(vscode.workspace.rootPath, 'mapping', jsFileName);

            fs.readFile(jsFilePath, (err, data) => {

                var browser = 'firefox';
                if(err || !data) {
                    var page = portalscriptdocu + htmlFileName;
                    open(page, browser);

                } else {
                    // \r was missing in the generated files
                    var lines = data.toString().split("\n");

                    for(var i=2; i<lines.length-1; i++) {
                        var entries = lines[i].split(',');
                        if(entries.length < 2) {
                            continue;
                        }
                        // entries[0] looks like: "     [ "clientId""
                        var entry = entries[0].replace('[','').replace(/"/g,'').trim();

                        if(entry === member) {
                            // entries[1] looks like: "  "classContext.html#a6d644a063ace489a2893165bb3856579""
                            var link = entries[1].replace(/"/g,'').trim();
                            var page = portalscriptdocu + link;
                            open(page, browser);
                            break;
                        }
                    }
                    if(i === lines.length-1) {
                        var page = portalscriptdocu + htmlFileName;
                        open(page, browser);
                    }
                }
            });
        }
    });
}





// rename to getJSFromTS
// async function uploadJSFromTS(sdsConnection: SDSConnection, textDocument: vscode.TextDocument): Promise<void> {
//     return new Promise<void>((resolve, reject) => {

//         if(!textDocument || '.ts' !== path.extname(textDocument.fileName)) {
//             reject('No active ts script');

//         } else {
//             let shortName = '';
//             let scriptSource = '';

//             shortName = path.basename(textDocument.fileName, '.ts');
//             let tsname:string = textDocument.fileName;
//             let jsname:string = tsname.substr(0, tsname.length - 3) + ".js";
//             //let tscargs = ['--module', 'commonjs', '-t', 'ES6'];
//             let tscargs = ['-t', 'ES5', '--out', jsname];
//             let retval = tsc.compile([textDocument.fileName], tscargs, null, function(e) { console.log(e); });
//             scriptSource = retval.sources[jsname];
//             console.log("scriptSource: " + scriptSource);
        
//             sdsAccess.uploadScript(sdsConnection, shortName, scriptSource).then((value) => {
//                 vscode.window.setStatusBarMessage('uploaded: ' + shortName);
//                 resolve();
//             }).catch((reason) => {
//                 reject(reason);
//             });
//         }
//     });
// }
