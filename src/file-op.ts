import * as vscode from 'vscode';
import fs, { copyFileSync } from 'fs'
import {
    getFilePathFromAddress,
    getSrcHighLightLineNumber,
} from "./gdb-parser"; // no '.js' suffix 

let disassemblyFilePath: string; // for open disas file and highlight
let elfFilePath: string; // compile with -ggdb, for gdb parser


let disassemblyHighlight: vscode.TextEditorDecorationType | undefined;
let sourceFileHighlight: vscode.TextEditorDecorationType | undefined;

export function setDisassemblyFilePath(path: string) {
    disassemblyFilePath = vscode.Uri.file(path).fsPath;
}

export function setElfFilePath(path: string) {
    elfFilePath = vscode.Uri.file(path).fsPath;
}

/**
 * 
 * @param path the absolute path of the file
 * @param address the address of pc
 * 
 * Note: 打开文件是异步的，需要使用`then`来保证顺序性
 */
export function focusFileAndHighlightDisassembly(address: string) {
    // For compatibility, Windows, Linux ...
    const targetPath = disassemblyFilePath; //vscode.Uri.file(path).fsPath;

    if (!fs.existsSync(targetPath)) {
        console.log(targetPath + " don't exist");
        return;
    }

    // check if the file is visible
    const targetEditor = vscode.window.visibleTextEditors.find((editor) => {
        editor.document.uri.fsPath === targetPath
    });

    if (targetEditor) {
        // the file is open and focus on it
        vscode.window.showTextDocument(targetEditor.document, {
            preview: false,
            preserveFocus: true, // 高亮不需要聚焦，只需要获取到活动的编辑器
            viewColumn: vscode.ViewColumn.Two,
        }).then((editor) => {
            highlightDisassembly(editor, address);
        }).then(() => vscode.window.activeTerminal?.show());
        console.log("File focus on");

    } else {
        // open the file focus on it
        vscode.workspace.openTextDocument(targetPath).then((doc) => {
            vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.Two, // 在group 2打开文件，如果没有该group，打开个新的
            }).then((editor) => {
                highlightDisassembly(editor, address);
            });
        }).then(() => vscode.window.activeTerminal?.show());
        console.log("File opened: ", targetPath);
    }

}



/**
 * Highlight the specific address in the focused on file.
 * @param editor the current active editor
 * @param address the address of pc ,such as '80000000'
 */
function highlightDisassembly(editor: vscode.TextEditor, address: string) {
    // // 获取当前编辑器
    // let editor = vscode.window.activeTextEditor;
    // if (!editor) {
    //     console.log('没有打开的编辑器');
    //     return; // 没有打开的编辑器
    // }


    const document = editor.document
    if (!document) {
        console.log('no document');
        return;
    }
    const searchText = address + ':'
    // const lineNum = (document?.lineCount) ? document?.lineCount : 0
    const lineNum = document?.lineCount || 0;
    // const regex = /8[a-fA-F0-9]+:/;

    // const s = document?.getText()
    // console.log(s)

    let isExist = false;
    let highlightLine = 0;
    for (let i = 0; i < lineNum; i++) {
        const lineText = document?.lineAt(i).text
        if (lineText?.search(searchText) != -1) {
            console.log('line: ' + (i + 1));
            isExist = true;
            highlightLine = i; // start from 0
        }
    }

    if (!isExist) {
        console.log(searchText + ' search failed')
        return;
    }

    /* Highlight line */

    // 清除之前的装饰
    disassemblyHighlight?.dispose();

    // 创建一个新的范围（Range），用于高亮
    let range = editor.document.lineAt(highlightLine).range;

    // 创建装饰类型，这里设置背景色为 blue
    disassemblyHighlight = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(57, 155, 237, 0.4)'
    });

    // 应用装饰类型到编辑器
    editor.setDecorations(disassemblyHighlight, [range]);

    // jump to line and make it middle
    editor.selection = new vscode.Selection(highlightLine, 0, highlightLine, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter); // show in center

    console.log('高亮行号：', highlightLine);
}


/**
 * 
 * @param address the pc address
 * @param name  the name of function based on address,
 *              provided by NEMU
 */
