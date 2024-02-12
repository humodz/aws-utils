#!/usr/bin/env node

const { program } = require('commander');
const { SSMClient, DeleteParametersCommand } = require('@aws-sdk/client-ssm');

program
    .description('Delete parameters from AWS SSM.')
    .argument('<parameters...>')
    .option('-e, --exists', 'Show a warning if any of the parameters does not exist', false)
    .action(ssmPutParameter)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function ssmPutParameter(parameters, options) {
    const ssm = new SSMClient();

    const command = new DeleteParametersCommand({
        Names: parameters,
    });

    const response = await ssm.send(command);
    const invalidParameters = response.InvalidParameters;

    if (invalidParameters?.length) {
        console.warn('WARN The following parameters do not exist:');
        invalidParameters.forEach(parameter => console.warn(`  ${parameter}`));
    }
}

