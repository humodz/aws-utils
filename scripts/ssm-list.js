const { program } = require('commander');
const { SSMClient, DescribeParametersCommand, GetParametersCommand } = require('@aws-sdk/client-ssm');
const { paginate } = require('../utils');
const chunk = require('lodash/chunk');

program
    .description('List parameters from AWS SSM.')
    .option('-e, --equals [name]')
    .option('-b, --begins [prefix]')
    .option('-c, --contains [terms...]')
    .option('-v, --values', 'Fetch parameter values and show result as a JSON object.', false)
    .option('-j, --json', 'Force JSON output')
    .action(ssmListParameters)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function ssmListParameters(options) {
    const filters = [];

    if (options.equals) {
        filters.push({
            Key: 'Name',
            Option: 'Equals',
            Values: [options.equals],
        });
    }

    if (options.begins) {
        filters.push({
            Key: 'Name',
            Option: 'BeginsWith',
            Values: [options.begins],
        })
    }

    if (options.contains) {
        filters.push({
            Key: 'Name',
            Option: 'Contains',
            Values: options.contains,
        })
    }

    const ssm = new SSMClient();

    const names = await paginate((token) => {
        const command = new DescribeParametersCommand({
            NextToken: token,
            ParameterFilters: filters,
        });
        return ssm.send(command);
    }, (response) => {
        return response.Parameters.map(it => it.Name)
    });

    if (!options.values) {
        if (!options.json) {
            names.forEach(name => console.log(name));
        } else {
            console.log(JSON.stringify(names, null, 2));
        }
        return;
    }

    const GET_PARAMS_MAX_ITEMS = 10;
    const MAX_CONCURRENT_REQUESTS = 5;
    const nameChunks = chunk(names, GET_PARAMS_MAX_ITEMS);
    const requestChunks = chunk(nameChunks, MAX_CONCURRENT_REQUESTS);

    const result = {};

    for (const request of requestChunks) {
        await Promise.all(request.map(async chunk => {
            const command = new GetParametersCommand({
                Names: chunk,
                WithDecryption: true,
            });
            const response = await ssm.send(command);

            response.Parameters.forEach(it => {
                result[it.Name] = it.Value;
            })
        }));
    }

    console.log(JSON.stringify(result, null, 2));
}
