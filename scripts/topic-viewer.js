import MQTTHandler from './mqtt-handler.js';

class TopicViewer extends HTMLElement {
    static get observedAttributes() {
        return ['filter'];
    }

    constructor() {
        super();
        this.inicializarComponente();
    }

    inicializarComponente() {
        this.attachShadow({ mode: 'open' });
        this.cargarCSS();
        this.configurarHTML();
        this.inicializarVariables();
        this.solicitarPermisoNotificaciones();
    }

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

    cargarCSS() {
        fetch('styles/topic-viewer.css')
            .then(respuesta => respuesta.text())
            .then(css => this.aplicarEstilos(css));
    }

    aplicarEstilos(css) {
        const style = document.createElement('style');
        style.textContent = css;
        this.shadowRoot.appendChild(style);
    }

    configurarHTML() {
        this.shadowRoot.innerHTML = `
            <div class="input-container">
                <input type="text" id="topicSearch" placeholder="Buscar en tópicos...">
                <button id="searchButton">Aceptar</button>
            </div>
            <div style="display: flex; align-items: center;">
                <select id="topicSelector"></select>
                <div id="topicCount" style="margin-left: 10px;">0</div>
                <input type="number" id="inputNum" value="100" min="1" style="margin-left: 10px;">
            </div>
            <div id="messageDisplay"></div>
        `;
    }

    inicializarVariables() {
        this.topics = new Map();
        this.lastUpdateTime = new Map();
        this.messageCounters = new Map(); // Contador de mensajes por tópico
        this.searchFilter = '';
        this.topicCount = 0;

        const clientId = `web_${Math.random().toString(16).slice(2, 10)}`;
        this.mqttHandler = new MQTTHandler(clientId, this.manejarMensajeRecibido.bind(this), this.onConnectionLost.bind(this));
    }

    connectedCallback() {
        this.configurarElementos();
        this.adjuntarManejadoresEventos();
        if (this.hasAttribute('filter')) {
            this.mqttHandler.subscribe(this.getAttribute('filter'));
        }
        this.iniciarTemporizador();
    }

    configurarElementos() {
        this.topicSelector = this.shadowRoot.getElementById('topicSelector');
        this.messageDisplay = this.shadowRoot.getElementById('messageDisplay');
        this.topicSearch = this.shadowRoot.getElementById('topicSearch');
        this.searchButton = this.shadowRoot.getElementById('searchButton');
        this.inputNum = this.shadowRoot.getElementById('inputNum');
    }

    adjuntarManejadoresEventos() {
        this.searchButton.addEventListener('click', () => this.manejarClickBotonBuscar());
        this.topicSelector.addEventListener('change', () => {
            this.mostrarMensajes(this.topicSelector.value);
            const selectedOption = this.topicSelector.options[this.topicSelector.selectedIndex];
            const selectedColor = selectedOption.style.backgroundColor;
            this.topicSelector.style.backgroundColor = selectedColor;
        });
        this.inputNum.addEventListener('change', () => this.limpiarYReiniciar());
    }

    manejarClickBotonBuscar() {
        this.searchFilter = this.topicSearch.value.trim();
        if (this.searchFilter) {
            this.buscarTopicos(this.searchFilter);
            console.log('Busqueda iniciada con:', this.searchFilter);
        } else {
            console.log('No hay termino de busqueda ingresado.');
            this.messageDisplay.innerHTML = '';
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'filter' && newValue) {
            this.mqttHandler.subscribe(newValue);
        }
    }

    onConnectionLost(respuesta) {
        if (respuesta.errorCode !== 0) {
            console.log("Conexion perdida:", respuesta.errorMessage);
        }
    }

    manejarMensajeRecibido(message) {
        this.agregarMensaje(message);
        if (this.searchFilter && message.payloadString.includes(this.searchFilter) && Notification.permission === "granted") {
            this.enviarNotificacion(`Nuevo mensaje en topico: ${message.destinationName}`, message.payloadString);
        }
    }

    enviarNotificacion(titulo, cuerpo) {
        new Notification(titulo, {
            body: cuerpo,
            icon: 'icon_url'
        });
    }

    agregarMensaje(mensaje) {
        const topicComplete = mensaje.destinationName;
        const topic = topicComplete.substring(topicComplete.lastIndexOf('/') + 1);
        this.lastUpdateTime.set(topic, Date.now());

        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.messageCounters.set(topic, 0); // Inicializar contador de mensajes
            this.agregarOpcionTopico(topic);
            this.actualizarContadorTopicos();
        }

        this.topics.get(topic).push(mensaje.payloadString);
        this.messageCounters.set(topic, this.messageCounters.get(topic) + 1); // Incrementar contador de mensajes

        if (this.topics.get(topic).length > parseInt(this.inputNum.value, 10)) {
            this.topics.get(topic).shift(); // Eliminar mensajes antiguos
        }
        this.actualizarContadorTopico(topic);

        if (this.topicSelector.value === topic) {
            this.mostrarMensajes(topic);
        }
    }

    actualizarContadorTopicos() {
        this.topicCount = this.topics.size;
        this.shadowRoot.getElementById('topicCount').textContent = this.topicCount;
    }

    agregarOpcionTopico(topico) {
        const option = document.createElement('option');
        option.value = topico;
        option.textContent = `${topico} (0)`;
        this.topicSelector.appendChild(option);
        this.ordenarTopicos();
    }

    actualizarContadorTopico(topico) {
        const totalMessages = this.messageCounters.get(topico);
        const option = this.topicSelector.querySelector(`option[value="${topico}"]`);
        if (option) {
            option.textContent = `${topico} ----- (${totalMessages})`;
        }
    }

    ordenarTopicos() {
        const options = Array.from(this.topicSelector.options);
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        this.topicSelector.innerHTML = '';
        options.forEach(option => this.topicSelector.appendChild(option));
    }

    mostrarMensajes(topico) {
        const mensajes = this.topics.get(topico) || [];
        this.messageDisplay.innerHTML = mensajes.map(mensaje => `<div>${mensaje}</div>`).join('');
    }

    limpiarYReiniciar() {
        this.topics.clear();
        this.messageCounters.clear(); // Limpiar contador de mensajes
        this.messageDisplay.innerHTML = '';
        this.topicSelector.innerHTML = '';
        this.actualizarContadorTopicos();
        if (this.hasAttribute('filter')) {
            this.mqttHandler.subscribe(this.getAttribute('filter'));
        }
    }

    iniciarTemporizador() {
        setInterval(() => {
            const currentTime = Date.now();
            this.topics.forEach((_, topico) => {
                const lastTime = this.lastUpdateTime.get(topico);
                if (currentTime - lastTime > 180000) {
                    this.actualizarEstiloTopico(topico, true);
                } else {
                    this.actualizarEstiloTopico(topico, false);
                }
            });
        }, 60000);
    }

    actualizarEstiloTopico(topico, estaDesactualizado) {
        const select = this.topicSelector;
        const option = select.querySelector(`option[value="${topico}"]`);
        if (option) {
            option.style.backgroundColor = estaDesactualizado ? '#e91010' : '#7ca3cc';
            select.style.backgroundColor = estaDesactualizado ? '#e91010' : '#7ca3cc';
        }
    }
}

customElements.define('topic-viewer', TopicViewer);
