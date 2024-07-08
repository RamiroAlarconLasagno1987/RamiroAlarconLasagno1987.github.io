import MQTTHandler from './mqtt-handler.js';
import { solicitarPermisoNotificaciones } from './notification-handler.js';
import { cargarCSS, configurarHTML, configurarElementos } from './dom-utils.js';
import {
    manejarMensajeRecibido,
    agregarMensaje,
    actualizarContadorTopicos,
    agregarOpcionTopico,
    actualizarContadorTopico,
    ordenarTopicos,
    mostrarMensajes,
    limpiarYReiniciar
} from './message-handler.js';

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
        cargarCSS(this.shadowRoot);
        configurarHTML(this.shadowRoot);
        this.inicializarVariables();
        solicitarPermisoNotificaciones();
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
        const elementos = configurarElementos(this.shadowRoot);
        this.topicSelector = elementos.topicSelector;
        this.messageDisplay = elementos.messageDisplay;
        this.topicSearch = elementos.topicSearch;
        this.searchButton = elementos.searchButton;
        this.inputNum = elementos.inputNum;

        this.adjuntarManejadoresEventos();
        if (this.hasAttribute('filter')) {
            this.mqttHandler.subscribe(this.getAttribute('filter'));
        }
        this.iniciarTemporizador();
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
        manejarMensajeRecibido(this, message);
    }

    agregarMensaje(mensaje) {
        agregarMensaje(this, mensaje);
    }

    actualizarContadorTopicos() {
        actualizarContadorTopicos(this);
    }

    agregarOpcionTopico(topico) {
        agregarOpcionTopico(this, topico);
    }

    actualizarContadorTopico(topico) {
        actualizarContadorTopico(this, topico);
    }

    ordenarTopicos() {
        ordenarTopicos(this);
    }

    mostrarMensajes(topico) {
        mostrarMensajes(this, topico);
    }

    limpiarYReiniciar() {
        limpiarYReiniciar(this);
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
        }, 30000);
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
