'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import * as nodeDoc from 'node-documents-scripting';
import * as login from './login';
import * as commands from './commands';

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

    // Save login data
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.saveConfiguration', (param) => {
            commands.saveLoginData(loginData, param);
        })
    );

    // Upload script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.uploadScript', (param) => {
            commands.uploadScript(loginData, param);
        })
    );

    // Upload script on save
    if(vscode.workspace) {
        let disposableOnSave: vscode.Disposable;
        disposableOnSave = vscode.workspace.onDidSaveTextDocument((textDocument) => {
            commands.uploadScriptOnSave(loginData, textDocument);
        }, this);
        context.subscriptions.push(disposableOnSave);
    }

    // Upload all
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.uploadScriptsFromFolder', (param) => {
            commands.uploadAll(loginData, param);
        })
    );

    // Download script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScript', (param) => {
            commands.downloadScript(loginData, param);
        })
    );

    // Download all
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptsToFolder', (param) => {
            commands.downloadAll(loginData, param);
        })
    );

    // Run script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.runScript', (param) => {
            commands.runScript(loginData, param, myOutputChannel);
        })
    );

    // Compare script
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.compareScript', (param) => {
            commands.compareScript(loginData, param);
        })
    );

    // Download scriptnames
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptNames', (param) => {
            commands.downloadScriptnames(loginData, param);
        })
    );

    // Download script parameters
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.downloadScriptParameters', (param) => {
            commands.downloadScriptParameters(loginData, param);
        })
    );

    // todo...
    // View documentation
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.viewDocumentation', (file) => {
            // file is not used, use active editor...
            commands.viewDocumentation();
        })
    );

    // Check documents version
    nodeDoc.sdsSession(loginData, [], nodeDoc.getDocumentsVersion).then((value) => {
        let doc: nodeDoc.documentsT = value[0];
        if(Number(doc.version) < Number(REQUIRED_DOCUMENTS_VERSION)) {
            vscode.window.showInformationMessage(`It is recommended to use DOCUMENTS Build ${REQUIRED_DOCUMENTS_VERSION} you are using ${doc.version}`);
        }
    });

    vscode.window.setStatusBarMessage('vscode-documents-scripting is active');
}


/**
 * Is called on deactivation of the extension.
 */
export function deactivate() {
    console.log('The extension is deactivated');
}