export async function focusFileAndHighlightSourceFile(address: string) {
    /* get highlight infomation */
    const highlightTarget = await getFilePathAndHighlightLine(address);
    
    const filePath = highlightTarget[0];
    const line = highlightTarget[1];

    console.log('++++++++filePath: ', filePath);
    console.log('++++++++line: ', line);
    if(filePath == null || line == -1) {
        return;
    }

    /* get editor */
    const targetPath = vscode.Uri.file(filePath).fsPath;
    console.log('Source file targetPath: ', targetPath);
    
    const targetEditor = vscode.window.visibleTextEditors.find((editor) => {
        editor.document.uri.fsPath === targetPath
    });

    if (targetEditor) {
        // the file is open and focus on it
        vscode.window.showTextDocument(targetEditor.document, {
            preview: true,
            preserveFocus: true, 
            viewColumn: vscode.ViewColumn.One,
        }).then((editor) => {
            highlightLine(editor, line);
        }).then(() => vscode.window.activeTerminal?.show());
        console.log("File focus on");

    } else {
        // open the file focus on it
        vscode.workspace.openTextDocument(targetPath).then((doc) => {
            vscode.window.showTextDocument(doc, {
                preview: false,
                preserveFocus: true, // 高亮不需要聚焦，只需要获取到活动的编辑器
                viewColumn: vscode.ViewColumn.One,
            }).then((editor) => {
                highlightLine(editor, line);
            });
        }).then(() => vscode.window.activeTerminal?.show());
        console.log("File opened: ", targetPath);
    }
}

function getFilePathAndHighlightLine(address: string): Promise<[string | null, number]> {
    return new Promise((resolve) => {
        /* get the file path of the function (gdb info functions name) */
        let file: string | null;
        let line: number;
        getFilePathFromAddress(elfFilePath, address).then((filePath) => {
            file = filePath;
            if (filePath == null) {
                console.log('The function is not be traced');
                resolve([null, -1]);
            } else {
                console.log('filePath: ', filePath);

                /* get the number of line that will be highlighted (gdb disas /s name) */
                getSrcHighLightLineNumber(elfFilePath, address).then((lineNumber) => {
                    line = lineNumber;
                    if (lineNumber == -1) {
                        console.log('Clear the current highlight');
                        sourceFileHighlight?.dispose();
                        resolve([null, -1]);
                    } else {
                        console.log('hl lineNumber: ', lineNumber);
                        resolve([file, line]);
                    }
                }); 
            }
        });
    });
}


/**
 * 
 * @param editor 
 * @param line the line number that will be highlighted (start at 1 from GDB)
 *              so, we need to minus 1 before highlight in vscode is start at 0 
 */
function highlightLine(editor: vscode.TextEditor, line: number) {

    line = line - 1; // start from 0

    /* Highlight line */

    // 清除之前的装饰
    sourceFileHighlight?.dispose();

    // 创建一个新的范围（Range），用于高亮
    let range = editor.document.lineAt(line).range;

    // 创建装饰类型，这里设置背景色为 blue
    sourceFileHighlight = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(57, 155, 237, 0.4)'
    });

    // 应用装饰类型到编辑器
    editor.setDecorations(sourceFileHighlight, [range]);

    // jump to line and make it middle
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    console.log('高亮行号：', line);
}


/**
 * 检查给定路径的文件是否已在 VS Code 中打开且显示在前面。
 * @param {string} path absolute path
 * @return {boolean} true if the file is opened and displayed
 */
// export function isFileOpenAndVisible(path: string) {

//     // 将输入路径转换为绝对路径（如果需要）并标准化
//     // const targetPath = vscode.Uri.file(path).fsPath;

//     // 遍历所有当前可见的编辑器
//     // 指的是你可以看见的页面，如果多个窗口，都算，但是标签页打开但看不见内容的，不算
//     console.log('*********************************')
//     for (const editor of vscode.window.visibleTextEditors) {
//         // 获取编辑器中文档的文件系统路径
//         const documentPath = editor.document.uri.fsPath;

//         console.log(documentPath)

//         // 比较文档路径和目标路径
//         if (documentPath === path) {
//             // 找到了匹配，表示文件已被打开且可见
//             return true;
//         }
//     }
//     console.log('*********************************')

//     // 没有找到匹配的编辑器，表示文件未打开或不可见
//     return false;
// }