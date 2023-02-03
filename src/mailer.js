var nodemailer = require('nodemailer');

let transporterOpts;

const strSize = s => {
    const bytes = s => {
        return ~-encodeURI(s).split(/%..|./).length;
    };
    return bytes(JSON.stringify(s)) / 1e+6; // in ~ mb
};

// attachment size threshold
const MAX_SIZE = 9; // mb

const hasSecureSMTPConf = () => {
    const vars = ['HOST', 'PORT', 'SECURE', 'USER', 'PASS'];
    vars.forEach(envVar => {
        if (!process.env.hasOwnProperty('SMTP_' + envVar)) return false;
    });
    return true;
};

if (hasSecureSMTPConf()) {
    transporterOpts = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass:  process.env.SMTP_PASS
        }
    };
}

const transporter = nodemailer.createTransport(transporterOpts);

const getSenderDomain = function(host) {
    return host.replace(/^\./, '');  // remove leading '.'
};

const domain = getSenderDomain(process.env.HOST || 'netsblox.org');
module.exports = {
    sendMail: function(opts) {
        opts.from = opts.from || 'no-reply';
        if (!opts.from.includes('@')) {  // add domain
            opts.from += '@' + domain;
        }
        if (opts.attachments) { // replace/remove big attachments
            opts.attachments.forEach(data => {
                if ((typeof data.content === 'string' && strSize(data.content) > MAX_SIZE)) {
                    throw new Error(`attachment ${data.filename} too big`);
                }
            });
        }
        return transporter.sendMail(opts);
    },
    getSenderDomain: getSenderDomain  // for testing
};
