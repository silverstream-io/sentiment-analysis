type EventCallback = (data: any) => void;

class EventBus {
    private static instance: EventBus;
    private subscribers: { [key: string]: EventCallback[] } = {};
    private zafClient: any;

    private constructor() {}

    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    initialize(zafClient: any) {
        this.zafClient = zafClient;
        // Set up client.trigger listener
        this.zafClient.on('sentiment.updated', (data: any) => {
            this.publish('sentiment.updated', data);
        });
    }

    subscribe(event: string, callback: EventCallback) {
        if (!this.subscribers[event]) {
            this.subscribers[event] = [];
        }
        this.subscribers[event].push(callback);
    }

    unsubscribe(event: string, callback: EventCallback) {
        if (!this.subscribers[event]) return;
        this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    }

    publish(event: string, data: any) {
        if (!this.subscribers[event]) return;
        this.subscribers[event].forEach(callback => callback(data));
    }

    trigger(event: string, data: any) {
        if (this.zafClient) {
            this.zafClient.trigger(event, data);
        }
    }
}

export const eventBus = EventBus.getInstance();
