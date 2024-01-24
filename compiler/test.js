import * as child_process from 'child_process';
const pythonProcess = child_process.spawn('python3', ['autocomplete.py']);
const data = {
    source: 'de',
    line: 1,
    column: 2
};
pythonProcess.stdin.write(JSON.stringify(data));
pythonProcess.stdin.end();
function read() {
    return new Promise((res) => {
        pythonProcess.stdout.once('data', (data) => {
            res(JSON.parse(data.toString()));
        });
    });
}
console.log(await read())
pythonProcess.on('close', (code) => {
    
});