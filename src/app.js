require('dotenv').config();
const automationModule = require('./automation.module');
const express = require('express');
const path = require('path');
const app = express();
const notification = require('./notification');
const {json} = require("express");
const bodyParser = require('body-parser')
app.use(express.json());
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));


app.get('/start', async (request, response) => {
    await init();
    return response.send('Finish');
});

app.post('/start', async (request, response) => {

    console.log('Got body:', JSON.stringify(request.body,null,4));
    return response.send('post');
});
 

app.get('/ping', async (request, response) => {
    return response.send('PONG');
});

app.get('/', async (request, response) => {
    return response.send('Microservice is running, if you want to trigger it, please visit /start');
});

app.listen(80, () => {
    console.log('App is listening on port 80');
});

async function init() {
    const automationResult =  await automationModule.module().init();
    await notification.module(automationResult)
    console.log(automationResult)
}
