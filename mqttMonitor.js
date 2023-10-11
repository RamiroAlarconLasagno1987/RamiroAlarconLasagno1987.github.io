const MQTT_CONFIG = {
    brokerURL: "oilthink.emic.io",
    brokerPort: 9090,
    qos: 1,
    clientIDLength: 10
};

// Función para generar un ID de cliente aleatorio
function generateClientID(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let clientID = "";
    for (let i = 0; i < length; i++) {
        clientID += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return clientID;
}

// Función para recibir datos desde un topic específico del broker MQTT
function listenToTopic(topicName, elementId) {
    // Generar un nuevo ID de cliente aleatorio
    const clientID = generateClientID(MQTT_CONFIG.clientIDLength);

    // Crear un nuevo cliente MQTT
    const client = new Paho.MQTT.Client(
        MQTT_CONFIG.brokerURL,
        MQTT_CONFIG.brokerPort,
        clientID
    );

    // Configuración de conexión segura
    const options = {
        useSSL: true,
        onSuccess: function () {
            console.log("Conexión al broker MQTT exitosa");
            client.subscribe(topicName, { qos: MQTT_CONFIG.qos });
            console.log("Suscrito al topic:", topicName);
        },
        onFailure: function (message) {
            console.error("Error al conectarse al broker MQTT: " + message.errorMessage);
        },
    };

    // Conectar el cliente MQTT
    client.connect(options);

    // Función para manejar los mensajes entrantes
    client.onMessageArrived = function (message) {
        console.log("Mensaje recibido del topic:", message.destinationName);
        console.log("Contenido del mensaje:", message.payloadString);
    
        let data;
        try {
            data = JSON.parse(message.payloadString);
        } catch {
            data = message.payloadString;
        }
    
        // Agregar el nuevo mensaje después de un salto de línea si el elemento ya tiene contenido
        const existingData = document.getElementById(elementId).innerText;
        if (existingData !== "Esperando datos...") {
            document.getElementById(elementId).innerText += "\n" + JSON.stringify(data);
        } else {
            document.getElementById(elementId).innerText = JSON.stringify(data);
        }
    }; // Faltaba esta llave
} // Faltaba esta llave

// Escuchar a los tres topics
listenToTopic("capsa/connected", "topic1-data");
listenToTopic("test/dyna/despierta", "topic2-data");
listenToTopic("test/getway/reporta", "topic3-data");
listenToTopic("test/getway/GPRS", "topic4-data");
listenToTopic("capsa/pozo/dyna/config/#", "topic5-data");
listenToTopic("test/dyna/diagnostic/", "topic6-data");