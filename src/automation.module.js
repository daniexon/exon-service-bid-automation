const configuration = require('./configurations');
const moment = require('moment');
const AWS = require('aws-sdk');
const _ = require('lodash');


const automationModule = () => {
    let results = [];
    let runRateData = null;
    const addDomainResult = (domain, message, priority) => {
        results.push({domain, message, priority});
    }
    const downloadRunRate = async () => {
        const s3 = new AWS.S3();
        const NUMBER_OF_HOURS = 3;
        const downloadStringFromS3 = async (bucket, key) => {
            const options = {
                Bucket: bucket,
                Key: key,
            };
            let data = (await s3.getObject(options).promise()).Body.toString('utf-8');//.promise();

            let json = '[ ' + data.split('\n').join(',') + ']';
            return ((JSON).parse(json));
        }
        const getFilesPath = async (options) => {
            const t = await s3.listObjects(options).promise();
            return t.Contents.map(x => x.Key).sort().slice(-1 * NUMBER_OF_HOURS);
        }
        const getRunRateAdapter = (arrayRunRate) => {
            let array = {};
            for (let dayIndex in arrayRunRate)
                for (let row of arrayRunRate[dayIndex]) {
                    let newItem = {};
                    newItem.dayIndex = dayIndex;
                    newItem.project = row.project;
                    newItem.clicks = _.sum(Object.keys(row).filter(x => _.endsWith(x, "_clicks")).map(r => row[r]));
                    newItem.cost = _.sum(Object.keys(row).filter(x => _.endsWith(x, "_cost")).map(r => row[r]));
                    newItem.revenue = _.sum(Object.keys(row).filter(x => _.endsWith(x, "_revenue") && !_.startsWith(x, 'amazon_web_earnings')).map(r => row[r]));
                    newItem.ROI = parseFloat((newItem.revenue / newItem.cost * 100).toFixed(2));
                    if (!array[row.project]) array[row.project] = [];
                    array[row.project].push(newItem);
                }
            return array
        }


        const yesterday = moment().utc().add(-1, 'days');
        const today = moment().utc();

        const optionsYesterday = {
            Bucket: process.env.S3_BUCKET,
            Prefix: `production/bi/reports/roi-hourly/year=${yesterday.year()}/month=${(yesterday.month() + 1 + '').padStart(2, '0')}/day=${(yesterday.date() + '').padStart(2, '0')}`,
        }
        const optionsToday = {
            Bucket: process.env.S3_BUCKET,
            Prefix: `production/bi/reports/roi-hourly/year=${today.year()}/month=${(today.month() + 1 + '').padStart(2, '0')}/day=${(today.date() + '').padStart(2, '0')}`,
        }
        let arrayOfFiles = await getFilesPath(optionsToday);
        if (arrayOfFiles.length < NUMBER_OF_HOURS) {
            let yesterdayArrayOfFiles = await getFilesPath(optionsYesterday);
            arrayOfFiles = yesterdayArrayOfFiles.slice(-1 * (NUMBER_OF_HOURS - arrayOfFiles.length)).concat(arrayOfFiles);
        }

        //get all runRate data
        const data = await Promise.all(arrayOfFiles.map(x => downloadStringFromS3('exon-media', x)));
        const runRate = getRunRateAdapter(data);
        //console.dir(runRate)
        return runRate;
    }
    const automateDomain = async (row) => {
        const {id, kpi, timeZone} = row;
        const getTrend = (roiData) => {
            let trendCode = 0; // -1 down, 0 nothing, 1 up
            for (let i = 1; i < roiData.length; i++) {
                if (roiData[i - 1] == roiData[i]) return 0; //nothing to do, its same value
                //set trend
                if (i == 1) {
                    if (roiData[i - 1] > roiData[i]) trendCode = -1;
                    else trendCode = 1;
                    continue;
                }
                if (roiData[i - 1] > roiData[i] && trendCode != -1) return 0; //nothing
                if (roiData[i - 1] < roiData[i] && trendCode != 1) return 0; //nothing
            }
            return trendCode;
        }
        const increaseTrending = (data) =>
        {
            let daily = _.last(data).ROI;
            if (daily>=kpi+10) addDomainResult(id, 'open', 4);
            else if (kpi+10 > daily && daily>=kpi) addDomainResult(id, 'do nothing', 3);
            else if (daily<kpi) addDomainResult(id, 'close', 4);
        }
        const decreaseTrending = (data) => {
            let daily = _.last(data).ROI;
            if (kpi+20 > daily && daily>kpi+10) addDomainResult(id, 'do nothing, alert:"daily ROI decreases, keep tracking, might need to open"', 5);
            else if (daily > kpi+20) addDomainResult(id, 'open, alert:"high daily ROI, but keep in mind daily ROI decreases"', 5);
            else if (kpi<daily && daily<=kpi+10) addDomainResult(id, 'close', 4);
        }
        let data = runRateData[id]; //data from run rate
        if (!data) {
            addDomainResult(id, 'No data found for project', 1);
            return;
        }
        if (data.length < 3) {
            addDomainResult(id, 'Not enough data found for project, found only: ' + data.length + ' rows instead of 3 rows', 1);
            return;
        }
        // validation finished
        let trend = getTrend(data.map(x=>x.ROI));
        if (trend == 0) {
            addDomainResult(id, 'No trend, do nothing', 2);
            return;
        }
        if (trend == 1) increaseTrending(data);
        else decreaseTrending(data);
    };

    const init = async () => {
        results = []; //clear in case its second iteration
        runRateData = await downloadRunRate();

        //get all configuration
        let domainsConfigurationArray = await configuration.get();
        //domainsConfigurationArray = domainsConfigurationArray.filter(x=>x.id=='5-top.co.uk')
        for (let row of domainsConfigurationArray) {
            const {id, kpi, timeZone} = row;
            console.log('Handle:', id, kpi, timeZone)
            const currentDateTime = moment().utcOffset(timeZone);
            if (currentDateTime.hour() < 9 || currentDateTime.hour() > 22) {
                await addDomainResult(id, 'Not in working hours', 0);
            } else await automateDomain(row);
        }
        //notification
        results =  _.orderBy(results, ['priority', 'domain'], ['desc', 'asc']);

        return results;

    };

    return {init};
}
exports.module = automationModule;