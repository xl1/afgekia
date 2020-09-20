import { Context } from '@azure/functions';
import { getFunctions } from './operations';
import { json } from './response';

export default async function (context: Context) {
    const functions = await getFunctions();
    context.res = json(functions);
}
