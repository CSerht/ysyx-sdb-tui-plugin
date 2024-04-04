import { spawn } from 'child_process';
import {gdbTool} from './extension'

// const file = '/home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/build/yield-os-riscv32-nemu.elf';

class GdbSession {
     constructor(filePath) {
        this.filePath = filePath;
        this.gdb = spawn(`${gdbTool}`, ['--interpreter=mi', this.filePath]);
        console.log('Start gdb session'); 
    }
    
    /**
     * 
     * @param {string} command The GDB MI command to send to GDB 
     * @returns The pure output of the command, without the GDB prompt 
     *          or any other GDB output(like ^done or ^error), so you 
     *          can concentrate on parsing the output of the command itself.
     */
    sendCommandAndGetOutput(command) {
        return new Promise((resolve, reject) => {
            let output = '';

            // collect the output until the ^done or ^error is received
            // (it means the command is finished and the output is complete)
            const onData = (data) => {
                const str = data.toString();
                output += str;
                if (str.trim().match(/^\^done|^error/)) {
                    // remove the listener to avoid memory leak
                    this.gdb.stdout.removeListener('data', onData); 

                    // remove the ^done or ^error and the string before it
                    output = output.replace(/.*\^(done|error),/s, '');
                    
                    // remove the '\n(gdb)\n' in the end, compatible with both Windows and Linux
                    output = output.replace(/(\r\n|\n)\(gdb\).*/s, '');

                    // console.log(`GDB output:`);
                    resolve(output);
                }
            };
            this.gdb.stdout.on('data', onData); // listen to stdout to get the output

            // listen to stderr to get the error message
            this.gdb.stderr.on('data', (data) => {
                reject(data.toString());
            });

            // write the command to GDB MI
            // console.log(`Sending command: ${command} to GDB`);
            this.gdb.stdin.write(`${command}\n`);
        });
    }

    /**
     * quit the GDB session and close the process
     */
    close() {
        if (this.gdb) {
            this.gdb.stdin.write('quit\n');
        }
    }
}

// module.exports = GdbSession;
export default GdbSession;