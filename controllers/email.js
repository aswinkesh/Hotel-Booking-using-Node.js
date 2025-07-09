const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const env = require('./config.gmail.env');
const oauth2Client = new OAuth2(
  env.ClientID, // ClientID from Google Developer Console
  env.client_secret, // Client Secret from Google Developer Console
  env.redirect_url // Redirect URL
);

oauth2Client.setCredentials({
  refresh_token: env.refresh_token // Refresh Token from Google Developer Console
});
const accessToken = oauth2Client.getAccessToken();

async function sendTextEmail(to, subject, text, html = null,attachments = []) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: env.emailid, // Your Gmail address
            clientId: env.ClientID,
            clientSecret: env.client_secret,
            refreshToken: env.refresh_token,
            accessToken: accessToken
        },
        tls: {
            rejectUnauthorized: false // Allow self-signed certificates
        }
    });
    var mailOptions = {
        from: env.emailid,
        to: to,
        subject: subject,
        text: text,
        ...(html && { html: html }),
        attachments: attachments 
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

module.exports.sendTextEmail = sendTextEmail;