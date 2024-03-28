import { exec } from "child_process"

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
        console.log(path);

        return path;
    }

    // check if it's not be traced
    // if (info.search("Non-debugging symbols") !== -1) {
    // return null;
    // }

    return null;
}

/**
 * line is start at 0
 * @param elfFile 
 * @param addr the value of pc
 * @returns return the number of line that will be highlighted(start at 0),
 *          return -1 if it's not be traced
 */
export async function getSrcHighLightLineNumber(elfFile: string, addr: string) {

    const name = await getFunctionNameFromAddress(elfFile, addr);
    const gdbCommands = [
        `disassemble /s ${name}`,
        "quit"
    ];

    try {
        const result = await getGdbCommandResult(elfFile, gdbCommands);
        return getSrcHLLineNumFromGdbResult(result, addr);
    } catch (error) {
        console.error(`Failed to get file path: ${error}`);
        return -1;
    }

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
    console.log("The result of getFunctionNameFromAddress: ", result);

    /* get function name */
    const name = result.split("\n")[1].split(" ")[0];
    console.log("The function name: ", name);
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
    const searchText = new RegExp(`\\s*0x${addr}`);
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

    // 调用GDB，这里假设可执行文件是"./myProgram"
    const gdbCommand = `gdb-multiarch -q ${elfFile} ${commandString}`;

    // 使用exec 异步 执行GDB命令
    return new Promise((resolve, reject) => {
        exec(gdbCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }

            // console.log(`stdout: \n${stdout}`);s
            resolve(stdout);
        });
    });

}