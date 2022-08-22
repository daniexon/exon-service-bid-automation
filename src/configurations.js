const AWS = require('aws-sdk');
const sql = require('mssql')
const sqlConfig = require('./sqlConfig');

const getOffsetOfCountryCode = () => {
    let x = [];
    x['br'] = {currency: 'BRL', timeOffset: -6};
    x['mx'] = {currency: 'MXN', timeOffset: -8};
    x['us'] = {currency: 'USD', timeOffset: -8};
    x['us2'] = {currency: 'USD', timeOffset: -8}
    x['ca'] = {currency: 'CAD', timeOffset: -8};
    x['sg'] = {currency: 'SGD', timeOffset: 8};
    x['jp'] = {currency: 'JPY', timeOffset: 9};
    x['au'] = {currency: 'AUD', timeOffset: 10};
    x['es'] = {currency: 'EUR', timeOffset: 1};
    x['es2'] = {currency: 'EUR', timeOffset: 1};
    x['gb'] = {currency: 'GBP', timeOffset: 0};
    x['uk'] = {currency: 'GBP', timeOffset: 0};
    x['uk2'] = {currency: 'GBP', timeOffset: 0};


    x['fr'] = {currency: 'EUR', timeOffset: 1};
    x['at'] = {currency: 'EUR', timeOffset: 1};
    x['de'] = {currency: 'EUR', timeOffset: 1};
    x['it'] = {currency: 'EUR', timeOffset: 1};
    x['se'] = {currency: 'SEK', timeOffset: 1};
    x['nl'] = {currency: 'EUR', timeOffset: 1};
    x['pl'] = {currency: 'PLN', timeOffset: 1};
    x['pt'] = {currency: 'EUR', timeOffset: 1};

    return x;
};
const domainToCountryCode = async () => {
    const s3 = new AWS.S3();
    const options = {
        Bucket: 'exon-media',
        Key: 'production/bi/apps/raw/projects/projects.json',
    };
    let data = (await s3.getObject(options).promise()).Body.toString('utf-8');//.promise();
    const json = '[' + data.split('\n').join(',') + ']';
    return JSON.parse(json);
};
const getKPIs = async () => {
    let arr={};
    await sql.connect(sqlConfig)
    const result = await sql.query(`SELECT * FROM  [dbo].[BidAutomation] WHERE KPI IS NOT NULL`);
    result.recordset.map(x=>arr[x.Domain]=x.KPI);
    return arr;
}


const get = async () => {
    let arr = [];

    const kpis=await getKPIs();
    const offset = getOffsetOfCountryCode();
    const obj = await domainToCountryCode();
    obj.map(x => {
            arr.push({...x,
            timeZone: offset[x.countryCode.toLowerCase()] ?   offset[x.countryCode.toLowerCase()].timeOffset :  0,
            kpi: kpis[x.id]? kpis[x.id]: 0
            });
    });

    //filter only items with KPI
    let result = arr.filter(x=>x.kpi>0);
    return result;
}

module.exports = {
    get
};