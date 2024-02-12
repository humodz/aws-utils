const { program, Option } = require('commander');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');

program
    .description('Create or update a parameter in AWS SSM.')
    .argument('<parameter>')
    .argument('<value>')
    .option('-e, --exists', 'Fail if the parameter does not exist', false)
    .addOption(
        new Option('-c, --create', 'Fail if the parameter exists', false)
            .conflicts('exists')
    )
    .addOption(
        new Option('-t, --type', 'The type of the parameter', 'String')
            .choices(['String', 'SecureString'])
    )
    .action(ssmPutParameter)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function ssmPutParameter(parameter, value, options) {
    const ssm = new SSMClient();

    const command = new PutParameterCommand({
        Name: parameter,
        Value: value,
        Type: options.exist ? undefined : options.Type,
        Overwrite: !options.create,
    });

    const response = await ssm.send(command).catch(handleError);
    response.$metadata = undefined;

    console.log(JSON.stringify(response, null, 2));
}

function handleError(error) {
    if (error.name === 'ParameterAlreadyExists') {
        console.error('ERROR: Parameter already exists.');
    } else if (error.name === 'ValidationException') {
        console.error('ERROR: Parameter not found.');
    } else {
        console.error(error);
    }

    process.exit(1);
}
