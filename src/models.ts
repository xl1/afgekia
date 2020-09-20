export type FunctionModel = {
    id: string;
    appName: string;
    name: string;
    trigger: undefined | {
        type: string;
        [key: string]: unknown;
    };
    enabled: boolean;
    lastExecuted: Date | undefined;
};

export type TimerTriggerStatus = {
    Last: string,
    Next: string,
    LastUpdated: string,
};
