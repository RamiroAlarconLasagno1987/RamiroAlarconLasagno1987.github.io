class TopicViewer extends HTMLElement {
    // Retorna los atributos que este componente observará para cambios.
    static get observedAttributes() {
        return ['filter']; // 'filter' indica el filtro de tópicos MQTT que observa el componente.
    }

    constructor() {
        super();  // Llama al constructor de HTMLElement.
        this.attachShadow({ mode: 'open' }); // Crea un shadow DOM para encapsulación de estilos y estructura.
        this.loadCSS();  // Carga el CSS para este componente desde un archivo externo.
        // Inicializa el HTML interno del shadow DOM.
        this.shadowRoot.innerHTML = `
            <div class="input-container">
                <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
                <button id="searchButton">Aceptar</button>
            </div>
            <select id="topicSelector"></select>
            <div id="messageDisplay"></div>
        `;
        this.topicos = new Map(); // Inicializa un mapa para almacenar los mensajes por tópicos.
        this.cliente = null; // Variable para el cliente MQTT.
        this.filtroDeBusqueda = ''; // Filtro de búsqueda inicial vacío.
    }

    // Método para cargar el CSS desde un archivo externo.
    loadCSS() {
        fetch('topic-viewer.css')  // Realiza una petición para obtener el CSS.
            .then(response => response.text())  // Procesa la respuesta a texto.
            .then(css => {
                const style = document.createElement('style'); // Crea un elemento <style>.
                style.textContent = css; // Establece el contenido del CSS.
                this.shadowRoot.appendChild(style); // Añade el <style> al shadow DOM.
            });
    }

    // Método llamado cuando el elemento es añadido al DOM.
    connectedCallback() {
        // Accede a elementos internos del shadow DOM.
        this.selectorDeTopicos = this.shadowRoot.getElementById('topicSelector');
        this.visualizadorDeMensajes = this.shadowRoot.getElementById('messageDisplay');
        this.busquedaDeTopicos = this.shadowRoot.getElementById('topicSearch');
        this.botonDeBusqueda = this.shadowRoot.getElementById('searchButton');

        // Añade un manejador de eventos para buscar tópicos.
        this.botonDeBusqueda.addEventListener('click', () => {
            this.filtroDeBusqueda = this.busquedaDeTopicos.value.trim();
            if (this.filtroDeBusqueda) {
                this.buscarEnTopicos(this.filtroDeBusqueda);
            } else {
                console.log('No hay término de búsqueda ingresado.');
            }
        });

        // Añade un manejador para actualizar mensajes mostrados cuando cambia el selector.
        this.selectorDeTopicos.addEventListener('change', () => {
            this.mostrarMensajes(this.selectorDeTopicos.value);
        });

        // Inicializa la conexión MQTT.
        this.inicializarMQTT();
    }

    // Método llamado cuando uno de los atributos observados cambia.
    attributeChangedCallback(nombre, valorAntiguo, valorNuevo) {
        if (nombre === 'filter' && valorNuevo && this.cliente) {
            this.suscribirATopicos(valorNuevo);  // Suscribe al cliente MQTT al nuevo filtro.
        }
    }

    // Inicializa el cliente MQTT y define comportamientos de conexión y mensajes.
    inicializarMQTT() {
        const idCliente = `web_${Math.random().toString(16).slice(2, 10)}`; // Genera un ID único.
        this.cliente = new Paho.MQTT.Client("35.209.22.11", 9090, idCliente);
        // Define el manejo de pérdida de conexión.
        this.cliente.onConnectionLost = respuesta => {
            if (respuesta.errorCode !== 0) {
                console.log("Conexión perdida:", respuesta.errorMessage);
            }
        };
        // Manejo de mensajes recibidos.
        this.cliente.onMessageArrived = this.manejarMensajeRecibido.bind(this);
        // Intento de conexión con el broker MQTT.
        this.cliente.connect({
            useSSL: false,  // Especifica si usar SSL.
            onSuccess: () => {
                console.log("Conexión MQTT exitosa");
                if (this.hasAttribute('filter')) {
                    this.suscribirATopicos(this.getAttribute('filter'));
                }
            },
            onFailure: (error) => {
                console.log("Conexión MQTT fallida: " + error.errorMessage);
            }
        });
    }

    // Suscribe al cliente MQTT al filtro especificado.
    suscribirATopicos(filtro) {
        this.cliente.subscribe(filtro, { qos: 1 }); // Suscripción con Calidad de Servicio 1.
    }

    // Maneja cada mensaje MQTT recibido.
    manejarMensajeRecibido(mensaje) {
        this.agregarMensaje(mensaje);  // Agrega el mensaje al mapa de tópicos.
    }

    // Agrega un mensaje al almacenamiento interno y actualiza la visualización si es necesario.
    agregarMensaje(mensaje) {
        const topicoCompleto = mensaje.destinationName;
        const topico = topicoCompleto.substring(topicoCompleto.lastIndexOf('/') + 1);

        // Evita agregar mensajes de tópicos no relevantes.
        if (!this.topicos.has(topico)) {
            const opcion = document.createElement('option');
            opcion.value = topico;
            opcion.textContent = topico;
            this.selectorDeTopicos.appendChild(opcion);
            this.ordenarTopicos(); // Ordena las opciones del selector.
        }
        if (!this.topicos.get(topico)) {
            this.topicos.set(topico, []);
        }
        this.topicos.get(topico).push(mensaje.payloadString);
        if (this.selectorDeTopicos.value === topico) {
            this.mostrarMensajes(topico);
        }
    }

    // Ordena las opciones del selector de tópicos alfabéticamente.
    ordenarTopicos() {
        const opciones = Array.from(this.selectorDeTopicos.options);
        opciones.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.selectorDeTopicos.innerHTML = '';
        opciones.forEach(opcion => this.selectorDeTopicos.appendChild(opcion));
    }

    // Busca y muestra mensajes del tópico especificado.
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

    // Muestra los mensajes de un tópico específico en el elemento de visualización.
    mostrarMensajes(topico) {
        const mensajes = this.topicos.get(topico) || [];
        this.visualizadorDeMensajes.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
    }
}

// Registra el elemento personalizado.
customElements.define('topic-viewer', TopicViewer);
