import GdbSession from './gdb_session';


/**
 * See Chapter 27: The gdb/mi Interface in gdb documentation.
 */

export let gdbsession: GdbSession | null = null;

export function initGdbMiSession(file: string) {
    return new Promise((resolve) => {
        // const file = '/home/../am-kernels/kernels/yield-os/build/yield-os-riscv32-nemu.elf';
        gdbsession = new GdbSession(file);
        resolve(gdbsession);
    });
}


/**
 * We assume that the gdb session is running.
 * 
 * @param elfFile The elf file path containing the gdb information
 * @param addr  The address of pc.
 *              e.g. 80000000, need to be converted to 0x80000000
 * @returns [null | file-path, -1 | line-number]
 *          - file path: the source file path of the address, 
 *                       return null if it has no debugging information
 *         - line number: the line number of the source file, it will be highlighted
 *  
 * Note: line number is start at 1 in GDB elf file
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
    let result: string = await gdbsession?.sendCommandAndGetOutput(command);

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

type PcLine = {
    pc: string;
    line: string;
};

/**
 * 
 * @param filePath 
 * @param line 
 * @returns If the line is debugging, the line will correspond to 
 *          one or more pc, return the first pc (string)
 *          If the line is not debugging, return null.
 * 
 * Result example:
 * lines=[{pc="0x08048554",line="7"},{pc="0x0804855a",line="8"}] 
 */
export async function parseBreakpointByGdb(filePath: string, line: number) {
    console.log("parseBreakpointByGdb: ", filePath, line);

    const command = `-symbol-list-lines ${filePath}`;
    let output: string = await gdbsession?.sendCommandAndGetOutput(command);
    // console.log("The output: ", output);

    /* handle the output */
    // remove the prefix and suffix, get '[{pc="0x80000000",line="7"},{...},{...}]'
    const jsonPart = output.slice(output.indexOf('['), output.indexOf(']') + 1);

    // convert GDB MI to JSON, get '[{"pc":"0x80000000","line":"7"},{...},{...}]'
    const jsonFormat = jsonPart.replace(/\b(pc|line)=/g, '"$1":').replace(/'/g, '"');

    // console.log("The jsonFormat: ", jsonFormat);
    /**
     * Parse the jsonFormat to json format
     * 
     * 0:{pc: '0x80000010', line: '44'}
     * 1:{pc: '0x80000024', line: '49'}
     * 2:{pc: '0x80000028', line: '49'}
     * 3:{pc: '0x80000054', line: '51'}
     * 4:{pc: '0x80000078', line: '54'}
     * 5:{pc: '0x8000007c', line: '49'}
     */
    const json: PcLine[] = JSON.parse(jsonFormat);

    // console.log("The json: ", json);

    /* get pc */
    for (let i = 0; i < json.length; i++) {
        const pc = json[i].pc;
        const lineNum = json[i].line;
        // console.log("pc: ", pc);
        // console.log("line: ", line);
        if (line == parseInt(lineNum, 10)) {
            console.log(`line: ${line} --> pc: ${pc}`);
            // return parseInt(pc, 16);
            return pc;
        }
    }

    return null;
}


function convertAddr(addr: string) {
    return "0x" + addr;
}

function convertNextAddr(addr: string) {
    return "0x" + (parseInt(addr, 16) + 4).toString(16);
}