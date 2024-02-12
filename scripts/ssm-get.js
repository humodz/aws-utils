#!/usr/bin/env node

const { program } = require('commander');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

program
    .description('Get the value of a parameter from AWS SSM.')
    .argument('<parameter>', 'The name of the parameter to get.')
    .action(ssmGetParameter)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function ssmGetParameter(name) {
    const ssm = new SSMClient();
    const command = new GetParameterCommand({
        Name: name, WithDecryption: true
    });

    const response = await ssm.send(command);
    console.log(response.Parameter.Value);
}