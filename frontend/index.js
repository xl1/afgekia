//@ts-check
//@ts-ignore
import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.esm.browser.js';

const api = {
    list() {
        return fetch('/api/list').then(r => r.json());
    },
    restart(item, body) {
        return fetch('/api/restart', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-requested-with': 'fetch'
            },
            body: JSON.stringify({ item, body }),
        }).then(r => r.ok);
    }
};

new Vue({
    el: '#list',
    data: {
        items: []
    },
    methods: {
        /** @param {import('../src/models.js').FunctionModel} item */
        triggerDescription(item) {
            let s = '';
            if (item.trigger) {
                for (const [key, value] of Object.entries(item.trigger)) {
                    s += `${key}: ${value}\n`
                }
            }
            return s;
        },
        /** @param {string} id */
        logHref(id) {
            return `https://portal.azure.com/#blade/WebsitesExtension/FunctionMenuBlade/monitor/resourceId/${encodeURIComponent(id)}`;
        },
        /** @param {import('../src/models.js').FunctionModel} item */
        async run(item) {
            const body = window.prompt(`Restarting function "${item.name}"\nRequest body:`, '{}');
            if (body != null) {
                if (await api.restart(item, body)) {
                    window.alert('Accepted');
                }
            }
        }
    },
    async created() {
        this.items = await api.list();
    }
});
