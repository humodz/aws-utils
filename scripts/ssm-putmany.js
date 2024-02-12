const { program } = require('commander');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const { ssmGetParameters } = require('../utils');

const sensitiveWords = ['key', 'secret', 'password', 'passcode'];

program
    .description('Create or update parameters in AWS SSM. Reads a JSON from standard input. ')
    .option('-g, --generate-example-input', 'Generate example JSON input. ', false)
    .option('-d, --dumb',
        'Do not guess type from parameter name. All params with unspecified type will be String.\n' +
        `Default behavior is to guess SecureString if name contains one of ${sensitiveWords.join(', ')}`,
        false
    )
    .action(ssmPutParameters)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function ssmPutParameters(options) {
    if (options.generateExampleInput) {
        generateExampleInput();
        return;
    }

    const allowedTypes = [undefined, 'String', 'SecureString'];
    const allowedNamePattern = () => /^[a-zA-Z0-9_.-/]+$/g;
    const nameAllowedChars = String(allowedNamePattern()).slice(3, -5);

    const paramsRaw = fs.readFileSync(0, 'utf-8');
    const params = JSON.parse(paramsRaw);

    const errors = [];

    const commands = Object.entries(params).map(([nameAndType, value]) => {
        const terms = nameAndType.split(':');
        if (terms.length > 2) {
            errors.push(`Invalid key: ${toJson(nameAndType)}, must be "name" or "name:type"`);
        }

        const [name, type] = terms;

        if (!allowedNamePattern().test(name)) {
            errors.push(`Invalid name: ${toJson(name)}, may only contain ${nameAllowedChars} `);
        }

        if (!allowedTypes.includes(type)) {
            errors.push(`Invalid type: ${toJson(type)}. Allowed values are ${allowedTypes.join(', ')}`);
        }

        if (typeof value !== 'string') {
            errors.push(`Invalid value: ${toJson(value)}, must be string`);
        }

        return { name, type, value };
    });

    if (errors.length > 0) {
        console.error('There are errors in the input:\n');
        errors.forEach(error => console.log(error));
        process.exit(1);
    }

    const ssm = new SSMClient();
    const existingParamsList = await ssmGetParameters(ssm, commands.map(it => it.name));
    const existingParams = Object.fromEntries(existingParamsList.map(it => [it.Name, it]));

    function getDefaultType(name) {
        if (!options.dumb && isNameSensitive(name)) {
            return 'SecureString';
        } else {
            return 'String';
        }
    }

    const results = await Promise.allSettled(commands.map(async input => {
        const command = new PutParameterCommand({
            Name: input.name,
            Type: input.type ?? existingParams[input.name]?.Type ?? getDefaultType(input),
            Value: input.value,
            Overwrite: true,
        });

        return await ssm.send(command);
    }));

    const created = [];
    const updated = [];

    results.forEach((result, i) => {
        const name = commands[i].name;

        if (result.status === 'fulfilled' && result.value.Version === 1) {
            created.push(name);
        } else {
            updated.push(name);
        }
    });

    console.log('Created:');
    logList(created);

    console.log('\nUpdated:');
    logList(updated);

    if (results.some(r => r.status === 'rejected')) {
        console.error('\nErrors:')

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(`  ${commands[i].name}: ${result.reason}`);
            }
        });

        process.exit(1);
    }
}

function generateExampleInput() {
    const example = {
        "/app/baseUrl": "https://example.com",
        "/app/example": "this will be of type String if the parameter does not exist already",
        "/app/launchCodes:SecureString": "this will be of type SecureString",
        "/app/password": `this will be of type SecureString, because the name contains "password"`,
    };

    console.log(JSON.stringify(example, null, 2));
}

function toJson(value) {
    return JSON.stringify(value);
}

function isNameSensitive(name) {
    const asLower = name.toLowerCase();
    return sensitiveWords.some(word => asLower.includes(word));
}

function logList(items) {
    items.forEach(item => console.log(`  ${item}`));

    if (items.length === 0) {
        console.log('  none');
    }
}