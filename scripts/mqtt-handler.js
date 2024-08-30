class MQTTHandler {
    constructor(clientId, onMessageCallback, onConnectionLostCallback) {
        this.client = new Paho.MQTT.Client("well-optimus.rfindustrial.com", 9191, clientId);
        this.onMessageCallback = onMessageCallback;
        this.onConnectionLostCallback = onConnectionLostCallback;
        this.subscriptionQueue = [];
        this.isConnected = false;
        this.connect();
    }

    connect() {
        this.client.onConnectionLost = (responseObject) => {
            console.log("Conexion perdida:", responseObject.errorMessage);
            this.isConnected = false;
            // Intentar reconectar después de 5 segundos
            setTimeout(() => {
                console.log("Intentando reconectar...");
                this.connect();
            }, 5000);
        };
        this.client.onMessageArrived = this.onMessageCallback;
    
        this.client.connect({
            useSSL: true,
            onSuccess: () => {
                console.log("Conexión MQTT segura exitosa");
                this.isConnected = true;
                this.processSubscriptionQueue();
            },
            onFailure: (error) => {
                console.log("Conexión MQTT segura fallida: " + error.errorMessage);
                // Intentar reconectar después de 5 segundos
                setTimeout(() => {
                    console.log("Intentando reconectar...");
                    this.connect();
                }, 5000);
            }
        });
    }
    

    subscribe(filter) {
        if (this.isConnected) {
            this.client.subscribe(filter, { qos: 1 });
        } else {
            this.subscriptionQueue.push(filter);
        }
    }

    processSubscriptionQueue() {
        while (this.subscriptionQueue.length > 0) {
            const filter = this.subscriptionQueue.shift();
            this.client.subscribe(filter, { qos: 1 });
        }
    }
}

export default MQTTHandler;
