import * as vscode from 'vscode';
import fs, { copyFileSync } from 'fs'
import {getFilePathAndLine} from "./gdb-parser"; // no '.js' suffix 
import { highlightColor } from './extension'
import {initGdbMiSession} from "./gdb-parser";

// const currentPath = require('path');

let disassemblyFilePath: string; // for open disas file and highlight
let elfFilePath: string; // compile with -ggdb, for gdb parser


// let disassemblyHighlight: vscode.TextEditorDecorationType | undefined;
// let sourceFileHighlight: vscode.TextEditorDecorationType | undefined;
let disassemblyHighlight = {current: undefined as vscode.TextEditorDecorationType | undefined};
let sourceFileHighlight = {current: undefined as vscode.TextEditorDecorationType | undefined};


export function setDisassemblyFilePath(path: string) {
    disassemblyFilePath = vscode.Uri.file(path).fsPath;
}

export async function setElfFilePath(path: string) {
    elfFilePath = vscode.Uri.file(path).fsPath;

    // start gdb session until it's finished
	await initGdbMiSession(elfFilePath);
}

/**
 * Concurrent execution of the following two functions:
 * 1. focusFileAndHighlightDisassembly
 * 2. focusFileAndHighlightSourceFile
 * 
 * @param addr the address of pc
 */
export async function highLightDisassemblyAndSrc(addr: string) {
    await Promise.all([
        focusFileAndHighlightDisassembly(addr),
        focusFileAndHighlightSourceFile(addr)
    ]);
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
        // console.log(targetPath + " don't exist");
        return;
    }

    // check if the file is visible
    const targetEditor = vscode.window.visibleTextEditors.find((editor) => {
        editor.document.uri.fsPath === targetPath
    });

    if (targetEditor) {
        // the file is open and focus on it
        vscode.window.showTextDocument(targetEditor.document, {
            preview: true,
            preserveFocus: true, // 高亮不需要聚焦，只需要获取到活动的编辑器
            viewColumn: vscode.ViewColumn.Two,
        }).then((editor) => {
            highlightDisassembly(editor, address);
        }).then(() => vscode.window.activeTerminal?.show());
        // console.log("File focus on");

    } else {
        // open the file focus on it
        vscode.workspace.openTextDocument(targetPath).then((doc) => {
            vscode.window.showTextDocument(doc, {
                preview: true,
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.Two, // 在group 2打开文件，如果没有该group，打开个新的
            }).then((editor) => {
                highlightDisassembly(editor, address);
            });
        }).then(() => vscode.window.activeTerminal?.show());
        // console.log("File opened: ", targetPath);
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
        // console.log('no document');
        return;
    }
    const searchText = address + ':'
    // const lineNum = (document?.lineCount) ? document?.lineCount : 0
    const lineNum = document?.lineCount || 0;

    let isExist = false;
    let line = 0;
    for (let i = 0; i < lineNum; i++) {
        const lineText = document?.lineAt(i).text
        if (lineText?.search(searchText) != -1) {
            // console.log('line: ' + (i + 1));
            isExist = true;
            line = i + 1; // start from 1 in vscode
        }
    }

    if (!isExist) {
        // console.log(searchText + ' search failed')
        return;
    }

    /* Highlight line */
    highlightLine(editor, line, disassemblyHighlight);
}


/**
 * 
 * @param address the pc address
 * @param name  the name of function based on address,
 *              provided by NEMU
 */
export async function focusFileAndHighlightSourceFile(address: string) {
    /* get highlight infomation */
    const highlightTarget = await getFilePathAndLine(elfFilePath, address);
    
    const filePath = highlightTarget[0];
    const line = highlightTarget[1];

    // console.log('filePath: ', filePath);
    // console.log('line: ', line);
    if(filePath == null || line == -1) {
        return;
    }

    /* get editor */
    const targetPath = vscode.Uri.file(filePath).fsPath;
    // console.log('Source file targetPath: ', targetPath);
    
    const targetEditor = vscode.window.visibleTextEditors.find((editor) => {
        editor.document.uri.fsPath === targetPath
    });

    if (targetEditor) {
        // the file is open and focus on it
        showTextAndHighlight(targetEditor.document, line);
        // console.log("File focus on");

    } else {
        // open the file focus on it
        vscode.workspace.openTextDocument(targetPath).then(
            (doc) => {showTextAndHighlight(doc, line);});
        // console.log("File opened: ", targetPath);
    }
}

let previousLine: number = -1;
function showTextAndHighlight(document: vscode.TextDocument, line: number) {
    vscode.window.showTextDocument(document, {
        preview: true,

        // // You don't need to focus on the editor, just need to get the active editor for highlight
        preserveFocus: true, 
        viewColumn: vscode.ViewColumn.One, // show the source file in the first group
    }).then((editor) => {
        // If the line is the same as the previous line, don't highlight it
        // if (line != previousLine) {
            highlightLine(editor, line, sourceFileHighlight);
            // previousLine = line;
        // }
    }).then(() => vscode.window.activeTerminal?.show());
}

/**
 * 
 * @param editor 
 * @param line the line number that will be highlighted (start at 1 from GDB)
 *              so, we need to minus 1 before highlight in vscode is start at 0 
 */
function highlightLine(editor: vscode.TextEditor, line: number,
    decorationSelector: { current: vscode.TextEditorDecorationType | undefined }) {

    line = line - 1; // start from 0 in vscode

    /* Highlight line */

    // clear previous decoration
    decorationSelector.current?.dispose();

    // create a new range for highlight
    let range = editor.document.lineAt(line).range;

    decorationSelector.current = vscode.window.createTextEditorDecorationType({
        // backgroundColor: 'rgba(57, 155, 237, 0.4)', // blue
        backgroundColor: `${highlightColor}`,
        isWholeLine: true,

        /* Set gutter icon */
        // currentPath: /home/../ysyx-sdb-tui-server/out/
        // gutterIconPath: currentPath.join(__dirname, '../src/decoration/arrow.png'), 
        // gutterIconSize: 'contain'
    });

    // console.log('icon path: ', currentPath.join(__dirname, 'image/icon.jpg'));

    // apply decoration to editor
    editor.setDecorations(decorationSelector.current, [range]);


    // jump to line and make it middle
    editor.selection = new vscode.Selection(line, 0, line, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

    // console.log('highlight line: ', line);
}
