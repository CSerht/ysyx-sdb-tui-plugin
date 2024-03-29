// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Server } from "socket.io";
import {
	focusFileAndHighlightDisassembly, setDisassemblyFilePath,
	focusFileAndHighlightSourceFile, setElfFilePath,
	highLightDisassemblyAndSrc,
} from "./file-op";

let io: Server | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ysyx-sdb-tui" is now active!');
	
	let disposable = vscode.commands.registerCommand('extension.ysyx-sdb-tui-Enable', () => {

		const config = vscode.workspace.getConfiguration('ysyxSdbTUI');
		const port = config.get('serverPort', 49159);
		if (!io) {
			io = new Server(port, {
				cors: {
					origin: "*"
				}
			});

			io.on("connection", (socket) => {
				// console.log("A user connected");

				socket.on("disconnect", () => {
					// console.log("User disconnected");
				});

				socket.on("cmd", (msg) => {
					handleMessage(msg);
					// console.log("Message received from client: ", msg);
					// 广播消息给所有客户端
					// msg += " from server";
					// io.emit("message", msg);
				});
			});

			vscode.window.showInformationMessage('Enable YSYX SDB TUI Server, port is ' + port);

			focusOnTerminal();
			// sendTerminalCommand();

			// console.log("Socket.io server running on port " + port);
		} else {
			vscode.window.showWarningMessage("SDB TUI Server is running, don't open it again.");
		}
	});

	// 注册命令
	context.subscriptions.push(disposable);

	/* Disabling the server */
	let disable = vscode.commands.registerCommand('extension.ysyx-sdb-tui-Disable', () => {
		if (io) {
			io.close();
			io = undefined;
			console.log("Socket.io server closed");
			vscode.window.showInformationMessage('Disable YSYX SDB TUI Server');
		} else {
			vscode.window.showWarningMessage("SDB TUI Server is not running.");
		}
		
	});

	context.subscriptions.push(disable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (io) {
		io.close();
		console.log("Socket.io server closed");
	}
}

/**
 * Fucus on the active terminal if exists,
 * otherwise, open a new terminal and focus 
 * on it.
 */
function focusOnTerminal() {
	if (!vscode.window.activeTerminal) {
		const terminal = vscode.window.createTerminal();
		terminal.show();
	} else {
		vscode.window.activeTerminal.show();
	}
}

/*
function sendTerminalCommand() {
	const terminal = vscode.window.activeTerminal;
	if (terminal) {
		terminal.sendText("cd $NEMU_HOME; cd ..");
	}
}
*/

/**
 * cmd arg1 arg2 ...
 * 
 * init [disas|gdb] file-path
 * hl   [disas|src] pc-addr: highlight the specific line
 * 
 * hl all addr: concurrent execution of 'hl disas addr' and 'hl src addr'
 * 
 * cmd Example:
 * init disas .../am-kernels/tests/cpu-tests/build/add-riscv32-nemu.txt
 * hl disas 80000000
 * 
 * init gdb .../am-kernels/tests/cpu-tests/build/add-riscv32-nemu.elf
 * hl src 80000000 : highlight the specific line in source file
 * */
function handleMessage(msg: string) {
	// console.log("Message received from client: ", msg);

	// console.log(getFunctionNames());

	const list = msg.split(" ");
	const cmd = list[0];
	switch (cmd) {
		case "init":
			switch (list[1]) {
				case "disas": // init disas path
					setDisassemblyFilePath(list[2]);
					break;

				case "gdb": // init gdb path
					setElfFilePath(list[2]);
					break;
			}
			break;

		case "hl": // highlight, hl [disas|source-file] addr
			switch (list[1]) {
				case "disas": // hl disas addr
					focusFileAndHighlightDisassembly(list[2]);
					break;

				case "src": // hl src addr 
					focusFileAndHighlightSourceFile(list[2]);
					break;
				
				case "all": // hl all addr
					highLightDisassemblyAndSrc(list[2]);
					break;
			}
			break;

		default:
			// console.log('illegal command');
			break;
	}


	/* get file path, remove ':' */
	const file_path = (msg.split(" ")[1]).slice(0, -1);
	// const file_path = file_info.substring(0, file_info.length - 1); // remove ':'
	const addr = msg.split(" ")[2];

	// focusFileAndHighlight(addr);
}



