const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { program } = require('commander');

program
    .description('Authenticate into AWS Console using local credentials. ')
    .action(goToAwsConsole)
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });


async function goToAwsConsole() {
	const creds = await fromNodeProviderChain()({});

	const session = {
		sessionId: creds.accessKeyId,
		sessionKey: creds.secretAccessKey,
		sessionToken: creds.sessionToken,
	};

	const query = new URLSearchParams({
		Action: 'getSigninToken',
		SessionDuration: 12 * 60 * 60,
		Session: JSON.stringify(session),
	});

	const url = 'https://signin.aws.amazon.com/federation?' + query;

	const responseBody = await fetch(url).then(async response => {
		if (!response.ok) {
			throw new Error(`Request failed: ${response.status}`);
		}
		return response.json();
	});

	const redirectQuery = new URLSearchParams({
		Action: 'login',
		Issuer: 'example.com',
		Destination: 'https://console.aws.amazon.com/',
		SigninToken: responseBody.SigninToken,
	});

	const redirectUrl = 'https://signin.aws.amazon.com/federation?' + redirectQuery
	console.log(redirectUrl);
}
