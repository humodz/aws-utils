const { fromSSO } = require('@aws-sdk/credential-providers');
const { program } = require('commander');
const { run } = require('../utils');

program
    .description('Get new credentials for the current AWS profile and store them in ~/.aws/credentials.')
    .action(refreshCredentials)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

async function refreshCredentials() {
    try {
        const credentials = await getCredentialsFromSso();

        const configs = [
            ['aws_access_key_id', credentials.accessKeyId],
            ['aws_secret_access_key', credentials.secretAccessKey],
            ['aws_session_token', credentials.sessionToken],
        ];

        for (const [key, value] of configs) {
            await run('aws', ['configure', 'set', key, value]);
        }
    } catch (error) {
        if (error.name === 'CredentialsProviderError') {
            console.error('ERROR', error.message);
        } else if (error.code === 'ENOENT' && error.path === 'aws') {
            console.error(`ERROR AWS CLI not installed`);
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

async function getCredentialsFromSso() {
    try {
        return await fromSSO()({});
    } catch (error) {
        if (error.name === 'CredentialsProviderError') {
            await run('aws', ['sso', 'login']);
            return await fromSSO()({});
        } else {
            throw error;
        }
    }
}
