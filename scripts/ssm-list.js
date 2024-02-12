const { program } = require('commander');
const { SSMClient, DescribeParametersCommand } = require('@aws-sdk/client-ssm');
const { paginate, ssmGetParameters } = require('../utils');

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

    const params = await ssmGetParameters(ssm, names);
    const result = Object.fromEntries(params.map(p => [p.Name, p.Value]));

    console.log(JSON.stringify(result, null, 2));
}
