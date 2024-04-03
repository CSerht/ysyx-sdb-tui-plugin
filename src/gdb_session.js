import { spawn } from 'child_process';

// const file = '/home/jht/ysyx/six/ysyx2406-jht/am-kernels/kernels/yield-os/build/yield-os-riscv32-nemu.elf';

class GdbSession {
     constructor(filePath) {
        this.filePath = filePath;
        this.gdb = spawn('gdb-multiarch', ['--interpreter=mi', this.filePath]);
		console.log('Start gdb session'); 
    }
    
    /**
     * 
     * @param {string} command The GDB MI command to send to GDB 
     * @returns The pure output of the command, without the GDB prompt or any other GDB output,
     *          so you can concentrate on parsing the output of the command itself.
     */
    sendCommandAndGetOutput(command) {
        return new Promise((resolve, reject) => {
            let output = '';

            // 收集输出直到命令执行结束
            const onData = (data) => {
                const str = data.toString();
                output += str;
                if (str.trim().match(/^\^done|^error/)) {
                    this.gdb.stdout.removeListener('data', onData); // 移除监听器避免内存泄漏
                    // remove the ^done or ^error and the string before it
                    // output = output.replace(/.*(\^done|\^error),/, '');
                    output = output.replace(/.*\^(done|error),/s, '');
                    // remove the '\n(gdb)\n' in the end, compatible with both Windows and Linux
                    output = output.replace(/(\r\n|\n)\(gdb\).*/s, '');

                    console.log(`GDB output:`);
                    resolve(output);
                }
            };
            this.gdb.stdout.on('data', onData);

            // 监听stderr以捕获错误
            this.gdb.stderr.on('data', (data) => {
                reject(data.toString());
            });

            // 在stdin中写入命令
            console.log(`Sending command: ${command} to GDB`);
            this.gdb.stdin.write(`${command}\n`);
        });
    }

    close() {
        if (this.gdb) {
            this.gdb.stdin.write('quit\n');
            // this.gdb.kill();  // 发送SIGTERM信号结束进程
        }
    }
}

// module.exports = GdbSession;
export default GdbSession;