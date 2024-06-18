class TopicViewer extends HTMLElement {
    static get observedAttributes() {
        return ['filter'];
    }

    constructor() {
        super();
        this.initializeComponent();
    }

    initializeComponent() {
        this.attachShadow({ mode: 'open' });
        this.loadCSS();
        this.setupHTML();
        this.initializeVariables();
    }

    loadCSS() {
        fetch('topic-viewer.css')
            .then(response => response.text())
            .then(css => this.applyStyles(css));
    }

    applyStyles(css) {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.appendChild(style);
    }

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

    initializeVariables() {
        this.topics = new Map();
        this.client = null;
        this.searchFilter = '';
    }

    connectedCallback() {
        this.setupElements();
        this.attachEventListeners();
        this.initializeMQTT();
    }

    setupElements() {
        this.topicSelector = this.shadowRoot.getElementById('topicSelector');
        this.messageDisplay = this.shadowRoot.getElementById('messageDisplay');
        this.topicSearch = this.shadowRoot.getElementById('topicSearch');
        this.searchButton = this.shadowRoot.getElementById('searchButton');
    }

    attachEventListeners() {
        this.searchButton.addEventListener('click', () => this.handleSearchButtonClick());
        this.topicSelector.addEventListener('change', () => this.displayMessages(this.topicSelector.value));
    }

    handleSearchButtonClick() {
        this.searchFilter = this.topicSearch.value.trim();
        this.searchFilter ? this.searchTopics(this.searchFilter) : console.log('No hay término de búsqueda ingresado.');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'filter' && newValue && this.client) {
            this.subscribeToTopics(newValue);
        }
    }

    initializeMQTT() {
        const clientId = `web_${Math.random().toString(16).slice(2, 10)}`;
        // Cambia la dirección IP y el puerto al configurado para SSL/TLS
        this.client = new Paho.MQTT.Client("well-optimus.rfindustrial.com", 9191, clientId);
    
        this.client.onConnectionLost = response => {
            if (response.errorCode !== 0) {
                console.log("Conexión perdida:", response.errorMessage);
            }
        };
    
        this.client.onMessageArrived = this.handleMessageReceived.bind(this);
    
        this.client.connect({
            useSSL: true, // Asegura que se usa SSL
            onSuccess: () => {
                console.log("Conexión MQTT segura exitosa");
                if (this.hasAttribute('filter')) {
                    this.subscribeToTopics(this.getAttribute('filter'));
                }
            },
            onFailure: (error) => {
                console.log("Conexión MQTT segura fallida: " + error.errorMessage);
            }
        });
    }
    

    subscribeToTopics(filter) {
        this.client.subscribe(filter, { qos: 1 });
    }

    handleMessageReceived(message) {
        this.addMessage(message);
    }

    addMessage(message) {
        const topicComplete = message.destinationName;
        const topic = topicComplete.substring(topicComplete.lastIndexOf('/') + 1);

        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.addTopicOption(topic);
        }

        this.topics.get(topic).push(message.payloadString);
        if (this.topicSelector.value === topic) {
            this.displayMessages(topic);
        }
    }

    addTopicOption(topic) {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        this.topicSelector.appendChild(option);
        this.sortTopics();
    }

    sortTopics() {
        const options = Array.from(this.topicSelector.options);
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.topicSelector.innerHTML = '';
        options.forEach(option => this.topicSelector.appendChild(option));
    }

    searchTopics(searchTerm) {
        const foundTopic = Array.from(this.topicSelector.options).find(option => option.value.endsWith(searchTerm));
        if (foundTopic) {
            this.topicSelector.value = foundTopic.value;
            this.displayMessages(foundTopic.value);
        } else {
            console.log('No se encontró ningún tópico que coincida con la búsqueda del último segmento.');
        }
    }

    displayMessages(topic) {
        const messages = this.topics.get(topic) || [];
        this.messageDisplay.innerHTML = messages.map(message => `<div>${message}</div>`).join('');
    }
}

customElements.define('topic-viewer', TopicViewer);
