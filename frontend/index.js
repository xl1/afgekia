//@ts-check
//@ts-ignore
import Vue from 'https://cdn.jsdelivr.net/npm/vue@2.6.11/dist/vue.esm.browser.js';

const api = {
    list() {
        return fetch('/api/list').then(r => r.json());
    },
    async restart(id) {
        throw new Error('not implemented');
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
            if (window.confirm(`Will you restart ${item.name}`)) {
                await api.restart(item.id);
            }
        }
    },
    async created() {
        this.items = await api.list();
    }
});
