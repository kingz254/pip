import { generateDerivApiInstance } from './appId';

class ChartAPI {
    api;

    onsocketclose = () => {
        this.reconnectIfNotConnected();
    };

    init = async (force_create_connection = false) => {
        if (!this.api || force_create_connection) {
            if (this.api?.connection) {
                this.api.connection.removeEventListener('close', this.onsocketclose);

            }
            this.api = await generateDerivApiInstance();
            this.api?.connection.addEventListener('close', this.onsocketclose);
        }
        this.getTime();
    };

    getTime() {
        if (!this.time_interval) {
            this.time_interval = setInterval(() => {
                if (this.api.connection.readyState === WebSocket.OPEN) {
                    this.api.send({ ping: 1 }).catch(() => {});
                }
            }, 30000);
        }
    }

    reconnectIfNotConnected = () => {
        // eslint-disable-next-line no-console
        console.log('chart connection state: ', this.api?.connection?.readyState);
        if (this.api?.connection?.readyState && this.api?.connection?.readyState > 1) {
            // eslint-disable-next-line no-console
            console.log('Info: Chart connection to the server was closed, trying to reconnect.');
            this.init(true);
        }
    };
}

const chart_api = new ChartAPI();

export default chart_api;
