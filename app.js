
require('dotenv').config()
const jwt = require('jsonwebtoken');
const docusign = require('docusign-esign');
const fs = require('fs');
const path = require('path');

const privateKey = process.env.privateKey
const integratorKey = '43891a74-33c8-403d-b451-8c3e1009213e';
const userId = '73597449-f770-4e2e-bc60-eebbcc679d58';
const accountId = 'd8e2676e-e967-4f8d-bbb5-13b30afb1955';


const express = require('express');
const app = express();

app.get('/sign-document', async function(req, res) {
  try {
    try {
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

        //POST axios
        const axios = require('axios');
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
        const apiClient = new docusign.ApiClient();
        apiClient.setBasePath('https://demo.docusign.net/restapi');

        apiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
        const envelopesApi = new docusign.EnvelopesApi(apiClient);

        // Set up document and recipient information
        const documentName = 'Document To Sign';
        const documentPath = './doc.html';
        const recipientName = 'Meriem Barhoumi';
        const recipientEmail = 'barhoumi.meriem1@gmail.com';
        const recipientClientId = '2';

        // Create an envelope
        const envelopeDefinition = new docusign.EnvelopeDefinition();
        envelopeDefinition.emailSubject = 'Subject Hmar';
        let doc1 = new docusign.Document()
        doc1.documentBase64 = Buffer.from(fs.readFileSync(documentPath)).toString('base64');
	    doc1.name = 'Lorem Ipsum';
	    doc1.fileExtension = path.extname(documentPath).replace('.', '');
	    doc1.documentId = '1';
        new docusign.Document()
        envelopeDefinition.documents = [
            doc1
        ];
        let signer1 = docusign.Signer.constructFromObject({
            email: recipientEmail,
            name: recipientName,
            recipientId: '1',
            clientUserId: recipientClientId,
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
    	signer1.tabs = signer1Tabs;
    	  
        // Add the recipient to the envelope object
        let recipients = docusign.Recipients.constructFromObject({
    	    signers: [signer1]
        });
        envelopeDefinition.recipients = recipients
        envelopeDefinition.status = 'sent';

        // Create the envelope and get the signing URL
        const results = await envelopesApi.createEnvelope(accountId, {
            envelopeDefinition: envelopeDefinition
        });
        const envelopeId = results.envelopeId;
        const recipientViewRequest = new docusign.RecipientViewRequest();
        recipientViewRequest.returnUrl = 'https://www.docusign.com/devcenter';
        recipientViewRequest.authenticationMethod = 'email';
        recipientViewRequest.email = recipientEmail;
        recipientViewRequest.userName = recipientName;
        recipientViewRequest.clientUserId = recipientClientId;
        const signingUrl = await envelopesApi.createRecipientView(accountId, envelopeId, {
            recipientViewRequest: recipientViewRequest
        });
        console.log(signingUrl.url);
        res.redirect(signingUrl.url);
    } catch (e) {
        console.log(e);
    }
  } catch (e) {
    console.log(e);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, function() {
  console.log('Server listening on port 3000');
});
  
