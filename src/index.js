const { google } = require('googleapis');
const express = require('express')
const OAuth2Data = require('../google_creds.json')
const nodemailer=require('nodemailer')
const fs = require('fs');
const util = require('util');


const app = express()

const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)
var authed = false;
app.use(express.json())


//endpoint to initiate the authentication process
app.get('/',  (req, res) => {
    if (!authed) {
        // Generate an OAuth URL and redirect there
        const url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://mail.google.com/'
        });
        //redirect to url for verifying user
        res.redirect(url);
    } else {
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        gmail.users.labels.list({
            userId: 'me',
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            const labels = res.data.labels;
            if (labels.length) {
                console.log('Labels:');
                labels.forEach((label) => {
                    console.log(`- ${label.name}`);
                });
            } else {
                console.log('No labels found.');
            }
        });
        
        
        //storing the credentials to the file
        fs.writeFile("../Authclient", JSON.stringify(oAuth2Client.credentials), function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });

        
      
        res.send('Logged in') 
    }
})


//redirect uri endpoint to get OAuth code
app.get('/auth/google/callback', function (req, res) {
    const code = req.query.code
    if (code) {
        // Get an access token based on our OAuth code
        oAuth2Client.getToken(code, function (err, tokens) {
            if (err) {
                console.log('Error authenticating')
                console.log(err);
            } else {
                console.log('Successfully authenticated');
                oAuth2Client.setCredentials(tokens);
                console.log(oAuth2Client);
                authed = true;
                res.redirect('/')
            }
        });
    }
});

//endpoint to login after successful authentication
/*
request body should be a json object with following details
{
    from : "sender email which is authenticated".
    to : "receiver email",
    subject : "subject of email",
    text : "body of email"
}
*/

app.post('/sendmail',async (req,res)=>{
    //getting back the credentials from the file
    const readFile = util.promisify(fs.readFile);
    var creds= await readFile('./Authclient');
    creds = JSON.parse(creds)
    console.log(creds)
    try {
        
        //getting accesstoken
        const accessToken = creds.access_token;


        //using nodemailer module for creating transport
        const transport = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: req.body.from,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: creds.refresh_token,
            accessToken: accessToken,
          },

        });
        const mailOptions = {
          from: req.body.from,
          to: req.body.to,
          subject: req.body.subject,
          text: req.body.text,
        };
        //sending mail using mailoptions
        const result = await transport.sendMail(mailOptions);
        res.status(200).send(result);
      } catch (error) {
        res.status(400).send(error);
      }
})


const port = 5000
app.listen(port, () => console.log(`Server running at ${port}`));