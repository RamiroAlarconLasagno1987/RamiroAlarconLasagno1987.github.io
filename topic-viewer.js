class TopicViewer extends HTMLElement {
    // Define qué atributos deben observarse para cambios
    static get observedAttributes() {
        return ['filter'];
    }

    constructor() {
        super();
        this.inicializarComponente();
    }

    // Inicializa componentes esenciales para el funcionamiento del custom element
    inicializarComponente() {
        this.attachShadow({ mode: 'open' });
        this.cargarCSS();
        this.configurarHTML();
        this.inicializarVariables();
        this.solicitarPermisoNotificaciones(); // Solicita permiso para notificaciones
    }

    // Solicita permisos para notificaciones
    solicitarPermisoNotificaciones() {
        if ("Notification" in window) {
            Notification.requestPermission().then(permiso => {
                if (permiso === "granted") {
                    console.log("Permiso de notificación concedido");
                } else {
                    console.log("Permiso de notificación denegado");
                }
            });
        }
    }

    // Carga el CSS desde un archivo externo
    cargarCSS() {
        fetch('topic-viewer.css')
            .then(respuesta => respuesta.text())
            .then(css => this.aplicarEstilos(css));
    }

    // Aplica estilos CSS al shadow DOM
    aplicarEstilos(css) {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.appendChild(style);
    }

    // Configura el HTML inicial del componente
    configurarHTML() {
        this.shadowRoot.innerHTML = `
            <div class="input-container">
                <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
                <button id="searchButton">Aceptar</button>
            </div>
            <select id="topicSelector"></select>
            <div id="messageDisplay"></div>
        `;
    }

    // Inicializa variables necesarias para el funcionamiento del componente
    inicializarVariables() {
        this.topics = new Map();
        this.lastUpdateTime = new Map();
        this.client = null;
        this.searchFilter = '';
    }

    // Configura elementos y eventos una vez el elemento está conectado al DOM
    connectedCallback() {
        this.configurarElementos();
        this.adjuntarManejadoresEventos();
        this.inicializarMQTT();
    }

    // Asigna elementos del DOM a variables para fácil acceso
    configurarElementos() {
        this.topicSelector = this.shadowRoot.getElementById('topicSelector');
        this.messageDisplay = this.shadowRoot.getElementById('messageDisplay');
        this.topicSearch = this.shadowRoot.getElementById('topicSearch');
        this.searchButton = this.shadowRoot.getElementById('searchButton');
    }

   // Adjunta manejadores de eventos a los elementos relevantes
adjuntarManejadoresEventos() {
    this.searchButton.addEventListener('click', () => this.manejarClickBotonBuscar());

    // Manejador de evento 'change' modificado para actualizar el color de fondo del select
    this.topicSelector.addEventListener('change', () => {
        this.mostrarMensajes(this.topicSelector.value);

        // Captura el color de fondo del option seleccionado
        const selectedOption = this.topicSelector.options[this.topicSelector.selectedIndex];
        const selectedColor = selectedOption.style.backgroundColor;

        // Asigna el color de fondo del option al select
        this.topicSelector.style.backgroundColor = selectedColor;
    });
}


    // Maneja el evento de clic en el botón de búsqueda
    manejarClickBotonBuscar() {
        this.searchFilter = this.topicSearch.value.trim();
        if (this.searchFilter) {
            this.buscarTopicos(this.searchFilter);
            console.log('Búsqueda iniciada con:', this.searchFilter);
        } else {
            console.log('No hay término de búsqueda ingresado.');
            this.messageDisplay.innerHTML = ''; // Limpia cualquier mensaje mostrado si la búsqueda está vacía
        }
    }

    // Reacciona a cambios en los atributos observados
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'filter' && newValue && this.client) {
            this.suscribirATopicos(newValue);
        }
    }

    // Inicializa la conexión MQTT
    inicializarMQTT() {
        const clientId = `web_${Math.random().toString(16).slice(2, 10)}`;
        this.client = new Paho.MQTT.Client("well-optimus.rfindustrial.com", 9191, clientId);
    
        this.client.onConnectionLost = respuesta => {
            if (respuesta.errorCode !== 0) {
                console.log("Conexión perdida:", respuesta.errorMessage);
            }
        };
    
        this.client.onMessageArrived = this.manejarMensajeRecibido.bind(this);
    
        this.client.connect({
            useSSL: true,
            onSuccess: () => {
                console.log("Conexión MQTT segura exitosa");
                if (this.hasAttribute('filter')) {
                    this.suscribirATopicos(this.getAttribute('filter'));
                }
                this.iniciarTemporizador();
            },
            onFailure: (error) => {
                console.log("Conexión MQTT segura fallida: " + error.errorMessage);
            }
        });
    }

    // Suscribe a los tópicos especificados por el atributo 'filter'
    suscribirATopicos(filter) {
        this.client.subscribe(filter, { qos: 1 });
    }

    // Maneja la recepción de mensajes MQTT
    manejarMensajeRecibido(message) {
        this.agregarMensaje(message);
        // Verifica si el mensaje coincide con el filtro de búsqueda y si se tienen permisos para notificar
        if (this.searchFilter && message.payloadString.includes(this.searchFilter) && Notification.permission === "granted") {
            this.enviarNotificacion(`Nuevo mensaje en tópico: ${message.destinationName}`, message.payloadString);
        }
    }

    // Envía una notificación al usuario
    enviarNotificacion(titulo, cuerpo) {
        new Notification(titulo, {
            body: cuerpo,
            icon: 'icon_url' // Opcional: URL de un ícono para mostrar en la notificación
        });
    }

    // Añade un mensaje al tópico correspondiente y actualiza el contador
    agregarMensaje(mensaje) {
        const topicComplete = mensaje.destinationName;
        const topic = topicComplete.substring(topicComplete.lastIndexOf('/') + 1);
        this.lastUpdateTime.set(topic, Date.now());

        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.agregarOpcionTopico(topic);
        }

        this.topics.get(topic).push(mensaje.payloadString);
        this.actualizarContadorTopico(topic); // Actualiza el contador en el selector

        if (this.topicSelector.value === topic) {
            this.mostrarMensajes(topic);
        }

        //this.restablecerEstiloTopico(topic); // Restablece el estilo del tópico al color original
    }

    // Restablece el estilo del tópico al color original
    restablecerEstiloTopico(topico) {
        // Seleccionar el elemento select que contiene las opciones
        const select = this.topicSelector;   
        // Buscar la opción específica dentro del select
        const option = select.querySelector(`option[value="${topico}"]`);
        // Verificar si la opción existe
        if (option) {
            // Restablecer el color de fondo de la opción específica al color azul original
            option.style.backgroundColor = '#7ca3cc';           
            // También restablecer el color de fondo del select completo al color azul original
            //select.style.backgroundColor = '#7ca3cc';
        }
    }
    

    // Inicia un temporizador que verifica periódicamente la necesidad de actualizar el estilo de los tópicos
    iniciarTemporizador() {
        setInterval(() => {
            const currentTime = Date.now();
            this.topics.forEach((_, topico) => {
                const lastTime = this.lastUpdateTime.get(topico);
                if (currentTime - lastTime > 180000) { // 3 minutos
                    this.actualizarEstiloTopico(topico, true);
                } else {
                    this.actualizarEstiloTopico(topico, false);
                }
            });
        }, 30000); // Cada medio minuto
    }

    // Actualiza el estilo de un tópico específico según si está actualizado o no
    actualizarEstiloTopico(topico, estaDesactualizado) {
        // Seleccionar el elemento select que contiene las opciones
        const select = this.topicSelector;   
        // Buscar la opción específica dentro del select
        const option = select.querySelector(`option[value="${topico}"]`);    
        // Verificar si la opción existe
        if (option) {
            // Actualizar el color de fondo de la opción específica
            option.style.backgroundColor = estaDesactualizado ? '#e91010' : '#7ca3cc';
            // También actualizar el color de fondo del select completo
            select.style.backgroundColor = estaDesactualizado ? '#e91010' : '#7ca3cc';
        }
    }
    

    // Añade un tópico al selector con un contador inicializado a 0
    agregarOpcionTopico(topico) {
        const option = document.createElement('option');
        option.value = topico;
        option.textContent = `${topico} (0)`;
        this.topicSelector.appendChild(option);
        this.ordenarTopicos();
    }

    // Actualiza el contador de mensajes de un tópico
    actualizarContadorTopico(topico) {
        const mensajes = this.topics.get(topico);
        const option = this.topicSelector.querySelector(`option[value="${topico}"]`);
        if (option) {
            option.textContent = `${topico} ----- (${mensajes.length})`;
        }
    }

    // Ordena los tópicos alfabéticamente en el selector
    ordenarTopicos() {
        const options = Array.from(this.topicSelector.options);
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.topicSelector.innerHTML = '';
        options.forEach(option => this.topicSelector.appendChild(option));
    }

    // Muestra los mensajes de un tópico específico
    mostrarMensajes(topico) {
        const mensajes = this.topics.get(topico) || [];
        this.messageDisplay.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
    }


}

customElements.define('topic-viewer', TopicViewer);
