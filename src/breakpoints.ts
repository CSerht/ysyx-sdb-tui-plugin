import * as vscode from 'vscode';
import { parseBreakpointByGdb } from './gdb-parser';
import { Server } from "socket.io";	


let ioReference: Server | undefined;
/**
 * 
 * @param io socket.io server, started in extension.ts
 */
export function registerSocketIO(io: Server | undefined)
{
    ioReference = io;
    console.log('register io', ioReference);
}

/**
 * Clear all breakpoints when the client is connected.
 * Call it before calling `listenAndOperateBreakpoints`.
 */
export function clearAllBreakpoints() {
    vscode.debug.breakpoints.forEach(bp => {
        vscode.debug.removeBreakpoints([bp]);
    });
}

/**
 * Listen to breakpoint changes in vscode after
 * the client is connected.
 */
export function listenAndOperateBreakpoints() {
    vscode.debug.onDidChangeBreakpoints((event) => {
        event.added.forEach((bp) => {
            if (bp instanceof vscode.SourceBreakpoint) {
                const filePath = bp.location.uri.fsPath;
                // gdb starts from 1, vscode starts from 0
                const line = bp.location.range.start.line + 1;
                console.log('Breakpoint added:', filePath, line);
                
                // if (!addClientBreakpoint(filePath, line)) {
                    // console.log('Failed to add breakpoint, removing it');
                    // vscode.debug.removeBreakpoints([bp]);
                // }
                /**
                 * 这里需要强调理解【异步编程】
                 * 1. 使用 async 声明的函数`add`，是异步函数，如果函数`function sub`调用该函数，
                 * 可以使用 add().then() ，这样可以在等待函数`add`执行完成之后，再操作`add`的返回结果，
                 * 但是，对于`sub`函数来说，如果`then();`之后还有`console.log('1')`，【它会立即执行】，
                 * 它不等待`add().then()`执行完成，这个时候，`add().then()`是依次执行，但是它们整体，
                 * 和`console.log`是【异步的】，也就是【不是顺序执行】，而可能是【轮转执行】什么的，
                 * 它是单线程的，通过事件循环和异步编程模型来实现非阻塞行为。
                 * 
                 * 2. 如果是 async function sub，使用 await add() ，那么后面的`console.log`会被阻塞，
                 * 这个时候，就是【顺序】执行了，并且`sub`被声明为了一个异步函数
                 */
                /** 这里就是一个异步操作，不会等待then执行完，后面的会继续执行，
                 * 这样也好，对于【检测打断点是否成功】来说，这样性能更好 
                 */
                addClientBreakpoint(filePath, line).then((success) => {
                    if (!success) {
                        console.log('Failed to add breakpoint, removing it');
                        vscode.debug.removeBreakpoints([bp]);
                    }
                });
            }
        });

        event.removed.forEach((removed) => {
            console.log('Breakpoint removed:', removed);
        });

        // event.changed.forEach((changed) => {
        // 	console.log('Breakpoint changed:', changed);
        // });

        // console.log('Breakpoints currently set:');
        // vscode.debug.breakpoints.forEach((breakpoint) => {
        //     if (breakpoint instanceof vscode.SourceBreakpoint) {
        //         console.log('Breakpoint********:',
        //             breakpoint.location.uri.fsPath,
        //             breakpoint.location.range.start.line + 1);
        //     }
        // });
	});
}

/**
 * 
 * @param filePath 
 * @param line 
 * @returns return true if the line has debugging information,
 *          otherwise return false and remove the breakpoint.
 */
async function addClientBreakpoint(filePath: string, line: number) {
    
    let pc: string | null = await parseBreakpointByGdb(filePath, line);

    if (pc == null) {
        console.log('Failed to parse breakpoint');
        return false;
    }

    /* Send 'pc' to client */
    addClientBreakpointByPc(pc);
    console.log(`breakpoint pc is 0x${pc}`);
    return true;
}

function addClientBreakpointByPc(pc: string) {
    ioReference?.emit("message", `breakpoint ${pc}`);
    console.log(`Send message to client, breakpoint pc is 0x${pc}`);
}