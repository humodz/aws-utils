const { GetParametersCommand } = require('@aws-sdk/client-ssm');
const chunk = require('lodash/chunk');
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

async function ssmGetParameters(ssm, names) {
    const GET_PARAMS_MAX_ITEMS = 10;
    const MAX_CONCURRENT_REQUESTS = 5;
    const nameChunks = chunk(names, GET_PARAMS_MAX_ITEMS);
    const requestChunks = chunk(nameChunks, MAX_CONCURRENT_REQUESTS);

    const result = [];

    for (const request of requestChunks) {
        await Promise.all(request.map(async chunk => {
            const command = new GetParametersCommand({
                Names: chunk,
                WithDecryption: true,
            });
            const response = await ssm.send(command);
            result.push(...response.Parameters);
        }));
    }

    return result;
}


module.exports = {
    paginate,
    run,
    ssmGetParameters,
};