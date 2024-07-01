class TopicViewer extends HTMLElement {
    // Define qué atributos deben observarse para cambios
    static get observedAttributes() {
        return ['filter'];
    }

    constructor() {
        super();
        this.initializeComponent();
    }

    // Inicializa componentes esenciales para el funcionamiento del custom element
    initializeComponent() {
        this.attachShadow({ mode: 'open' });
        this.loadCSS();
        this.setupHTML();
        this.initializeVariables();
        this.requestNotificationPermission(); // Solicita permiso para notificaciones
    }

    // Solicita permisos para notificaciones
    requestNotificationPermission() {
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Permiso de notificación concedido");
                } else {
                    console.log("Permiso de notificación denegado");
                }
            });
        }
    }

    // Carga el CSS desde un archivo externo
    loadCSS() {
        fetch('topic-viewer.css')
            .then(response => response.text())
            .then(css => this.applyStyles(css));
    }

    // Aplica estilos CSS al shadow DOM
    applyStyles(css) {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.appendChild(style);
    }

    // Configura el HTML inicial del componente
    setupHTML() {
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
    initializeVariables() {
        this.topics = new Map();
        this.lastUpdateTime = new Map(); // Mapa para el tiempo de última actualización de mensajes
        this.client = null;
        this.searchFilter = '';
    }

    // Configura elementos y eventos una vez el elemento está conectado al DOM
    connectedCallback() {
        this.setupElements();
        this.attachEventListeners();
        this.initializeMQTT();
    }

    // Asigna elementos del DOM a variables para fácil acceso
    setupElements() {
        this.topicSelector = this.shadowRoot.getElementById('topicSelector');
        this.messageDisplay = this.shadowRoot.getElementById('messageDisplay');
        this.topicSearch = this.shadowRoot.getElementById('topicSearch');
        this.searchButton = this.shadowRoot.getElementById('searchButton');
    }

    // Adjunta manejadores de eventos a los elementos relevantes
    attachEventListeners() {
        this.searchButton.addEventListener('click', () => this.handleSearchButtonClick());
        this.topicSelector.addEventListener('change', () => this.displayMessages(this.topicSelector.value));
    }

    // Maneja el evento de clic en el botón de búsqueda
// Maneja el evento de clic en el botón de búsqueda
    handleSearchButtonClick() {
    this.searchFilter = this.topicSearch.value.trim();
    if (this.searchFilter) {
        this.searchTopics(this.searchFilter);
        console.log('Búsqueda iniciada con:', this.searchFilter);
    } else {
        console.log('No hay término de búsqueda ingresado.');
        this.messageDisplay.innerHTML = ''; // Limpia cualquier mensaje mostrado si la búsqueda está vacía
    }
}


    // Reacciona a cambios en los atributos observados
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'filter' && newValue && this.client) {
            this.subscribeToTopics(newValue);
        }
    }

    // Inicializa la conexión MQTT
    initializeMQTT() {
        const clientId = `web_${Math.random().toString(16).slice(2, 10)}`;
        this.client = new Paho.MQTT.Client("well-optimus.rfindustrial.com", 9191, clientId);
    
        this.client.onConnectionLost = response => {
            if (response.errorCode !== 0) {
                console.log("Conexión perdida:", response.errorMessage);
            }
        };
    
        this.client.onMessageArrived = this.handleMessageReceived.bind(this);
    
        this.client.connect({
            useSSL: true,
            onSuccess: () => {
                console.log("Conexión MQTT segura exitosa");
                if (this.hasAttribute('filter')) {
                    this.subscribeToTopics(this.getAttribute('filter'));
                }
                this.startTimer();
            },
            onFailure: (error) => {
                console.log("Conexión MQTT segura fallida: " + error.errorMessage);
            }
        });
    }

    // Suscribe a los tópicos especificados por el atributo 'filter'
    subscribeToTopics(filter) {
        this.client.subscribe(filter, { qos: 1 });
    }

    // Maneja la recepción de mensajes MQTT
    handleMessageReceived(message) {
        this.addMessage(message);
        // Verifica si el mensaje coincide con el filtro de búsqueda y si se tienen permisos para notificar
        if (this.searchFilter && message.payloadString.includes(this.searchFilter) && Notification.permission === "granted") {
            this.sendNotification(`Nuevo mensaje en tópico: ${message.destinationName}`, message.payloadString);
        }
    }

    // Envía una notificación al usuario
    sendNotification(title, body) {
    new Notification(title, {
        body: body,
        icon: 'icon_url' // Opcional: URL de un ícono para mostrar en la notificación
    });
}
    // Añade un mensaje al tópico correspondiente y actualiza el contador
    addMessage(message) {
        const topicComplete = message.destinationName;
        const topic = topicComplete.substring(topicComplete.lastIndexOf('/') + 1);
        this.lastUpdateTime.set(topic, Date.now());

        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.addTopicOption(topic);
        }

        this.topics.get(topic).push(message.payloadString);
        this.updateTopicCount(topic); // Actualiza el contador en el selector

        if (this.topicSelector.value === topic) {
            this.displayMessages(topic);
        }

        this.resetTopicStyle(topic); // Restablece el estilo del tópico al color original
    }

    resetTopicStyle(topic) {
        const option = this.topicSelector.querySelector(`option[value="${topic}"]`);
        if (option) {
            option.style.backgroundColor = '#7ca3cc'; // Color azul original
        }
    }

    // Inicia un temporizador que verifica periódicamente la necesidad de actualizar el estilo de los tópicos
    startTimer() {
        setInterval(() => {
            const currentTime = Date.now();
            this.topics.forEach((_, topic) => {
                const lastTime = this.lastUpdateTime.get(topic);
                if (currentTime - lastTime > 300000) {
                    this.updateTopicStyle(topic, true);
                } else {
                    this.updateTopicStyle(topic, false);
                }
            });
        }, 60000);
    }

    // Actualiza el estilo de un tópico específico según si está actualizado o no
    updateTopicStyle(topic, isStale) {
        const option = this.topicSelector.querySelector(`option[value="${topic}"]`);
        if (option) {
            option.style.backgroundColor = isStale ? '#e91010' : '#7ca3cc';
        }
    }

    // Añade un tópico al selector con un contador inicializado a 0
    addTopicOption(topic) {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = `${topic} (0)`;
        this.topicSelector.appendChild(option);
        this.sortTopics();
    }

    // Actualiza el contador de mensajes de un tópico
    updateTopicCount(topic) {
        const messages = this.topics.get(topic);
        const option = this.topicSelector.querySelector(`option[value="${topic}"]`);
        if (option) {
            option.textContent = `${topic} ----- (${messages.length})`;
        }
    }

    // Ordena los tópicos alfabéticamente en el selector
    sortTopics() {
        const options = Array.from(this.topicSelector.options);
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.topicSelector.innerHTML = '';
        options.forEach(option => this.topicSelector.appendChild(option));
    }

    // Busca tópicos que coincidan con el término de búsqueda ingresado
    searchTopics(searchTerm) {
        const foundTopic = Array.from(this.topicSelector.options).find(option => option.value.endsWith(searchTerm));
        if (foundTopic) {
            this.topicSelector.value = foundTopic.value;
            this.displayMessages(foundTopic.value);
        } else {
            console.log('No se encontró ningún tópico que coincida con la búsqueda del último segmento.');
        }
    }

    // Muestra los mensajes de un tópico específico
    displayMessages(topic) {
        const messages = this.topics.get(topic) || [];
        this.messageDisplay.innerHTML = messages.map(message => `<div>${message}</div>`).join('');
    }
}

customElements.define('topic-viewer', TopicViewer);
