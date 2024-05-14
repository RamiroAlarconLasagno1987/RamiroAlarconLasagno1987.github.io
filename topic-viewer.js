class TopicViewer extends HTMLElement {
    static get observedAttributes() {
        return ['filter']; // Lista de atributos que el elemento observa para cambios.
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.loadCSS();
        this.shadowRoot.innerHTML = `
            <div class="input-container">
                <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
                <button id="searchButton">Aceptar</button>
            </div>
            <select id="topicSelector"></select>
            <div id="messageDisplay"></div>
        `;
        this.topicos = new Map();
        this.cliente = null;
        this.filtroDeBusqueda = '';
    }

    loadCSS() {
        fetch('topic-viewer.css')
            .then(response => response.text())
            .then(css => {
                const style = document.createElement('style');
                style.textContent = css;
                this.shadowRoot.appendChild(style);
            });
    }

    connectedCallback() {
        this.selectorDeTopicos = this.shadowRoot.getElementById('topicSelector');
        this.visualizadorDeMensajes = this.shadowRoot.getElementById('messageDisplay');
        this.busquedaDeTopicos = this.shadowRoot.getElementById('topicSearch');
        this.botonDeBusqueda = this.shadowRoot.getElementById('searchButton');

        this.botonDeBusqueda.addEventListener('click', () => {
            this.filtroDeBusqueda = this.busquedaDeTopicos.value.trim();
            if (this.filtroDeBusqueda) {
                this.buscarEnTopicos(this.filtroDeBusqueda);
            } else {
                console.log('No hay término de búsqueda ingresado.');
            }
        });

        this.selectorDeTopicos.addEventListener('change', () => {
            this.mostrarMensajes(this.selectorDeTopicos.value);
        });

        this.inicializarMQTT();
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
            this.ordenarTopicos();
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

    ordenarTopicos() {
        const opciones = Array.from(this.selectorDeTopicos.options);
        opciones.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.selectorDeTopicos.innerHTML = '';
        opciones.forEach(opcion => this.selectorDeTopicos.appendChild(opcion));
    }

    buscarEnTopicos(terminoDeBusqueda) {
        const opciones = Array.from(this.selectorDeTopicos.options);
        const topicoEncontrado = opciones.find(opcion => opcion.value.includes(terminoDeBusqueda));
        if (topicoEncontrado) {
            this.selectorDeTopicos.value = topicoEncontrado.value;
            this.mostrarMensajes(topicoEncontrado.value);
        } else {
            console.log('No se encontró ningún tópico que coincida con la búsqueda.');
        }
    }

    mostrarMensajes(topico) {
        const mensajes = this.topicos.get(topico) || [];
        this.visualizadorDeMensajes.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
    }
}

// Define el componente 'topic-viewer' en el espacio de nombres de elementos personalizados.
customElements.define('topic-viewer', TopicViewer);
