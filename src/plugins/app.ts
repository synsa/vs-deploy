/// <reference types="node" />

// The MIT License (MIT)
// 
// vs-deploy (https://github.com/mkloubert/vs-deploy)
// Copyright (c) Marcel Joachim Kloubert <marcel.kloubert@gmx.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import * as deploy_contracts from '../contracts';
import * as deploy_helpers from '../helpers';
import * as deploy_objects from '../objects';
const OPN = require('opn');
import * as Path from 'path';
import * as vscode from 'vscode';


interface DeployTargetApp extends deploy_contracts.DeployTarget {
    app?: string;
    arguments?: string[];
    separator?: string;
}

function createAppArgsList(file: string, app: string, args: string[]): string[] {
    file = deploy_helpers.toStringSafe(file);

    if (app) {
        if (!Path.isAbsolute(app)) {
            app = Path.join(vscode.workspace.rootPath, app);
        }
    }
    
    if (!args) {
        args = [];
    }

    args = args.map(x => {
                        x = deploy_helpers.toStringSafe(x);
                        x = deploy_helpers.replaceAllStrings(x, '${file}', file);

                        return x;
                    });

    return [ app ].concat(args)
                  .filter(x => x);
}

class AppPlugin extends deploy_objects.DeployPluginBase {
    constructor(ctx: deploy_contracts.DeployContext) {
        super(ctx);
    }

    public deployFile(file: string, target: DeployTargetApp, opts?: deploy_contracts.DeployFileOptions): void {
        if (!opts) {
            opts = {};
        }

        let me = this;

        let app = deploy_helpers.toStringSafe(target.app);

        let completed = (err?: any) => {
            if (opts.onCompleted) {
                opts.onCompleted(me, {
                    error: err,
                    file: file,
                    target: target,
                });
            }
        };

        try {
            if (opts.onBeforeDeploy) {
                opts.onBeforeDeploy(me, {
                    file: file,
                    target: target,
                });
            }

            OPN(file, {
                app: createAppArgsList(file, app, target.arguments),
                wait: true,
            }).then(() => {
                completed();
            });
        }
        catch (e) {
            completed(e);
        }
    }

    /** @inheritdoc */
    public deployWorkspace(files: string[], target: DeployTargetApp, opts?: deploy_contracts.DeployWorkspaceOptions) {
        let me = this;
        
        if (!opts) {
            opts = {};
        }

        let app = deploy_helpers.toStringSafe(target.app);

        let firstFile = files[0];
        let nextFiles = files.filter((x, i) => i > 0);

        let args = [];
        if (target.arguments) {
            args = args.concat(target.arguments);
        }
        args = args.concat(nextFiles)
                   .filter(x => x);

        let separator = deploy_helpers.toStringSafe(target.separator);
        if (!separator) {
            separator = ' ';
        }

        let completed = (err?: any) => {
            files.forEach(x => {
                let fileCompleted = (err?: any) => {
                    if (opts.onFileCompleted) {
                        opts.onFileCompleted(me, {
                            error: err,
                            file: x,
                            target: target,
                        });
                    }
                };
                
                try {
                    if (opts.onBeforeDeployFile) {
                        opts.onBeforeDeployFile(me, {
                            file: x,
                            target: target,
                        });
                    }

                    fileCompleted();
                }
                catch (e) {
                    fileCompleted(e);
                }
            });

            if (opts.onCompleted) {
                opts.onCompleted(me, {
                    error: err,
                });
            }
        };
        
        try {
            OPN(firstFile, {
                app: createAppArgsList(nextFiles.join(separator), app, args),
                wait: false,
            }).then(() => {
                completed();
            });
        }
        catch (e) {
            completed(e);
        }
    }
}

/**
 * Creates a new Plugin.
 * 
 * @param {deploy_contracts.DeployContext} ctx The deploy context.
 * 
 * @returns {deploy_contracts.DeployPlugin} The new instance.
 */
export function createPlugin(ctx: deploy_contracts.DeployContext): deploy_contracts.DeployPlugin {
    return new AppPlugin(ctx);
}
