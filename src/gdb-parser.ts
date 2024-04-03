import { exec } from "child_process"
import GdbSession from './gdb_session';
import {gdbTool} from './extension'


/**
 * See Chapter 27: The gdb/mi Interface in gdb documentation.
 */

/**
 * 
 * @param elfFile 
 * @param functionName 
 * @returns the source file path of the function
 *          return null if it's not be traced 
 */
export async function getFilePathFromAddress(elfFile: string, addr: string) {

    const functionName = await getFunctionNameFromAddress(elfFile, addr);
    const gdbCommands = [
        `info functions ${functionName}`,
        "quit"
    ];

    try {
        const result = await getGdbCommandResult(elfFile, gdbCommands);
        return getFilePathFromGdbResult(result);
    } catch (error) {
        console.error(`Failed to get file path: ${error}`);
        return null;
    }
}

/**
 * @param elfFile 
 * @param addr the value of pc
 * @returns return the number of line that will be highlighted(start at 0),
 *          return -1 if it's not be traced
 * 
 * Note:
 * 1. line is start at 1 in GDB elf file
 * 2. We assume that the addr has the corresponding source code,
 *    it's traced by GDB.
 */
export async function getSrcHighLightLineNumber(elfFile: string, addr: string): Promise<number> {

    // const name = await getFunctionNameFromAddress(elfFile, addr);

    const currentAddr = "0x" + addr;
    const nextAddr = "0x" + (parseInt(addr, 16) + 4).toString(16);
    const gdbCommands = [
        // `disassemble /s ${name}`,
        `disassemble /s ${currentAddr}, ${nextAddr}`,
        "quit"
    ];

    // try {
    const result = await getGdbCommandResult(elfFile, gdbCommands);
    // console.log("The result of getSrcHighLightLineNumber: ", result);
    /**
     * Reading symbols from ...add-riscv32-nemu.elf...
     * Dump of assembler code from 0x800001bc to 0x800001c0:
     * /home/jht/ysyx/six/ysyx2406-jht/abstract-machine/am/src/platform/nemu/trm.c:
     * 24	void _trm_init() {
     *    0x800001bc <_trm_init+0>:	addi	sp,sp,-32
     * End of assembler dump.
     */

    /* get source file line number */

    // return getSrcHLLineNumFromGdbResult(result, addr);
    // result.split("\n")[3].split(" ")[0];

    const lineText = result.split("\n")[3];
    const pos = lineText.search(/^[0-9]+/);
    
    let line = -1;
    if (pos !== -1) {
        line = parseInt(lineText.substring(pos));
        // console.log("The line number: ", line);
    }

    return line;


    // } catch (error) {
    //     console.error(`Failed to get file path: ${error}`);
    //     return -1;
    // }

}

function getFilePathFromGdbResult(info: string): string | null {
    /**
     * Reading symbols from /home/jht/ysyx/six/ysyx2406-jht/am-kernels/tests/cpu-tests/build/add-riscv32-nemu.elf...
     * -----------------------------------------------------
     * [return /home/jht/ysyx/six/ysyx2406-jht/am-kernels/tests/cpu-tests/tests/add.c]
     * All functions matching regular expression "main":
     * 
     * File /home/jht/ysyx/six/ysyx2406-jht/am-kernels/tests/cpu-tests/tests/add.c:
     * 13:	int main();
     * ------------------------------------------------------
     * [return null]
     * All functions matching regular expression "_start":
     * 
     * Non-debugging symbols:
     * 0x80000000  _start
     */

    const pos = info.search("File");
    if (pos !== -1) {
        const e = info.indexOf(":", pos);
        const path = info.substring(pos + 5, e);
        // console.log(path);

        return path;
    }

    // check if it's not be traced
    // if (info.search("Non-debugging symbols") !== -1) {
    // return null;
    // }

    return null;
}

/**
 * 
 * @param elfFile 
 * @param addr the address of pc
 * @returns 
 */
async function getFunctionNameFromAddress(elfFile: string, addr: string) {
    const gdbCommands = [
        `info symbol 0x${addr}`,
        "quit"
    ];

    /**
     * Reading symbols from /home/jht/ysyx/ ....
     * _start in section .text
     * 
     * Reading symbols from /home/jht/ysyx/ ....
     * main + 16 in section .text
     */
    const result = await getGdbCommandResult(elfFile, gdbCommands);
    // console.log("The result of getFunctionNameFromAddress: ", result);

    /* get function name */
    const name = result.split("\n")[1].split(" ")[0];
    // console.log("The function name: ", name);
    return name;
}

/**
 * 
 * @param info the result of `gdb disassemble /s function_name`
 * @param addr 80000000
 * @returns the number of line that will be highlighted(start at 0)
 *          return -1 if search failed
 */
