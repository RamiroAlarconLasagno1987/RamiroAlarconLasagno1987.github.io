class TopicViewer extends HTMLElement {
    static get observedAttributes() {
        return ['filter']; // Lista de atributos que el elemento observa para cambios.
    }

    constructor() {
        super(); // Llama al constructor de la clase padre HTMLElement.
        this.attachShadow({ mode: 'open' }); // Activa el shadow DOM para este componente.
        this.shadowRoot.innerHTML = `
            <style>
                #messageDisplay { height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 8px; }
                select, #messageDisplay, input { width: 100%; box-sizing: border-box; margin-bottom: 8px; }
            </style>
            <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
            <select id="topicSelector"></select>
            <div id="messageDisplay"></div>
        `;
        this.topicos = new Map(); // Almacena los mensajes organizados por tópico.
        this.cliente = null; // Cliente MQTT, inicializado en null.
        this.filtroDeBusqueda = ''; // Filtro para la búsqueda en tópicos, inicialmente vacío.
    }

    connectedCallback() {
        this.selectorDeTopicos = this.shadowRoot.getElementById('topicSelector');
        this.visualizadorDeMensajes = this.shadowRoot.getElementById('messageDisplay');
        this.busquedaDeTopicos = this.shadowRoot.getElementById('topicSearch');

        // Manejador de eventos para actualizar el filtro de búsqueda.
        this.busquedaDeTopicos.addEventListener('input', () => {
            this.filtroDeBusqueda = this.busquedaDeTopicos.value.trim();
        });

        // Manejador de eventos para cambiar la visualización de mensajes al seleccionar otro tópico.
        this.selectorDeTopicos.addEventListener('change', () => {
            this.mostrarMensajes(this.selectorDeTopicos.value);
        });

        this.inicializarMQTT(); // Inicializa la configuración MQTT al conectar el componente.
    }

    attributeChangedCallback(nombre, valorAntiguo, valorNuevo) {
        if (nombre === 'filter' && valorNuevo && this.cliente) {
            this.suscribirATopicos(valorNuevo); // Reacciona a cambios en el atributo 'filter'.
        }
    }

    inicializarMQTT() {
        const idCliente = `web_${Math.random().toString(16).slice(2, 10)}`; // Genera un ID único para el cliente MQTT.
        this.cliente = new Paho.MQTT.Client("35.209.22.11", 9090, idCliente);

        // Define el manejo de la pérdida de conexión con el broker MQTT.
        this.cliente.onConnectionLost = respuesta => {
            if (respuesta.errorCode !== 0) {
                console.log("Conexión perdida:", respuesta.errorMessage);
            }
        };

        // Establece cómo se manejarán los mensajes recibidos.
        this.cliente.onMessageArrived = this.manejarMensajeRecibido.bind(this);

        // Conecta al cliente MQTT con configuración para intentar la conexión.
        this.cliente.connect({
            useSSL: false, // Define si se utiliza SSL para la conexión (aquí no se usa).
            onSuccess: () => {
                console.log("Conexión MQTT exitosa");
                // Se suscribe a los tópicos especificados en el atributo 'filter' si está presente.
                if (this.hasAttribute('filter')) {
                    this.suscribirATopicos(this.getAttribute('filter'));
                }
            },
            onFailure: (error) => {
                console.log("Conexión MQTT fallida: " + error.errorMessage);
            }
        });
    }

    suscribirATopicos(filtro) {
        this.cliente.subscribe(filtro, { qos: 1 }); // El cliente se suscribe al filtro de tópicos con QoS 1.
    }

    manejarMensajeRecibido(mensaje) {
        this.agregarMensaje(mensaje); // Procesa cada mensaje recibido.
    }

    agregarMensaje(mensaje) {
        const topicoCompleto = mensaje.destinationName;
        const filtroBase = this.getAttribute('filter');

        // Condiciones para ignorar mensajes de tópicos más profundos según el filtro.
        if (filtroBase.includes('GPRS/') && !filtroBase.includes('id-base/') && topicoCompleto.split('/').length > filtroBase.split('/').length + 1) {
            console.log("Tópico más profundo detectado y omitido: " + topicoCompleto);
            return;
        }

        const topico = topicoCompleto.substring(topicoCompleto.lastIndexOf('/') + 1);
        if (!this.topicos.has(topico)) {
            const opcion = document.createElement('option');
            opcion.value = topico;
            opcion.textContent = topico;
            this.selectorDeTopicos.appendChild(opcion);
        }
        if (!this.topicos.get(topico)) {
            this.topicos.set(topico, []);
        }
        this.topicos.get(topico).push(mensaje.payloadString);
        if (this.selectorDeTopicos.value === topico) {
            this.mostrarMensajes(topico);
        }

        // Alerta si el mensaje coincide con el filtro de búsqueda.
        if (this.filtroDeBusqueda && topicoCompleto.includes(this.filtroDeBusqueda)) {
            alert(`Mensaje nuevo en tópico que coincide con la búsqueda: ${topicoCompleto}`);
        }
    }

    mostrarMensajes(topico) {
        const mensajes = this.topicos.get(topico) || [];
        this.visualizadorDeMensajes.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
    }
}

// Define el componente 'topic-viewer' en el espacio de nombres de elementos personalizados.
customElements.define('topic-viewer', TopicViewer);
