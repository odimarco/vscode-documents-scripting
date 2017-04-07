﻿import * as fs from 'fs';
const stripJsonComments = require('strip-json-comments');



export class LoginData {

    public server: string = '';
    public port: number = 0;
    public principal: string = '';
    public username: string = '';
    public password: string = '';
    public launchjson;
    public getLoginData: (loginData: LoginData) => Promise<void>;

    constructor (_launchjson?: string) {
        if(_launchjson) {
            this.launchjson = _launchjson;
        }
    }


    public checkLoginData(): boolean {
        console.log('checkLoginData');
        if('' === this.server || 0  === this.port || '' === this.principal || '' === this.username) {
            return false;
        }
        return true;
    }

    public loadLaunchJson() : boolean {
        console.log('loadLaunchJson');
        if(!this.launchjson) {
            return false;
        }
        try {
            const jsonContent = fs.readFileSync(this.launchjson, 'utf8');
            const jsonObject = JSON.parse(stripJsonComments(jsonContent));
            const configurations = jsonObject.configurations;

            if(configurations) {
                configurations.forEach((config: any) => {
                    if (config.request == 'launch') {
                        this.server = config.host;
                        this.port = config.applicationPort;
                        this.principal = config.principal;
                        this.username = config.username;
                        this.password = config.password;
                    }
                });
            }
        } catch (err) {
            return false;
        }

        return true;
    }

    async ensureLoginData(): Promise<void> {
        console.log('ensureLoginData');
        return new Promise<void>((resolve, reject) => {
        
            this.loadLaunchJson();
            if(this.checkLoginData()) {
                resolve();
            } else if(this.getLoginData) {
                this.getLoginData(this).then(() => {
                    resolve();
                }).catch((reason) => {
                    reject(reason);
                });
            } else {
                reject();
            }
        });
    }


    dispose() {
        //
    }

}
