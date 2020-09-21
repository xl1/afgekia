import { Context, HttpRequest } from '@azure/functions';
import { restartFunction } from './operations';
import { json, err } from './response';

export default async function (context: Context, req: HttpRequest) {
    const { item, body } = req.body;
    context.res = await restartFunction(item, body)
        .then(() => json(true))
        .catch(e => err(500, e.message || 'Failed to run the function'));
}
