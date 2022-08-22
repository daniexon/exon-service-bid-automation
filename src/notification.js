const {isArray} = require("lodash");
const converter = require('json-2-csv');
const AWS = require('aws-sdk');
const { IncomingWebhook } = require('@slack/webhook');


const notification = async (automationResult) => {
    const createCSV = async () => {
        return new Promise((res, rej) => {
            converter.json2csv(automationResult, (err, csv) => {
                if (err) {
                    return rej(err);
                }
                return res(csv);
                // print CSV string
            });
        });
    }
    const uploadCSV = async (csvString) => {
        const s3 = new AWS.S3();
        let key = `google_ads_notifications/bid-automation/${new Date().toISOString()}.csv`;
        await s3.putObject({
            ACL: 'public-read',
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: csvString
        }).promise();
        let link = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
        return link;
    }
    const sendMessageToSlack = async( message) =>{
        const url = process.env.SLACK_WEBHOOK_URL;
        const webhook = new IncomingWebhook(url);
        await webhook.send({
            text: message
        })

    }
    const init = async () => {
        if (!automationResult || !isArray(automationResult)) {
            console.log('not found any notification')
            return;
        }
        const csv = await createCSV();
        if (!csv) {
            console.error('cannot create csv file');
            return;
        }

        try {
            //build message on slack
            let sb = 'Bid Automation Recommendations -' + new Date().toLocaleString() + ' : \n';
            automationResult.filter(x => x.priority >= 4).map(item => {
                sb += `${item.message.indexOf('open') === 0 ? ':white_check_mark: ' : item.message.indexOf('close') === 0 ? ':x: ' : ''}${item.domain} -> ${item.message}\n`;
            });
            sb += '\n';
            await sendMessageToSlack(sb);
        }catch (ex) {
            console.error(ex);
        }

        try {
            //create file
            const link = await uploadCSV(csv);
            const message = 'Bid Automation Recommendation Details ' + new Date().toLocaleString()
            const msg = `:file_cabinet: <${link}|${(message == "" ? link : message)}>`;
            await sendMessageToSlack(msg)
        }catch (ex){
            console.error(ex);
        }

    }

    return await init();
};
exports.module = notification;