const cp = require('node:child_process');

async function paginate(commandFn, getItemsFn) {
    const result = [];
    let token;

    do {
        const response = await commandFn(token);
        result.push(...getItemsFn(response));
        token = response.NextToken;
    } while (token);

    return result;
}

function run(command, args, params = {}) {
    return new Promise((resolve, reject) => {
        const child = cp.spawn(command, args, {
            stdio: params.output ? ['ignore', 'pipe', 'inherit'] : 'inherit',
        });

        child.on('error', reject);

        const chunks = [];

        if (params.output) {
            child.stdout.on('data', (data) => chunks.push(data));
        }

        child.on('exit', (code) => {
            if (code === 0) {
                resolve(params.output ? Buffer.concat(chunks).toString('utf-8') : undefined);
            } else {
                reject(new Error(`${command} failed with status ${code}`));
            }
        })
    });
}


module.exports = { paginate, run };