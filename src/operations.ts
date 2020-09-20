import { loginWithAuthFileWithAuthResponse, loginWithAppServiceMSI } from '@azure/ms-rest-nodeauth';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { Site } from '@azure/arm-appservice/esm/models';
import { BlobServiceClient } from '@azure/storage-blob';
import { FunctionModel, TimerTriggerStatus } from './models';
import { cache } from './cache';
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

async function getFunctionApps() {
    const client = await createClient();
    const webApps = await client.webApps.list();
    return {
        client,
        apps: webApps.filter(app => app.kind === 'functionapp')
    };
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
        let status;
        if (trigger && trigger.type === 'timerTrigger') {
            const path = `timers/${app.name}/${f.config.entryPoint}/status`;
            const buffer = await containerClient.getBlockBlobClient(path).downloadToBuffer();
            status = JSON.parse(buffer.toString('utf-8')) as TimerTriggerStatus;
        }
        return {
            id: f.id!,
            appName: app.name!,
            name: f.name!,
            enabled: app.enabled! && !f.isDisabled && !f.config.disabled,
            lastExecuted: status ? new Date(status.Last) : undefined,
            trigger,
        };
    });
    return Promise.all(promises);
}

export async function getFunctions(): Promise<FunctionModel[]> {
    const { client, apps } = await cache.get('functionApps', getFunctionApps);
    const functions = await Promise.all(apps.map(e => list(client, e)));
    return functions.flatMap(e => e);
}