function getSrcHLLineNumFromGdbResult(info: string, addr: string) {
/**
 * Result example:
 * 
 * Dump of assembler code for function main:
 * home/jht/ysyx/six/ysyx2406-jht/am-kernels/tests/cpu-tests/tests/add.c:
 * 13	int main() {
 *    0x8000008c <+0>:	addi	sp,sp,-32
 *    0x80000090 <+4>:	sw	ra,28(sp)
 *    0x80000094 <+8>:	sw	s0,24(sp)
 *    0x80000098 <+12>:	addi	s0,sp,32
 * 
 * 14		int i, j, ans_idx = 0;
 *    0x8000009c <+16>:	sw	zero,-28(s0)
 * 
 * 15		for(i = 0; i < NR_DATA; i ++) {
 *    0x800000a0 <+20>:	sw	zero,-20(s0)
 *    0x800000a4 <+24>:	j	0x80000160 <main+212>
 * 
 * Return:
 * if addr is 0x80000090, return 13
 * if addr is 0x80000094, return 13
 * if addr is 0x8000009c, return 14
 * if addr is 0x800000a0, return 15
 * if addr is 0x800000a4, return 15
 */
    // const addr = 
    // const searchText = /\s*0x80000094/;
    const searchText = new RegExp(`^\\s*0x${addr}`);
    // match the start line number
    const lineRex = /^[0-9]+/;

    const lines = info.split("\n");
    let lineNum = -1;
    let lineNumTemp = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // console.log("************line: ", line);

        /* get source file line number */
        const pos1 = line.search(lineRex);
        if(pos1 !== -1) {
            lineNumTemp = parseInt(line.substring(pos1));
            // console.log("************lineNumTemp: ", lineNumTemp);
        }

        const pos2 = line.search(searchText);
        if (pos2 !== -1) {
            // console.log("************addr: ", line.substring(pos2));
            lineNum = lineNumTemp;
            break;
        }
    }

    // console.log("************lineNum********: ", lineNum);

    return lineNum;
}


function getGdbCommandResult(elfFile: string, gdbCommands: string[]): Promise<string> {
    // 将GDB命令转换为适合exec调用的格式
    const commandString = gdbCommands.map(cmd => `-ex "${cmd}"`).join(" ");

    // 调用GDB
    const gdbCommand = `${gdbTool} -q ${elfFile} ${commandString}`;

    // 使用exec 异步 执行GDB命令
    return new Promise((resolve, reject) => {
        exec(gdbCommand, (error, stdout, /* stderr */) => {
            if (error) {
                // console.error(`exec error: ${error}`);
                reject(error);
                return;
            }
            // if (stderr) {
                // console.error(`stderr: ${stderr}`);
            // }

            // console.log(`stdout: \n${stdout}`);s
            resolve(stdout);
        });
    });

}

//////////////////////////////////////////////////////////////////////

let gdbsession: GdbSession;

export function initGdbMiSession() {
    return new Promise((resolve) => {
        const file = '/home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/build/yield-os-riscv32-nemu.elf';
        gdbsession = new GdbSession(file);
        resolve(void 0);
    });
}

/**
 * We assume that the command is valid and gdb is running.
 * @param command 
 * 
 * e.g.
 * - '-symbol-info-functions'
 */
export async function sendGdbMiCmdAndGetResult(command: string) {
    // console.log("cmd 1 **************");
    let result = await gdbsession.sendCommandAndGetOutput(`${command}`);
    console.log(result);
    // result = await gdbsession.sendCommandAndGetOutput('-symbol-list-lines /home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/yield-os.c');
}

/**
 * 
 * @param elfFile 
 * @param addr 80000000, need to be converted to 0x80000000
 * @returns [null, -1] or [file path, line number]
 *   
 */
export async function getFilePathAndLine(elfFile: string, addr: string): Promise<[string | null, number]> {
    /**
     * -data-disassemble -s 0x80000090 -e 0x80000094 -- 4
     * 
     * Get Result:
     * 1. debugging
     * asm_insns=[
     *     src_and_asm_line={
     *         line="69",
     *         file="/home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/yield-os.c",
     *         fullname="/home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/yield-os.c",
     *         line_asm_insn=[{address="0x80000090",func-name="schedule",offset="16",inst="auipc\ta5,0x3"}]
     *     }
     * ]
     * 
     * 2. no debugging
     * asm_insns=[{address="0x80000000",func-name="_start",offset="0",inst="li\ts0,0"}]
     */

    const command = `-data-disassemble -s ${convertAddr(addr)} -e ${convertNextAddr(addr)} -- 4`;
    let result: string = await gdbsession.sendCommandAndGetOutput(command);

    console.log("The result of getFilePathAndLine: ", result);

    /* get fullname and line */
    let fullname: string | null = null;
    let line: number = -1;

    if (result.search("src_and_asm_line={") == -1) {
        // no debugging
        return [null, -1];
    }

    const pos1 = result.search("fullname=\"");
    const pos2 = result.search("line=\"");
    fullname = result.substring(pos1 + 10, result.indexOf("\"", pos1 + 10));
    line = parseInt(result.substring(pos2 + 6, result.indexOf("\"", pos2 + 6)));

    console.log("The fullname: ", fullname);
    console.log("The line: ", line);
    return [fullname, line];

}


function convertAddr(addr: string) {
    return "0x" + addr;
}

function convertNextAddr(addr: string) {
    return "0x" + (parseInt(addr, 16) + 4).toString(16);
}