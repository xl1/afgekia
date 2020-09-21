import { loginWithAuthFileWithAuthResponse, loginWithAppServiceMSI } from '@azure/ms-rest-nodeauth';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { Site } from '@azure/arm-appservice/esm/models';
import { BlobServiceClient } from '@azure/storage-blob';
import { FunctionModel, TimerTriggerStatus } from './models';
import { cache } from './cache';
import fetch from 'node-fetch';
require('dotenv').config();

const environment = process.env['ENVIRONMENT'];
const subscriptionId = process.env['AZURE_SUBSCRIPTION_ID']!;

async function createClient() {
    if (environment === 'production') {
        const msiToken = await loginWithAppServiceMSI();
        return new WebSiteManagementClient(msiToken, subscriptionId);
    } else {
        const { credentials } = await loginWithAuthFileWithAuthResponse({
            filePath: './servicePrincipal.json'
        });
        return new WebSiteManagementClient(credentials, subscriptionId);
    }
}

function getFunctionApps() {
    return cache.get('getFunctionApps', async () => {
        const client = await createClient();
        const webApps = await client.webApps.list();
        return {
            client,
            apps: webApps.filter(app => app.kind === 'functionapp')
        };
    });
}

async function list(client: WebSiteManagementClient, app: Site): Promise<FunctionModel[]> {
    const { properties } = await client.webApps.listApplicationSettings(app.resourceGroup!, app.name!);
    const containerClient = BlobServiceClient
        .fromConnectionString(properties!.AzureWebJobsStorage)
        .getContainerClient('azure-webjobs-hosts');

    const funcs = await client.webApps.listFunctions(app.resourceGroup!, app.name!);
    const promises = funcs.map(async f => {
        const bindings = f.config.bindings as { type: string }[];
        const trigger = bindings?.find(e => e.type.endsWith('Trigger'));
        const functionName = f.name!.slice(app.name!.length + 1);

        let status;
        if (trigger && trigger.type === 'timerTrigger') {
            const path = `timers/${app.name}/${f.config.entryPoint || `Host.Functions.${functionName}`}/status`;
            const buffer = await containerClient.getBlockBlobClient(path).downloadToBuffer();
            status = JSON.parse(buffer.toString('utf-8')) as TimerTriggerStatus;
        }
        return {
            id: f.id!,
            resourceGroup: app.resourceGroup!,
            appName: app.name!,
            name: functionName,
            enabled: app.enabled! && !f.isDisabled && !f.config.disabled,
            lastExecuted: status ? new Date(status.Last) : undefined,
            trigger,
        };
    });
    return Promise.all(promises);
}

export async function getFunctions(): Promise<FunctionModel[]> {
    const { client, apps } = await getFunctionApps();
    const functions = await Promise.all(apps.map(e => list(client, e)));
    return functions.flatMap(e => e);
}

export async function restartFunction(item: FunctionModel, body: string): Promise<void> {
    const { client } = await getFunctionApps();
    const { href } = await client.webApps.getFunction(item.resourceGroup, item.appName, item.name);
    if (!href) throw new Error('Function not found');

    const { masterKey } = await client.webApps.listHostKeys(item.resourceGroup, item.appName);
    const response = await fetch(href!, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-functions-key': masterKey!
        },
        body
    });
    if (response.ok) return;
    throw new Error(await response.text());
}
