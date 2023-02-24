
require('dotenv').config()
const jwt = require('jsonwebtoken');
const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');
var Handlebars = require("hbs");
const axios = require('axios');

const privateKey = process.env.privateKey
const integratorKey = '43891a74-33c8-403d-b451-8c3e1009213e';
const userId = '73597449-f770-4e2e-bc60-eebbcc679d58';
const accountId = 'd8e2676e-e967-4f8d-bbb5-13b30afb1955';
const image = 'https://i.ibb.co/rkQ3LGH/logo-social.png'

const express = require('express');
const app = express();

app.get('/sign-document', async function(req, res) {
  try {
    const apiClient = new docusign.ApiClient();

    // Create JWT token
    const jwtToken = jwt.sign({
        iss: "43891a74-33c8-403d-b451-8c3e1009213e",
        sub: "73597449-f770-4e2e-bc60-eebbcc679d58",
        aud: "account-d.docusign.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000)+6000,
        scope: "signature"
    }, 
    privateKey,
    { algorithm: 'RS256' },
    {expiresIn: '360d'});
    
    // Get access token
    const data = JSON.stringify({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwtToken
    })
    const config = {
        method: 'post',
        url: 'https://account-d.docusign.com/oauth/token',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };
    const response = await axios(config);
    const token = response.data.access_token;

    // Set up DocuSign client
    apiClient.setBasePath('https://demo.docusign.net/restapi');

    apiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // Set up document and recipient information
    const documentPath = './doc.html';
    const recipientName = 'Meriem Barhoumi';
    const recipientEmail = 'barhoumi.meriem1@gmail.com';
    const recipientClientId = '2';

    const templateStr = fs.readFileSync(path.resolve(documentPath)).toString('utf8');
	const template = Handlebars.compile(templateStr, { noEscape: true });
	const html = template({
		image: image,
        text: "Please, sign this document"
	});

    // write content into file
    fs.writeFileSync(
        path.resolve(documentPath),
        html,
        { encoding: 'utf8', flag: 'w' }
    )

    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = 'Test Subject';
    let doc1 = new docusign.Document()
    doc1.documentBase64 = Buffer.from(fs.readFileSync(documentPath)).toString('base64');
	doc1.name = 'Lorem Ipsum';
	doc1.fileExtension = path.extname(documentPath).replace('.', '');
	doc1.documentId = '1';
    envelopeDefinition.documents = [
        doc1
    ];

    // Who will sign the document
    let manager = docusign.Signer.constructFromObject({
        email: recipientEmail,
        name: recipientName,
        recipientId: '1',
        clientUserId: recipientClientId,
    });

    // 
    let customer = docusign.Signer.constructFromObject({
        email: 'thenorthtechstore@gmail.com',
        name: 'the north humans',
        recipientId: '2'
    });

    let signHere1 = docusign.SignHere.constructFromObject({
        anchorString: '/sn1/',
        anchorYOffset: '10', 
        anchorUnits: 'pixels',
        anchorXOffset: '20'
    });

    // Tabs are set per recipient / signer
	let signer1Tabs = docusign.Tabs.constructFromObject({
	    signHereTabs: [signHere1]
    });
    manager.tabs = signer1Tabs;
    	  
    // Add the recipient to the envelope object
    let recipients = docusign.Recipients.constructFromObject({
    	signers: [manager]
    });
    envelopeDefinition.recipients = recipients
    envelopeDefinition.status = 'sent';

    // Create the envelope and get the signing URL
    const results = await envelopesApi.createEnvelope(accountId, {
         envelopeDefinition: envelopeDefinition
    });
    const envelopeId = results.envelopeId;

    // Retrieve the envelope status periodically until it is completed
    let envelopeDocuments = await envelopesApi.listDocuments(accountId, envelopeId, null);
    console.log(envelopeDocuments);
    const signedDocumentId = envelopeDocuments.envelopeDocuments[0].documentId
    const recipientViewRequest = new docusign.RecipientViewRequest();
    recipientViewRequest.returnUrl = 'https://www.docusign.com/devcenter';
    recipientViewRequest.authenticationMethod = 'email';
    recipientViewRequest.email = recipientEmail;
    recipientViewRequest.userName = recipientName;
    recipientViewRequest.clientUserId = recipientClientId;
    const signingUrl = await envelopesApi.createRecipientView(accountId, envelopeId, {
         recipientViewRequest: recipientViewRequest
    })
    res.redirect(signingUrl.url);

    let envelopeStatus;
    while (!envelopeStatus || envelopeStatus.status !== 'completed') {
        console.log('Waiting for envelope to be completed...');
        envelopeStatus = await envelopesApi.getEnvelope(accountId, envelopeId);
        console.log(envelopeStatus.status);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
    }
    console.log('Envelope completed');

    const envelopeRecipients = new docusign.Recipients();
    envelopeRecipients.signers = [customer];
    const result = await envelopesApi.getDocument(accountId, envelopeId, signedDocumentId, {});

    fs.writeFileSync(
        path.resolve('./file.pdf'),
        result,
        { encoding: 'binary', flag: 'w' }
    )

  } catch (e) {
    console.log(e);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, function() {
  console.log('Server listening on port 3000');
});

